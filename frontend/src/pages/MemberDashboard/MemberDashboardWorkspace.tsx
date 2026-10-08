import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Alert,
  Avatar,
  Box,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import { ActiveTasksSection } from '../MemberDetails/ActiveTasksSection';
import { HistoryPanel, WorkloadInsightsPanel, getMemberStatusAccent } from '../MemberDetails/MemberDetailsSections';
import { appColors, getWorkloadWeightMetricColors, workloadMetricColors } from '../../theme/theme';
import type { MemberWorkloadDetailsModel, TaskSummaryModel } from '../../types/domain';
import { MemberTaskTrackingBoard } from './MemberTaskTrackingBoard';
import { resolveMemberTaskDisplayStatus } from './useMemberWorkloadState';

type TaskStatusFilter = 'all' | TaskSummaryModel['status'];
type TaskSortMode = 'dueDate' | 'priority' | 'effort';

interface MemberDashboardWorkspaceProps {
  data: MemberWorkloadDetailsModel;
  filteredTasks: TaskSummaryModel[];
  taskStatusFilter: TaskStatusFilter;
  taskSortMode: TaskSortMode;
  activeTab: 'overview' | 'workload' | 'history';
  memberActionError: string | null;
  memberActionSuccess: string | null;
  updatingTaskId: string | null;
  deleteSuccess: string | null;
  deleteError: string | null;
  onOpenFilterMenu: (anchor: HTMLElement) => void;
  onOpenSortMenu: (anchor: HTMLElement) => void;
  onClearTaskStatusFilter: () => void;
  onDismissDeleteSuccess: () => void;
  onDismissDeleteError: () => void;
  onRequestDelete: (task: TaskSummaryModel) => void;
  onUpdateTaskStatus: (task: TaskSummaryModel, status: TaskSummaryModel['status']) => Promise<void>;
  formatHistoryDate: (value: string) => string;
}

export const sectionPaperSx: SxProps<Theme> = {
  p: { xs: 2.5, md: 3 },
  borderRadius: '18px',
  border: '1px solid',
  borderColor: alpha('#cbd5e1', 0.65),
  background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,255,0.97) 100%)',
  boxShadow: 'none',
} as const;

