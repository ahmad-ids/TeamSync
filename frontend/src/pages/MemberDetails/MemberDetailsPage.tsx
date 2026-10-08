import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import WorkHistoryRoundedIcon from '@mui/icons-material/WorkHistoryRounded';
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
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useAuth } from '../../app/auth/AuthProvider';
import { resolveHomePathByRole } from '../../app/auth/roleAccess';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MemberTaskList } from '../../components/members/MemberTaskList';
import { deleteTask } from '../../services/taskService';
import { getMemberWorkloadDetails } from '../../services/workloadService';
import { appColors } from '../../theme/theme';
import type { MemberWorkloadDetailsModel, TaskSummaryModel, WorkloadPeriod } from '../../types/domain';
import { ActiveTasksSection } from './ActiveTasksSection';
import { getMemberStatusAccent, HistoryPanel, OverviewMetrics, WorkloadInsightsPanel } from './MemberDetailsSections';
import { resolveRequestError } from '../TaskDetails/TaskDetailsParts';

type DetailTab = 'overview' | 'workload' | 'history';
type TaskStatusFilter = 'all' | TaskSummaryModel['status'];
type TaskSortMode = 'dueDate' | 'priority' | 'effort';

const controlFieldSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 46,
    borderRadius: '12px',
    backgroundColor: appColors.light.background.subtle,
    '&:hover': {
      bgcolor: appColors.light.background.accent,
    },
  },
} as const;

const sectionPaperSx = {
  p: { xs: 2.5, md: 3 },
  borderRadius: '16px',
  boxShadow: 'none',
} as const;

const summaryMetaCardSx = {
  p: 1.75,
  borderRadius: '14px',
  border: '1px solid',
  borderColor: appColors.light.border.default,
  backgroundColor: appColors.light.background.paper,
  boxShadow: 'none',
} as const;

const priorityBars: Record<string, string> = {
  Critical: '#d13d3d',
  High: '#d13d3d',
  Medium: '#2d5ca8',
  Low: '#c9d0de',
};

function formatPeriod(startDate: string, endDate: string) {
  return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(startDate))} - ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(endDate))}`;
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function buildTaskFormHref(member: MemberWorkloadDetailsModel) {
  const params = new URLSearchParams({ memberId: member.memberId, memberName: member.fullName });
  return `/tasks/new?${params.toString()}`;
}

function exportMemberReport(member: MemberWorkloadDetailsModel) {
  const rows = [
    ['Member', member.fullName],
    ['Job Title', member.jobTitle],
    ['Email', member.email],
    ['Team', member.teamName],
    ['Period', `${member.startDate} to ${member.endDate}`],
    ['Status', member.status],
    ['Total Tasks', String(member.totalTasks)],
    ['Total Effort Hours', String(member.totalEffortHours)],
    ['Total Weight', String(member.totalWeight)],
    ['Capacity Percentage', String(member.capacityPercentage)],
    ['Impact Score', String(member.impactScore)],
    ['Insight', member.insight],
    [],
    ['Task Title', 'Status', 'Priority', 'Complexity', 'Effort Hours', 'Weight', 'Due Date'],
    ...member.tasks.map((task) => [
      task.title,
      task.status,
      task.priority,
      task.complexity,
      String(task.estimatedEffortHours),
      String(task.calculatedWeight),
      task.dueDate,
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((cell = '') => `"${String(cell).replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${member.fullName.toLowerCase().replaceAll(' ', '-')}-workload-report.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function matchesTask(task: TaskSummaryModel, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    task.title,
    task.status,
    task.priority,
    task.complexity,
    `${task.estimatedEffortHours}`,
    `${task.calculatedWeight}`,
  ].some((value) => value.toLowerCase().includes(normalized));
}

