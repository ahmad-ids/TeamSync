import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import EditCalendarRoundedIcon from '@mui/icons-material/EditCalendarRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { appColors } from '../../theme/theme';
import type { CreateChangeRequestPayload } from '../../services/changeRequestService';
import type { ChangeRequestOwnerOptionModel, TaskDetailsModel } from '../../types/domain';
import { changeRequestDialogContentSx, changeRequestDialogStackSx } from './MemberTaskActions.styles';

type ChangeRequestType = CreateChangeRequestPayload['requestType'];

interface MemberTaskActionsProps {
  task: TaskDetailsModel;
  ownerCandidates: ChangeRequestOwnerOptionModel[];
  isSubmitting: boolean;
  onAcknowledge: () => Promise<void>;
  onUpdateStatus: (status: TaskDetailsModel['status']) => Promise<void>;
  onCreateChangeRequest: (payload: CreateChangeRequestPayload) => Promise<void>;
}

const changeRequestLabels: Record<ChangeRequestType, string> = {
  ChangeOwner: 'Change Owner',
  ChangeDueDate: 'Change Due Date',
  IncreaseEstimatedEffort: 'Increase Effort',
};

export function MemberTaskActions({
  task,
  ownerCandidates,
  isSubmitting,
  onAcknowledge,
  onUpdateStatus,
  onCreateChangeRequest,
}: MemberTaskActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestType, setRequestType] = useState<ChangeRequestType>('ChangeDueDate');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');

  const statusOptions = useMemo(() => resolveNextStatuses(task.status), [task.status]);
  const recommendedNextStatus = statusOptions[0] ?? null;
  const availableRequestTypes = useMemo(
    () =>
      (Object.keys(changeRequestLabels) as ChangeRequestType[]).filter(
        (type) => type !== 'ChangeOwner' || ownerCandidates.length > 0,
      ),
    [ownerCandidates.length],
  );

  function resetDialogState(nextType: ChangeRequestType = availableRequestTypes[0] ?? 'ChangeDueDate') {
    setRequestType(nextType);
    setNewValue('');
    setReason('');
  }

  function handleOpenDialog() {
    resetDialogState();
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    if (isSubmitting) {
      return;
    }

    setDialogOpen(false);
    resetDialogState();
  }

  async function handleSubmitChangeRequest() {
    await onCreateChangeRequest({
      taskId: task.id,
      requestType,
      newValue,
      reason,
    });
    handleCloseDialog();
  }

  return (
    <>
      <Paper sx={{ p: 3, borderRadius: 3.5 }}>
        <Stack spacing={2.2}>
          <Stack spacing={0.75}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Member Actions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Confirm the assignment first, then continue with the normal task workflow.
            </Typography>
          </Stack>

          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            alignItems="stretch"
            sx={{ width: '100%' }}
          >
            <Stack spacing={1.5} sx={{ flex: '0 1 auto', width: { xs: '100%', lg: 'fit-content' } }}>
              {!task.isAcknowledged ? (
                <Stack spacing={1.25} alignItems="flex-start">
                  <Button
                    variant="contained"
                    startIcon={<AssignmentTurnedInRoundedIcon />}
                    onClick={() => void onAcknowledge()}
                    disabled={isSubmitting}
                    sx={{
                      width: 'fit-content',
                      alignSelf: 'flex-start',
                      px: 2,
                      py: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isSubmitting ? 'Acknowledging...' : 'Acknowledge Task'}
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    The task will move into the normal workflow after acknowledgement.
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Task acknowledged on {new Date(task.acknowledgedAt ?? task.updatedAt).toLocaleDateString()}.
                </Typography>
              )}

              {task.isAcknowledged ? (
                <>
                  <Stack spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Status updates
                    </Typography>
                    {statusOptions.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No further status updates are available from the current task state.
                      </Typography>
                    ) : (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                        {statusOptions.map((status) => (
                          <Button
                            key={status}
                            variant={status === recommendedNextStatus ? 'contained' : 'outlined'}
                            startIcon={<AutorenewRoundedIcon />}
                            onClick={() => void onUpdateStatus(status)}
                            disabled={isSubmitting}
                            sx={{
                              width: 'fit-content',
                              px: 1.75,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {status === 'InProgress'
                              ? 'Start Work'
                              : status === 'Blocked'
                                ? 'Mark Blocked'
                                : 'Mark Done'}
                          </Button>
                        ))}
                      </Stack>
                    )}
                  </Stack>

                  <Button
                    variant="outlined"
                    startIcon={<EditCalendarRoundedIcon />}
                    onClick={handleOpenDialog}
                    disabled={isSubmitting}
                    sx={{
                      width: 'fit-content',
                      borderColor: appColors.light.border.default,
                      px: 2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Request Task Change
                  </Button>
                </>
              ) : null}
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                flex: '1 1 320px',
                minWidth: 0,
                p: 2,
                borderRadius: 3,
                bgcolor: alpha(appColors.light.primary.main, 0.04),
                borderColor: alpha(appColors.light.primary.main, 0.12),
                boxShadow: 'none',
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Workload Snapshot
                </Typography>
                <Stack spacing={1}>
                  <MetricLine label="Capacity This Week" value={`${task.assigneeCapacityPercentageThisWeek.toFixed(1)}%`} />
                  <MetricLine label="Effort Estimate" value={`${task.estimatedEffortHours}h`} />
                  <MetricLine label="Calculated Weight" value={task.calculatedWeight.toFixed(1)} />
                  <MetricLine label="Current State" value={task.isAcknowledged ? 'Ready for execution' : 'Awaiting acknowledgement'} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Compact workload details stay visible here so the actions area does not waste horizontal space.
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>Submit Change Request</DialogTitle>
        <DialogContent sx={changeRequestDialogContentSx}>
          <Stack spacing={2.25} sx={changeRequestDialogStackSx}>
            <TextField
              select
              label="Change Type"
              value={requestType}
              onChange={(event) => {
                const nextType = event.target.value as ChangeRequestType;
                setRequestType(nextType);
                setNewValue('');
              }}
              InputLabelProps={{ shrink: true }}
              fullWidth
            >
              {availableRequestTypes.map((value) => (
                <MenuItem key={value} value={value}>
                  {changeRequestLabels[value]}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="caption" color="text.secondary">
              {requestType === 'ChangeOwner'
                ? 'Request a reassignment to another eligible teammate in the same delivery lane.'
                : requestType === 'ChangeDueDate'
                  ? 'Choose the revised target date you need for successful delivery.'
                  : 'Enter the higher effort estimate required to complete the task properly.'}
            </Typography>
            {requestType === 'ChangeOwner' ? (
              <TextField
                select
                label="Requested New Owner"
                value={newValue}
                onChange={(event) => setNewValue(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              >
                {ownerCandidates.map((candidate) => (
                  <MenuItem key={candidate.memberId} value={candidate.memberId}>
                    {`${candidate.fullName} | ${candidate.jobTitle} | ${candidate.workloadStatus}`}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label={requestType === 'ChangeDueDate' ? 'Requested Due Date' : 'Requested Effort Hours'}
                type={requestType === 'ChangeDueDate' ? 'date' : 'number'}
                value={newValue}
                onChange={(event) => setNewValue(event.target.value)}
                InputLabelProps={requestType === 'ChangeDueDate' ? { shrink: true } : undefined}
                inputProps={requestType === 'IncreaseEstimatedEffort' ? { min: task.estimatedEffortHours + 1, step: 0.5 } : undefined}
                fullWidth
              />
            )}
            <TextField
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what changed, what is blocked, or why more time is required."
              multiline
              minRows={4}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleCloseDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSubmitChangeRequest()}
            disabled={isSubmitting || !newValue.trim() || !reason.trim()}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function resolveNextStatuses(status: TaskDetailsModel['status']) {
  switch (status) {
    case 'New':
      return ['InProgress', 'Blocked'] as const;
    case 'InProgress':
      return ['Blocked', 'Done'] as const;
    case 'Blocked':
      return ['InProgress'] as const;
    default:
      return [] as const;
  }
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700, textAlign: 'right' }}>
        {value}
      </Typography>
    </Stack>
  );
}