export function MemberDashboardWorkspace({
  data,
  filteredTasks,
  taskStatusFilter,
  taskSortMode,
  activeTab,
  memberActionError,
  memberActionSuccess,
  updatingTaskId,
  deleteSuccess,
  deleteError,
  onOpenFilterMenu,
  onOpenSortMenu,
  onClearTaskStatusFilter,
  onDismissDeleteSuccess,
  onDismissDeleteError,
  onRequestDelete,
  onUpdateTaskStatus,
  formatHistoryDate,
}: MemberDashboardWorkspaceProps) {
  if (activeTab === 'history') {
    return <HistoryPanel items={data.history} formatHistoryDate={formatHistoryDate} />;
  }

  if (activeTab === 'workload') {
    return <WorkloadInsightsPanel data={data} filteredTasks={filteredTasks} />;
  }

  return (
    <Stack spacing={3}>
      {memberActionSuccess ? <Alert severity="success">{memberActionSuccess}</Alert> : null}
      {memberActionError ? <Alert severity="error">{memberActionError}</Alert> : null}

      <MemberHeroPanel data={data} />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <SummaryCard
          label="Total Tasks"
          value={String(data.totalTasks)}
          caption={getTaskDeltaLabel(data.taskDeltaFromPreviousPeriod)}
          accent={workloadMetricColors.totalTasks}
          borderColor="#d8e4fb"
          icon={<TrackChangesRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <SummaryCard
          label="Effort Hours"
          value={`${data.totalEffortHours}h`}
          caption={`${Math.round(data.totalEffortHours / Math.max(data.totalTasks, 1)) || 0}h average per task`}
          accent={workloadMetricColors.effortHours}
          borderColor="#d7e6f9"
          icon={<AccessTimeRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <SummaryCard
          label="Workload Weight"
          value={`${data.capacityPercentage}%`}
          caption={data.insight}
          accent={getWorkloadWeightMetricColors(data.capacityPercentage).accent}
          borderColor={getWorkloadWeightMetricColors(data.capacityPercentage).borderColor}
          icon={<CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <SummaryCard
          label="Current Status"
          value={data.status === 'Overloaded' ? 'Over Capacity' : data.status}
          caption={`${data.blockedTasks} blocked | ${data.criticalTasks} critical`}
          accent={getMemberStatusAccent(data.status)}
          borderColor={alpha(getMemberStatusAccent(data.status), 0.22)}
          icon={<FlagRoundedIcon sx={{ fontSize: 18 }} />}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(320px, 0.95fr)' },
          alignItems: 'start',
        }}
      >
        <WorkloadInsightsPanel data={data} filteredTasks={filteredTasks} />
        <MemberFocusPanel data={data} filteredTasks={filteredTasks} />
      </Box>

      <MemberTaskTrackingBoard
        tasks={data.tasks}
        updatingTaskId={updatingTaskId}
        onUpdateTaskStatus={onUpdateTaskStatus}
        sectionPaperSx={sectionPaperSx}
        eyebrowSx={eyebrowSx}
      />

      <Paper sx={sectionPaperSx}>
        <ActiveTasksSection
          tasks={filteredTasks}
          canDeleteTask={false}
          canEditTask={false}
          taskStatusFilter={taskStatusFilter}
          taskSortMode={taskSortMode}
          deleteSuccess={deleteSuccess}
          deleteError={deleteError}
          onOpenFilterMenu={onOpenFilterMenu}
          onOpenSortMenu={onOpenSortMenu}
          onClearTaskStatusFilter={onClearTaskStatusFilter}
          onDismissDeleteSuccess={onDismissDeleteSuccess}
          onDismissDeleteError={onDismissDeleteError}
          onRequestDelete={onRequestDelete}
        />
      </Paper>

      <Alert severity="info" sx={{ borderRadius: 3 }}>
        Use the task board for quick scanning and open any task to acknowledge work, review history, or submit a change request.
      </Alert>
    </Stack>
  );
}

export function MemberDashboardOverview({
  data,
  filteredTasks,
}: {
  data: MemberWorkloadDetailsModel;
  filteredTasks: TaskSummaryModel[];
}) {
  return (
    <Stack spacing={3}>
      <MemberHeroPanel data={data} />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <SummaryCard
          label="Total Tasks"
          value={String(data.totalTasks)}
          caption={getTaskDeltaLabel(data.taskDeltaFromPreviousPeriod)}
          accent={workloadMetricColors.totalTasks}
          borderColor="#d8e4fb"
          icon={<TrackChangesRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <SummaryCard
          label="Effort Hours"
          value={`${data.totalEffortHours}h`}
          caption={`${Math.round(data.totalEffortHours / Math.max(data.totalTasks, 1)) || 0}h average per task`}
          accent={workloadMetricColors.effortHours}
          borderColor="#d7e6f9"
          icon={<AccessTimeRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <SummaryCard
          label="Workload Weight"
          value={`${data.capacityPercentage}%`}
          caption={data.insight}
          accent={getWorkloadWeightMetricColors(data.capacityPercentage).accent}
          borderColor={getWorkloadWeightMetricColors(data.capacityPercentage).borderColor}
          icon={<CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <SummaryCard
          label="Current Status"
          value={data.status === 'Overloaded' ? 'Over Capacity' : data.status}
          caption={`${data.blockedTasks} blocked | ${data.criticalTasks} critical`}
          accent={getMemberStatusAccent(data.status)}
          borderColor={alpha(getMemberStatusAccent(data.status), 0.22)}
          icon={<FlagRoundedIcon sx={{ fontSize: 18 }} />}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(320px, 0.95fr)' },
          alignItems: 'start',
        }}
      >
        <WorkloadInsightsPanel data={data} filteredTasks={filteredTasks} />
        <MemberFocusPanel data={data} filteredTasks={filteredTasks} />
      </Box>
    </Stack>
  );
}

function MemberHeroPanel({ data }: { data: MemberWorkloadDetailsModel }) {
  const accent = getMemberStatusAccent(data.status);

  return (
    <Paper
      sx={{
        p: { xs: 2.75, md: 3.2 },
        borderRadius: '18px',
        border: '1px solid',
        borderColor: alpha('#c7d2e5', 0.7),
        background:
          'radial-gradient(circle at top right, rgba(96, 165, 250, 0.14), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(243,247,255,0.98) 100%)',
        boxShadow: 'none',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(320px, 0.9fr)' },
          gap: 2.25,
          alignItems: 'stretch',
        }}
      >
        <Stack spacing={2.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Avatar
              sx={{
                width: 78,
                height: 78,
                bgcolor: alpha(accent, 0.12),
                color: accent,
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {data.fullName
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </Avatar>
            <Stack spacing={0.9} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1.1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography sx={{ color: 'text.primary', fontSize: { xs: 28, md: 34 }, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.04em' }}>
                  {data.fullName}
                </Typography>
                <Box
                  sx={{
                    px: 1.35,
                    py: 0.7,
                    borderRadius: '999px',
                    bgcolor: alpha(accent, 0.12),
                    color: accent,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                  }}
                >
                  {data.status === 'Overloaded' ? 'OVER CAPACITY' : data.status.toUpperCase()}
                </Box>
              </Stack>
              <Typography sx={{ color: 'text.primary', fontSize: 17, fontWeight: 600 }}>
                {data.jobTitle}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.7, maxWidth: 720 }}>
                This workspace is scoped to your assignments only. Track delivery pressure, review active work, and monitor the planning window without Team Leader controls.
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
            <MetaCard label="Email" value={data.email} icon={<EmailRoundedIcon sx={{ fontSize: 18 }} />} />
            <MetaCard label="Team" value={data.teamName} icon={<Groups2RoundedIcon sx={{ fontSize: 18 }} />} />
            <MetaCard label="Selected Range" value={formatPeriod(data.startDate, data.endDate)} icon={<CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />} />
            <MetaCard
              label="Delivery Risk"
              value={`Impact score ${data.impactScore}/10`}
              icon={<WarningAmberRoundedIcon sx={{ fontSize: 18 }} />}
              valueColor={accent}
            />
          </Box>
        </Stack>

        <Paper
          sx={{
            ...sectionPaperSx,
            p: { xs: 2.25, md: 2.6 },
            background: 'linear-gradient(180deg, rgba(241,246,255,0.95) 0%, rgba(255,255,255,0.99) 100%)',
          }}
        >
          <Stack spacing={2.1}>
            <Stack spacing={0.7}>
              <Typography sx={eyebrowSx}>Current Planning Window</Typography>
              <Typography sx={{ color: 'text.primary', fontSize: 18, fontWeight: 700, lineHeight: 1.35 }}>
                {data.totalTasks === 0
                  ? 'No scheduled work in this range.'
                  : `${data.totalTasks} active task${data.totalTasks === 1 ? '' : 's'} with ${data.totalWeight.toFixed(1)} workload weight.`}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 13.5, lineHeight: 1.65 }}>
                {data.insight}
              </Typography>
            </Stack>

            <Stack spacing={1.1}>
              <InfoRow label="Blocked Tasks" value={String(data.blockedTasks)} accent={data.blockedTasks > 0 ? '#c2410c' : '#64748b'} />
              <InfoRow label="Critical Tasks" value={String(data.criticalTasks)} accent={data.criticalTasks > 0 ? '#b91c1c' : '#64748b'} />
              <InfoRow label="Workload Capacity" value={`${data.capacityPercentage}%`} accent={accent} />
              <InfoRow label="Window" value={formatPeriod(data.startDate, data.endDate)} accent="#1d4ed8" />
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Paper>
  );
}

function MemberFocusPanel({ data, filteredTasks }: { data: MemberWorkloadDetailsModel; filteredTasks: TaskSummaryModel[] }) {
  const upcomingTasks = [...filteredTasks]
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())
    .slice(0, 3);

  return (
    <Paper sx={sectionPaperSx}>
      <Stack spacing={2.2}>
        <Stack spacing={0.55}>
          <Typography sx={eyebrowSx}>Execution Focus</Typography>
          <Typography sx={{ color: 'text.primary', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Immediate priorities
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13.5, lineHeight: 1.65 }}>
            Scan near-term delivery risk and the next work items due in your current window.
          </Typography>
        </Stack>

        <Paper
          sx={{
            p: 1.8,
            borderRadius: '18px',
            border: '1px solid',
            borderColor: alpha('#cad7ea', 0.8),
            bgcolor: alpha(appColors.light.background.accent, 0.82),
            boxShadow: 'none',
          }}
        >
          <Stack spacing={1.15}>
            <Typography sx={eyebrowSx}>Status Snapshot</Typography>
            <InfoRow label="Due Soon" value={String(upcomingTasks.length)} accent="#2563eb" />
            <InfoRow
              label="Open Work"
              value={String(filteredTasks.filter((task) => resolveMemberTaskDisplayStatus(task) !== 'Done').length)}
              accent="#0f766e"
            />
            <InfoRow
              label="Completed"
              value={String(filteredTasks.filter((task) => resolveMemberTaskDisplayStatus(task) === 'Done').length)}
              accent="#15803d"
            />
          </Stack>
        </Paper>

        <Stack spacing={1.2}>
          <Typography sx={eyebrowSx}>Upcoming Tasks</Typography>
          {upcomingTasks.length === 0 ? (
            <Paper
              sx={{
                p: 2,
                borderRadius: '18px',
                border: '1px dashed',
                borderColor: alpha('#9fb1ce', 0.75),
                bgcolor: alpha('#f8fbff', 0.85),
                boxShadow: 'none',
              }}
            >
              <Typography sx={{ color: 'text.secondary', fontSize: 13.5 }}>
                No upcoming tasks in this range.
              </Typography>
            </Paper>
          ) : (
            upcomingTasks.map((task) => (
              <Paper
                key={task.id}
                sx={{
                  p: 1.7,
                  borderRadius: '18px',
                  border: '1px solid',
                  borderColor: alpha('#d7e1f0', 0.95),
                  bgcolor: '#fff',
                  boxShadow: 'none',
                }}
              >
                <Stack spacing={0.85}>
                  <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
                    <Typography sx={{ color: 'text.primary', fontSize: 14.5, lineHeight: 1.45, fontWeight: 700 }}>
                      {task.title}
                    </Typography>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.45,
                        borderRadius: '999px',
                        bgcolor: alpha(resolvePriorityAccent(task.priority), 0.12),
                        color: resolvePriorityAccent(task.priority),
                        fontSize: 11.5,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.priority}
                    </Box>
                  </Stack>
                  <Typography sx={{ color: 'text.secondary', fontSize: 12.75 }}>
                    Due {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(task.dueDate))}
                  </Typography>
                  <Typography sx={{ color: '#5d6b82', fontSize: 12.75 }}>
                    {task.estimatedEffortHours}h effort | {task.calculatedWeight.toFixed(1)} weight | {resolveMemberTaskDisplayStatus(task)}
                  </Typography>
                  <MuiLink
                    component={Link}
                    to={`/tasks/${task.id}`}
                    underline="none"
                    sx={{
                      width: 'fit-content',
                      color: 'primary.main',
                      fontSize: 12.5,
                      fontWeight: 700,
                      '&:hover': {
                        color: 'primary.dark',
                      },
                    }}
                  >
                    Open task details
                  </MuiLink>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  accent,
  borderColor,
  icon,
}: {
  label: string;
  value: string;
  caption: string;
  accent: string;
  borderColor: string;
  icon: React.ReactNode;
}) {
  return (
    <Paper
      sx={{
        p: 2.2,
        borderRadius: '18px',
        border: '1px solid',
        borderColor,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(249,251,255,0.97) 100%)',
        boxShadow: 'none',
        minHeight: 142,
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={eyebrowSx}>{label}</Typography>
          <Box sx={{ color: accent }}>{icon}</Box>
        </Stack>
        <Typography sx={{ color: accent, fontSize: 28, lineHeight: 1.08, fontWeight: 700, letterSpacing: '-0.03em' }}>
          {value}
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: 12.5, lineHeight: 1.6 }}>
          {caption}
        </Typography>
      </Stack>
    </Paper>
  );
}

function MetaCard({
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
    <Paper
      sx={{
        p: 1.7,
        borderRadius: '18px',
        border: '1px solid',
        borderColor: alpha('#d5e0ef', 0.9),
        bgcolor: alpha('#ffffff', 0.88),
        boxShadow: 'none',
      }}
    >
      <Stack direction="row" spacing={1.2} alignItems="flex-start">
        <Box
          sx={{
            width: 38,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '14px',
            bgcolor: alpha('#dbeafe', 0.92),
            color: '#3560b5',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
          <Typography sx={eyebrowSx}>{label}</Typography>
          <Typography sx={{ color: valueColor, fontSize: 14, fontWeight: 600, lineHeight: 1.45, wordBreak: 'break-word' }}>
            {value}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography sx={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ color: accent, fontSize: 13.5, fontWeight: 700, textAlign: 'right' }}>{value}</Typography>
    </Stack>
  );
}

function formatPeriod(startDate: string, endDate: string) {
  return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(startDate))} - ${new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(endDate))}`;
}

function getTaskDeltaLabel(taskDeltaFromPreviousPeriod: number) {
  if (taskDeltaFromPreviousPeriod === 0) {
    return 'No change from the previous period';
  }

  return `${taskDeltaFromPreviousPeriod > 0 ? '+' : ''}${taskDeltaFromPreviousPeriod} from the previous period`;
}

function resolvePriorityAccent(priority: TaskSummaryModel['priority']) {
  switch (priority) {
    case 'Critical':
      return '#b91c1c';
    case 'High':
      return '#c2410c';
    case 'Medium':
      return '#2563eb';
    case 'Low':
    default:
      return '#64748b';
  }
}

export const eyebrowSx: SxProps<Theme> = {
  color: '#64748b',
  fontSize: 11.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.7,
};