function MemberSummaryCard({ data }: { data: MemberWorkloadDetailsModel }) {
  const statusAccent = getMemberStatusAccent(data.status);

  return (
    <Paper
      sx={{
        ...sectionPaperSx,
        border: '1px solid',
        borderColor: appColors.light.border.default,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,249,255,0.98) 100%)',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.7fr) minmax(280px, 0.9fr)' },
          gap: 2.25,
          alignItems: 'stretch',
        }}
      >
        <Stack spacing={2.25}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Avatar sx={{ width: 76, height: 76, bgcolor: '#e3edff', color: '#2c5ec7', fontSize: 27, fontWeight: 700 }}>
              {data.fullName
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </Avatar>
            <Stack spacing={0.85} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1.1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography sx={{ color: 'text.primary', fontSize: { xs: 28, md: 32 }, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05 }}>
                  {data.fullName}
                </Typography>
                <Chip
                  label={data.status.toUpperCase()}
                  size="small"
                  sx={{
                    height: 30,
                    alignSelf: 'center',
                    px: 0.35,
                    borderRadius: '999px',
                    backgroundColor: `${statusAccent}14`,
                    color: statusAccent,
                    fontWeight: 700,
                    letterSpacing: 0.25,
                  }}
                />
              </Stack>
              <Typography sx={{ color: 'text.secondary', fontSize: 16.5, fontWeight: 600, lineHeight: 1.35 }}>{data.jobTitle}</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 13.5, maxWidth: 620 }}>
                Snapshot of current workload, assignment context, and delivery risk for the selected planning window.
              </Typography>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.4,
            }}
          >
            <SummaryMetaCard label="Email" value={data.email} icon={<EmailRoundedIcon sx={{ fontSize: 18 }} />} />
            <SummaryMetaCard label="Team" value={data.teamName} icon={<Groups2RoundedIcon sx={{ fontSize: 18 }} />} />
            <SummaryMetaCard label="Current Status" value={data.status === 'Overloaded' ? 'Over capacity' : data.status} icon={<WorkHistoryRoundedIcon sx={{ fontSize: 18 }} />} valueColor={statusAccent} />
            <SummaryMetaCard label="Selected Range" value={formatPeriod(data.startDate, data.endDate)} icon={<CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />} />
          </Box>
        </Stack>

        <Paper
          sx={{
            ...summaryMetaCardSx,
            p: { xs: 2, md: 2.2 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 2,
            background: 'linear-gradient(180deg, rgba(243,247,255,0.95) 0%, rgba(255,255,255,0.98) 100%)',
          }}
        >
          <Stack spacing={1.4}>
            <Stack direction="row" spacing={1.1} alignItems="center">
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: '12px',
                  bgcolor: appColors.light.background.paper,
                  color: '#355fad',
                  border: '1px solid',
                  borderColor: appColors.light.border.default,
                }}
              >
                <PersonRoundedIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box>
                <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}>Member Summary</Typography>
                <Typography sx={{ color: 'text.primary', fontSize: 16, fontWeight: 700 }}>Assignment Actions</Typography>
              </Box>
            </Stack>
            <Typography sx={{ color: 'text.secondary', fontSize: 13.5, lineHeight: 1.65 }}>
              Use this summary to confirm role fit, current capacity, and reporting details before assigning new work.
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row', xl: 'column' }} spacing={1.05}>
            <Button
              variant="outlined"
              onClick={() => exportMemberReport(data)}
              sx={{
                minWidth: 0,
                minHeight: 40,
                px: 2.15,
                borderRadius: '11px',
                borderColor: appColors.light.border.default,
                backgroundColor: appColors.light.background.paper,
                color: 'text.primary',
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1,
                '&:hover': {
                  borderColor: appColors.light.border.hover,
                  backgroundColor: appColors.light.background.accent,
                  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  backgroundColor: appColors.light.background.subtle,
                  boxShadow: 'none',
                  transform: 'translateY(0)',
                },
                '&:focusVisible': {
                  boxShadow: appColors.light.button.primary.focusRing,
                },
              }}
            >
              Export Report
            </Button>
            <Button
              component={Link}
              to={buildTaskFormHref(data)}
              variant="contained"
              sx={{
                minWidth: 0,
                minHeight: 40,
                px: 2.3,
                borderRadius: '11px',
                backgroundColor: appColors.light.button.primary.base,
                color: appColors.light.primary.contrastText,
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1,
                boxShadow: appColors.light.shadow.button,
                '&:hover': {
                  backgroundColor: appColors.light.button.primary.hover,
                  boxShadow: appColors.light.shadow.buttonHover,
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  backgroundColor: appColors.light.button.primary.active,
                  boxShadow: 'none',
                  transform: 'translateY(0)',
                },
                '&:focusVisible': {
                  boxShadow: appColors.light.button.primary.focusRing,
                },
              }}
            >
              Assign Task
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Paper>
  );
}

