import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthProvider';
import { normalizeRole } from '../../app/auth/roleAccess';
import {
  createChangeRequest,
  getChangeRequestOptions,
  getChangeRequests,
  type CreateChangeRequestPayload,
} from '../../services/changeRequestService';
import {
  acknowledgeTask,
  deleteTask,
  getTaskDetails,
  getTaskFormOptions,
  reassignTask,
  updateTaskStatus,
} from '../../services/taskService';
import type {
  ChangeRequestModel,
  ChangeRequestOwnerOptionModel,
  TaskDetailsModel,
  TaskFormMemberOptionModel,
} from '../../types/domain';
import { appColors } from '../../theme/theme';
import { specializationLabel } from '../../utils/specialization';
import {
  ChangeAuditRow,
  DetailMetric,
  MetricLine,
  StatusTimelineRow,
  formatRelativeDate,
  resolveRequestError,
  toStatusLabel,
} from './TaskDetailsParts';
import {
  cardSurfaceSx,
  headerSurfaceSx,
  mutedSidebarSx,
  pageShellSx,
  priorityColors,
  statusColors,
} from './TaskDetailsPage.styles';
import { MemberTaskActions } from '../MemberDashboard/MemberTaskActions';
import { MemberChangeRequestsPanel } from './MemberChangeRequestsPanel';

function normalizeTaskDetails(task: TaskDetailsModel): TaskDetailsModel {
  return {
    ...task,
    reassignmentRequests: task.reassignmentRequests ?? [],
    statusTimeline: task.statusTimeline ?? [],
    changeAudit: task.changeAudit ?? [],
    assigneeCapacity: task.assigneeCapacity ?? [],
  };
}