function SummaryMetaCard({
  label,
  value,
  icon,
  valueColor = 'text.primary',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <Paper sx={summaryMetaCardSx}>
      <Stack direction="row" spacing={1.4} alignItems="flex-start">
        <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: '12px', bgcolor: appColors.light.background.accent, color: '#355fad' }}>
          {icon}
        </Box>
        <Stack spacing={0.45} sx={{ minWidth: 0 }}>
          <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.65 }}>{label}</Typography>
          <Typography sx={{ color: valueColor, fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word' }}>{value}</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function MemberDetailsPage() {
  const { memberId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<MemberWorkloadDetailsModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>('all');
  const [taskSortMode, setTaskSortMode] = useState<TaskSortMode>('dueDate');
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [optionsAnchorEl, setOptionsAnchorEl] = useState<HTMLElement | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskSummaryModel | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deferredTaskSearch = useDeferredValue(taskSearch);
  const canDeleteTask = user?.role === 'TeamLeader';

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      setError('');

      try {
        const period = (searchParams.get('period') as WorkloadPeriod | null) ?? 'thisWeek';
        const result = await getMemberWorkloadDetails(memberId, {
          period,
          startDate: searchParams.get('startDate') ?? undefined,
          endDate: searchParams.get('endDate') ?? undefined,
        });

        if (!isCancelled) {
          setData(result);
        }
      } catch {
        if (!isCancelled) {
          setError('Unable to load member workload details.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (memberId) {
      void load();
    }

    return () => {
      isCancelled = true;
    };
  }, [memberId, searchParams]);

  const filteredTasks = useMemo(
    () =>
      (data?.tasks ?? [])
        .filter((task) => taskStatusFilter === 'all' || task.status === taskStatusFilter)
        .filter((task) => matchesTask(task, deferredTaskSearch))
        .sort((left, right) => {
          if (taskSortMode === 'effort') {
            return right.estimatedEffortHours - left.estimatedEffortHours || right.calculatedWeight - left.calculatedWeight;
          }

          if (taskSortMode === 'priority') {
            const rank: Record<TaskSummaryModel['priority'], number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
            return rank[right.priority] - rank[left.priority] || new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
          }

          return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
        }),
    [data?.tasks, deferredTaskSearch, taskSortMode, taskStatusFilter],
  );

  function handleRequestDelete(task: TaskSummaryModel) {
    setDeleteError(null);
    setDeleteSuccess(null);
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!taskToDelete) {
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      await deleteTask(taskToDelete.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.filter((item) => item.id !== taskToDelete.id),
            }
          : prev,
      );
      setDeleteSuccess('Task deleted successfully.');
    } catch (submissionError: unknown) {
      setDeleteError(resolveRequestError(submissionError, 'Unable to delete the task right now.'));
    } finally {
      setDeleteSubmitting(false);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  }

  function handleBackNavigation() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(resolveHomePathByRole(user?.role));
  }

  if (isLoading) {
    return (
      <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return <Alert severity="error">{error || 'Member not found.'}</Alert>;
  }

  return (
    <Stack spacing={3.5}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
        <Stack direction="row" spacing={1.4} alignItems="flex-start">
          <IconButton
            onClick={handleBackNavigation}
            aria-label="Go back"
            sx={{
              mt: 0.2,
              width: 40,
              height: 40,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: appColors.light.border.default,
              bgcolor: appColors.light.background.paper,
              color: 'text.secondary',
              transition: 'all 180ms ease',
              '&:hover': {
                bgcolor: appColors.light.background.accent,
                borderColor: appColors.light.border.hover,
                color: 'text.primary',
                transform: 'translateX(-1px)',
              },
              '&:active': {
                transform: 'translateX(0)',
              },
            }}
          >
            <ArrowBackRoundedIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography sx={{ color: 'text.primary', fontSize: 28, lineHeight: 1.08, fontWeight: 700, letterSpacing: '-0.03em' }}>Member Details</Typography>
            <Typography sx={{ mt: 0.9, color: 'text.secondary' }}>
              Review active workload, delivery signals, and recent activity for this team member.
            </Typography>
          </Box>
        </Stack>
        <TextField
          placeholder="Search tasks..."
          value={taskSearch}
          onChange={(event) => setTaskSearch(event.target.value)}
          sx={{ ...controlFieldSx, width: { xs: '100%', lg: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: '#94a3b8' }} />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      <Paper
        sx={{
          p: 0.5,
          borderRadius: '14px',
          bgcolor: appColors.light.background.muted,
          boxShadow: 'none',
          overflow: 'hidden',
          width: 'fit-content',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, value: DetailTab) => setActiveTab(value)}
          sx={{
            minHeight: 42,
            '& .MuiTabs-flexContainer': {
              gap: 0.5,
            },
            '& .MuiTab-root': {
              minHeight: 42,
              minWidth: 116,
              px: 2.25,
              borderRadius: '10px',
              color: 'text.secondary',
              fontWeight: 500,
            },
            '& .Mui-selected': {
              color: 'text.primary',
              bgcolor: appColors.light.background.paper,
              boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
            },
            '& .MuiTabs-indicator': {
              display: 'none',
            },
          }}
        >
          <Tab label="Overview" value="overview" />
          <Tab label="Workload" value="workload" />
          <Tab label="History" value="history" />
        </Tabs>
      </Paper>

      <MemberSummaryCard data={data} />

      <OverviewMetrics data={data} />

      {activeTab === 'overview' ? (
        <Box sx={{ width: '100%', px: { xs: 2, md: 3 } }}>
          <Box sx={{ width: '100%', maxWidth: 1320, mx: 'auto' }}>
            <ActiveTasksSection
              tasks={filteredTasks}
              canDeleteTask={canDeleteTask}
              taskStatusFilter={taskStatusFilter}
              taskSortMode={taskSortMode}
              deleteSuccess={deleteSuccess}
              deleteError={deleteError}
              onOpenFilterMenu={(anchor) => setFilterAnchorEl(anchor)}
              onOpenSortMenu={(anchor) => setOptionsAnchorEl(anchor)}
              onClearTaskStatusFilter={() => setTaskStatusFilter('all')}
              onDismissDeleteSuccess={() => setDeleteSuccess(null)}
              onDismissDeleteError={() => setDeleteError(null)}
              onRequestDelete={handleRequestDelete}
            />
          </Box>
        </Box>
      ) : null}

      {activeTab === 'workload' ? (
        <WorkloadInsightsPanel data={data} filteredTasks={filteredTasks} />
      ) : null}

      {activeTab === 'history' ? <HistoryPanel items={data.history} formatHistoryDate={formatHistoryDate} /> : null}

      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              minWidth: 210,
              borderRadius: '14px',
              border: '1px solid',
              borderColor: appColors.light.border.default,
              boxShadow: '0 14px 36px rgba(15, 23, 42, 0.12)',
            },
          },
        }}
      >
        <MenuItem onClick={() => { setTaskStatusFilter('all'); setFilterAnchorEl(null); }}>All tasks</MenuItem>
        <MenuItem onClick={() => { setTaskStatusFilter('New'); setFilterAnchorEl(null); }}>New</MenuItem>
        <MenuItem onClick={() => { setTaskStatusFilter('InProgress'); setFilterAnchorEl(null); }}>In progress</MenuItem>
        <MenuItem onClick={() => { setTaskStatusFilter('Blocked'); setFilterAnchorEl(null); }}>Blocked</MenuItem>
        <MenuItem onClick={() => { setTaskStatusFilter('Done'); setFilterAnchorEl(null); }}>Done</MenuItem>
      </Menu>

      <Menu
        anchorEl={optionsAnchorEl}
        open={Boolean(optionsAnchorEl)}
        onClose={() => setOptionsAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              minWidth: 230,
              borderRadius: '14px',
              border: '1px solid',
              borderColor: appColors.light.border.default,
              boxShadow: '0 14px 36px rgba(15, 23, 42, 0.12)',
            },
          },
        }}
      >
        <MenuItem onClick={() => { setTaskSortMode('dueDate'); setOptionsAnchorEl(null); }}>Sort by due date</MenuItem>
        <MenuItem onClick={() => { setTaskSortMode('priority'); setOptionsAnchorEl(null); }}>Sort by priority</MenuItem>
        <MenuItem onClick={() => { setTaskSortMode('effort'); setOptionsAnchorEl(null); }}>Sort by effort</MenuItem>
        </Menu>
      <Dialog
        open={deleteDialogOpen}
        onClose={() => (deleteSubmitting ? undefined : setDeleteDialogOpen(false))}
        fullWidth
        maxWidth="xs"
      >
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
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleConfirmDelete()}
            disabled={deleteSubmitting}
          >
            {deleteSubmitting ? 'Deleting...' : 'Delete Task'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