export function TaskDetailsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<TaskDetailsModel | null>(null);
  const [memberOptions, setMemberOptions] = useState<TaskFormMemberOptionModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [memberActionSubmitting, setMemberActionSubmitting] = useState(false);
  const [memberChangeRequests, setMemberChangeRequests] = useState<ChangeRequestModel[]>([]);
  const [memberChangeRequestsLoading, setMemberChangeRequestsLoading] = useState(false);
  const [changeRequestOwnerOptions, setChangeRequestOwnerOptions] = useState<ChangeRequestOwnerOptionModel[]>([]);
  const [proposedAssigneeId, setProposedAssigneeId] = useState('');

  useEffect(() => {
    if (!taskId) {
      setError('Task id is missing.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    void getTaskDetails(taskId)
      .then((response) => {
        if (isMounted) {
          setTask(normalizeTaskDetails(response));
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(resolveRequestError(loadError, 'Unable to load task details.'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  const normalizedRole = normalizeRole(user?.role);
  const canManageTask = normalizedRole === 'TeamLeader';
  const canManageMemberTask = normalizedRole === 'Member' && task?.assignedMemberId === user?.userId;
  const statusMeta = task ? statusColors[task.status] ?? statusColors.New : statusColors.New;
  const priorityMeta = task ? priorityColors[task.priority] ?? priorityColors.Medium : priorityColors.Medium;
  const dueDateLabel = task ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const startDateLabel = task ? new Date(task.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const ackLabel = useMemo(() => {
    if (!task) {
      return '';
    }

    return task.isAcknowledged && task.acknowledgedAt
      ? `Acknowledged on ${new Date(task.acknowledgedAt).toLocaleDateString()}`
      : 'Pending acknowledgement';
  }, [task]);
  const reassignmentCandidates = useMemo(() => {
    if (!task) {
      return [];
    }

    return memberOptions
      .filter((member) => member.specialization === task.requiredSpecialization && member.memberId !== task.assignedMemberId)
      .sort((left, right) => left.capacityPercentage - right.capacityPercentage || left.fullName.localeCompare(right.fullName));
  }, [memberOptions, task]);

  useEffect(() => {
    if (!taskId || !canManageMemberTask) {
      setMemberChangeRequests([]);
      setChangeRequestOwnerOptions([]);
      setMemberChangeRequestsLoading(false);
      return;
    }

    let isMounted = true;
    setMemberChangeRequestsLoading(true);

    void Promise.all([
      getChangeRequests({ taskId }),
      getChangeRequestOptions(taskId),
    ])
      .then(([requestsResponse, optionsResponse]) => {
        if (!isMounted) {
          return;
        }

        setMemberChangeRequests(requestsResponse.requests);
        setChangeRequestOwnerOptions(optionsResponse.ownerCandidates);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setMemberChangeRequests([]);
        setChangeRequestOwnerOptions([]);
      })
      .finally(() => {
        if (isMounted) {
          setMemberChangeRequestsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canManageMemberTask, taskId]);

  async function refreshTaskDetails() {
    if (!taskId) {
      return;
    }

    const nextTask = await getTaskDetails(taskId);
    setTask(normalizeTaskDetails(nextTask));
  }

  async function openReassignDialog() {
    setActionError(null);
    setActionSuccess(null);

    if (memberOptions.length === 0) {
      try {
        const options = await getTaskFormOptions();
        setMemberOptions(options.members);
      } catch {
        setActionError('Unable to load team members for reassignment.');
        return;
      }
    }

    setProposedAssigneeId('');
    setReassignDialogOpen(true);
  }

  async function handleDeleteTask() {
    if (!task) {
      return;
    }

    setDeleteSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await deleteTask(task.id);
      setActionSuccess('Task deleted successfully. Redirecting to the task list...');
      window.setTimeout(() => navigate(normalizedRole === 'Member' ? '/member' : '/', { replace: true }), 700);
    } catch (submissionError: unknown) {
      setActionError(resolveRequestError(submissionError, 'Unable to delete the task right now.'));
    } finally {
      setDeleteSubmitting(false);
      setDeleteDialogOpen(false);
    }
  }

  async function handleReassignTask() {
    if (!task || !proposedAssigneeId) {
      setActionError('Choose a new member for reassignment.');
      return;
    }

    setReassignSubmitting(true);
    setActionError(null);

    try {
      const nextTask = await reassignTask(task.id, {
        proposedAssigneeId,
      });
      setTask(normalizeTaskDetails(nextTask));
      setActionSuccess('Task reassigned successfully.');
      setReassignDialogOpen(false);
    } catch (submissionError: unknown) {
      setActionError(resolveRequestError(submissionError, 'Unable to reassign the task right now.'));
    } finally {
      setReassignSubmitting(false);
    }
  }

  async function handleAcknowledgeTask() {
    if (!task) {
      return;
    }

    setMemberActionSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await acknowledgeTask(task.id);
      await refreshTaskDetails();
      setActionSuccess('Task acknowledged successfully.');
    } catch (submissionError: unknown) {
      setActionError(resolveRequestError(submissionError, 'Unable to acknowledge the task right now.'));
    } finally {
      setMemberActionSubmitting(false);
    }
  }

  async function handleUpdateMemberTaskStatus(status: TaskDetailsModel['status']) {
    if (!task) {
      return;
    }

    setMemberActionSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const nextTask = await updateTaskStatus(task.id, { status });
      setTask(normalizeTaskDetails(nextTask));
      setActionSuccess(`Task status updated to ${toStatusLabel(status)}.`);
    } catch (submissionError: unknown) {
      setActionError(resolveRequestError(submissionError, 'Unable to update the task status right now.'));
    } finally {
      setMemberActionSubmitting(false);
    }
  }

  async function handleCreateChangeRequest(payload: CreateChangeRequestPayload) {
    setMemberActionSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await createChangeRequest(payload);
      await refreshTaskDetails();
      if (taskId) {
        const requestsResponse = await getChangeRequests({ taskId });
        setMemberChangeRequests(requestsResponse.requests);
      }
      setActionSuccess('Change request submitted successfully.');
    } catch (submissionError: unknown) {
      setActionError(resolveRequestError(submissionError, 'Unable to submit the change request right now.'));
      throw submissionError;
    } finally {
      setMemberActionSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Paper sx={cardSurfaceSx}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary">Loading task details...</Typography>
        </Stack>
      </Paper>
    );
  }

  if (error || !task) {
    return (
      <Paper sx={cardSurfaceSx}>
        <Stack spacing={2}>
          <Alert severity="error">{error ?? 'Task details were not found.'}</Alert>
          <Button component={Link} to={normalizedRole === 'Member' ? '/member' : '/'} startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: 'flex-start' }}>
            {normalizedRole === 'Member' ? 'Back to My Tasks' : 'Back to Workload'}
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Box sx={pageShellSx}>
      <Stack spacing={3}>
      <Paper sx={headerSurfaceSx}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ lg: 'flex-start' }}>
            <Stack spacing={1.25} sx={{ minWidth: 0 }}>
              <Button
                startIcon={<ArrowBackRoundedIcon />}
                onClick={() => navigate(-1)}
                sx={{
                  alignSelf: 'flex-start',
                  px: 0,
                  py: 0.25,
                  minWidth: 0,
                  color: 'text.primary',
                  fontWeight: 700,
                }}
              >
                {normalizedRole === 'Member' ? 'Back to My Tasks' : 'Back to Tasks'}
              </Button>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" color="text.secondary">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  My Tasks
                </Typography>
                <Typography variant="body2">/</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {task.teamName}
                </Typography>
                <Typography variant="body2">/</Typography>
                <Typography variant="body2">Task Details</Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 750, color: 'text.primary', lineHeight: 1.1 }}>
                {task.title}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap" alignItems={{ sm: 'center' }}>
                <Chip label={toStatusLabel(task.status)} sx={{ bgcolor: statusMeta.bg, color: statusMeta.color, fontWeight: 700 }} />
                <Chip label={task.priority} sx={{ bgcolor: priorityMeta.bg, color: priorityMeta.color, fontWeight: 700 }} />
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Avatar sx={{ width: 26, height: 26, bgcolor: '#eaf1ff', color: 'primary.main', fontSize: 12 }}>
                    {task.assignedMemberName.slice(0, 1)}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {task.assignedMemberName}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Due {dueDateLabel}
                </Typography>
              </Stack>
            </Stack>
            {canManageTask ? (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignSelf: { xs: 'stretch', lg: 'flex-start' } }}
              >
                <Button
                  component={Link}
                  to={`/tasks/${task.id}/edit`}
                  variant="outlined"
                  startIcon={<EditRoundedIcon />}
                  sx={{ px: 2.5, py: 1.1, borderRadius: 999 }}
                >
                  Edit Task
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RepeatRoundedIcon />}
                  onClick={() => void openReassignDialog()}
                  sx={{ px: 2.5, py: 1.1, borderRadius: 999 }}
                >
                  Reassign
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                  sx={{ px: 2.5, py: 1.1, borderRadius: 999 }}
                >
                  Delete
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      {actionSuccess ? <Alert severity="success">{actionSuccess}</Alert> : null}
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}

      <Stack spacing={3}>
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Paper sx={cardSurfaceSx}>
            <Stack spacing={2.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Description
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Task overview
                </Typography>
              </Stack>
              <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
                {task.description}
              </Typography>
              <Divider />
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                }}
              >
                <DetailMetric label="Status" value={toStatusLabel(task.status)} />
                <DetailMetric label="Priority" value={`${task.priority} (${task.priorityMultiplier.toFixed(1)}x)`} />
                <DetailMetric label="Assigned Member" value={task.assignedMemberName} />
                <DetailMetric label="Effort Estimate" value={`${task.estimatedEffortHours}h`} />
                <DetailMetric label="Complexity" value={`${task.complexityMultiplier.toFixed(1)}x ${task.complexity}`} />
                <DetailMetric label="Required Role" value={specializationLabel[task.requiredSpecialization]} />
                <DetailMetric label="Acknowledgement" value={ackLabel} />
                <DetailMetric label="Start Date" value={startDateLabel} />
                <DetailMetric label="Target Date" value={dueDateLabel} />
              </Box>
            </Stack>
          </Paper>

          {canManageMemberTask ? (
            <Paper sx={mutedSidebarSx}>
              <Stack spacing={1.5}>
                <Stack spacing={0.75}>
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Member Actions
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Acknowledge, update progress, or request a change from the natural reading flow.
                  </Typography>
                </Stack>
                <MemberTaskActions
                  task={task}
                  ownerCandidates={changeRequestOwnerOptions}
                  isSubmitting={memberActionSubmitting}
                  onAcknowledge={handleAcknowledgeTask}
                  onUpdateStatus={handleUpdateMemberTaskStatus}
                  onCreateChangeRequest={handleCreateChangeRequest}
                />
              </Stack>
            </Paper>
          ) : null}

        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <Paper sx={cardSurfaceSx}>
            <Stack spacing={2.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Workload
                </Typography>
                <Chip
                  label={`${task.calculatedWeight.toFixed(1)} pts`}
                  sx={{ bgcolor: alpha(appColors.light.primary.main, 0.12), color: 'primary.dark', fontWeight: 700 }}
                />
              </Stack>
              <Stack spacing={1.5}>
                <MetricLine label="Effort Hours" value={`${task.estimatedEffortHours}h`} />
                <MetricLine label="Complexity Multiplier" value={`${task.complexityMultiplier.toFixed(1)}x`} />
                <MetricLine label="Priority Factor" value={`${task.priorityMultiplier.toFixed(1)}x`} />
              </Stack>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  bgcolor: alpha(appColors.light.primary.main, 0.06),
                  border: `1px solid ${alpha(appColors.light.primary.main, 0.12)}`,
                }}
              >
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Calculated Result
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1, color: 'text.primary' }}>
                    {task.calculatedWeight.toFixed(1)}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Paper>

          <Paper sx={cardSurfaceSx}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Status Lifecycle
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Progression
                </Typography>
              </Stack>
              {(task.statusTimeline ?? []).map((item) => (
                <StatusTimelineRow key={item.id} item={item} />
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ ...cardSurfaceSx, gridColumn: { xs: '1 / -1' } }}>
            <Stack spacing={2.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Change Audit Log
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  History
                </Typography>
              </Stack>
              {(task.changeAudit ?? []).length === 0 ? (
                <Alert severity="info">No change requests have been recorded for this task yet.</Alert>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Field</TableCell>
                      <TableCell>Old Value</TableCell>
                      <TableCell>New Value</TableCell>
                      <TableCell>Updated By</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(task.changeAudit ?? []).map((item) => (
                      <ChangeAuditRow key={item.id} item={item} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </Stack>
          </Paper>

          {canManageMemberTask ? (
            <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
              <MemberChangeRequestsPanel requests={memberChangeRequests} isLoading={memberChangeRequestsLoading} />
            </Box>
          ) : null}
        </Box>
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={() => (deleteSubmitting ? undefined : setDeleteDialogOpen(false))} fullWidth maxWidth="xs">
        <DialogTitle>Delete Task</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            This will permanently remove the task and its related history. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteSubmitting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteTask()} disabled={deleteSubmitting}>
            {deleteSubmitting ? 'Deleting...' : 'Delete Task'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reassignDialogOpen} onClose={() => (reassignSubmitting ? undefined : setReassignDialogOpen(false))} fullWidth maxWidth="sm">
        <DialogTitle>Reassign Task</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <Typography color="text.secondary">
              Choose a new assignee within the required {specializationLabel[task.requiredSpecialization]} role. The task will update immediately.
            </Typography>
            <TextField
              select
              label="New Assignee"
              value={proposedAssigneeId}
              onChange={(event) => setProposedAssigneeId(event.target.value)}
              fullWidth
            >
              {reassignmentCandidates.map((member) => (
                <MenuItem key={member.memberId} value={member.memberId}>
                  {`${member.fullName} | ${member.jobTitle} | ${member.workloadStatus}`}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setReassignDialogOpen(false)} disabled={reassignSubmitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleReassignTask()} disabled={reassignSubmitting || reassignmentCandidates.length === 0}>
            {reassignSubmitting ? 'Reassigning...' : 'Reassign Task'}
          </Button>
        </DialogActions>
      </Dialog>
      </Stack>
    </Box>
  );
}
