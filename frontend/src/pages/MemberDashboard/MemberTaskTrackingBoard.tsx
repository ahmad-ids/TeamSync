import {
  Box,
  Button,
  Chip,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
  type SxProps,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import type { TaskSummaryModel } from '../../types/domain';
import { resolveMemberTaskDisplayStatus } from './useMemberWorkloadState';

interface MemberTaskTrackingBoardProps {
  tasks: TaskSummaryModel[];
  updatingTaskId: string | null;
  onAcknowledgeTask?: (task: TaskSummaryModel) => Promise<void>;
  onUpdateTaskStatus: (task: TaskSummaryModel, status: TaskSummaryModel['status']) => Promise<void>;
  sectionPaperSx: SxProps<Theme>;
  eyebrowSx: SxProps<Theme>;
}

export function MemberTaskTrackingBoard({
  tasks,
  updatingTaskId,
  onAcknowledgeTask,
  onUpdateTaskStatus,
  sectionPaperSx,
  eyebrowSx,
}: MemberTaskTrackingBoardProps) {
  const columns: {
    status: TaskSummaryModel['status'];
    title: string;
    accent: string;
    tint: string;
    border: string;
    chipTint: string;
  }[] = [
    {
      status: 'New',
      title: 'To Do',
      accent: '#4964d8',
      tint: '#f4f8ff',
      border: '#d5e2ff',
      chipTint: '#e8efff',
    },
    {
      status: 'InProgress',
      title: 'In Progress',
      accent: '#2f6bda',
      tint: '#f3f8ff',
      border: '#d7e7ff',
      chipTint: '#e7f0ff',
    },
    {
      status: 'Blocked',
      title: 'Blocked',
      accent: '#c2410c',
      tint: '#fff5f1',
      border: '#ffd8cf',
      chipTint: '#ffe9e2',
    },
    {
      status: 'Done',
      title: 'Done',
      accent: '#15803d',
      tint: '#f2fbf6',
      border: '#d7eedf',
      chipTint: '#e7f7ee',
    },
  ];

  return (
    <Paper sx={sectionPaperSx}>
      <Stack spacing={2}>
        <Stack spacing={0.45}>
          <Typography sx={eyebrowSx}>Task Tracking</Typography>
          <Typography sx={{ color: 'text.primary', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Personal task board
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>
            Compact view of active work across each status column.
          </Typography>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          {columns.map((column) => {
            const columnTasks = tasks
              .filter((task) => resolveMemberTaskDisplayStatus(task) === column.status)
              .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());

            return (
              <Paper
                key={column.status}
                sx={{
                  p: 1.45,
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: alpha(column.border, 0.95),
                  bgcolor: alpha(column.tint, 0.95),
                  boxShadow: 'none',
                  minHeight: 248,
                }}
              >
                <Stack spacing={1.05} sx={{ height: '100%' }}>
                  <Stack spacing={0.45}>
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                      <Typography sx={{ color: column.accent, fontSize: 14.5, fontWeight: 700 }}>
                        {column.title}
                      </Typography>
                      <Box
                        sx={{
                          minWidth: 28,
                          px: 0.85,
                          py: 0.3,
                          borderRadius: '999px',
                          bgcolor: alpha(column.accent, 0.1),
                          color: column.accent,
                          fontSize: 11.5,
                          fontWeight: 700,
                          textAlign: 'center',
                        }}
                      >
                        {columnTasks.length}
                      </Box>
                    </Stack>
                  </Stack>

                  <Stack spacing={0.9} sx={{ flexGrow: 1 }}>
                    {columnTasks.length === 0 ? (
                      <Paper
                        sx={{
                          p: 1.4,
                          borderRadius: '14px',
                          border: '1px dashed',
                          borderColor: alpha(column.border, 0.95),
                          bgcolor: alpha('#ffffff', 0.65),
                          boxShadow: 'none',
                        }}
                      >
                        <Typography sx={{ color: '#7b8798', fontSize: 12.25, lineHeight: 1.55 }}>
                          No tasks in this status right now.
                        </Typography>
                      </Paper>
                    ) : (
                      columnTasks.map((task) => (
                        <Paper
                          key={task.id}
                          sx={{
                            p: 1.4,
                            borderRadius: '14px',
                            border: '1px solid',
                            borderColor: alpha(column.border, 0.95),
                            bgcolor: '#fff',
                            boxShadow: 'none',
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                              <MuiLink
                                component={Link}
                                to={`/tasks/${task.id}`}
                                underline="none"
                                sx={{
                                  color: 'text.primary',
                                  fontSize: 13.9,
                                  lineHeight: 1.35,
                                  fontWeight: 700,
                                  minWidth: 0,
                                  flex: 1,
                                  transition: 'color 120ms ease',
                                  '&:hover': {
                                    color: 'primary.main',
                                  },
                                }}
                              >
                                {task.title}
                              </MuiLink>
                              {!task.isAcknowledged ? (
                                <Chip
                                  label="Needs ack"
                                  size="small"
                                  sx={{
                                    height: 26,
                                    borderRadius: '999px',
                                    bgcolor: alpha('#f59e0b', 0.1),
                                    color: '#9a5b05',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                />
                              ) : (
                                <Chip
                                  label={column.status === 'Done' ? 'Complete' : 'Active'}
                                  size="small"
                                  sx={{
                                    height: 26,
                                    borderRadius: '999px',
                                    bgcolor: alpha(column.chipTint, 0.95),
                                    color: column.accent,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </Stack>

                            <Stack
                              direction="row"
                              spacing={1}
                              useFlexGap
                              flexWrap="wrap"
                              alignItems="center"
                              sx={{ color: 'text.secondary', fontSize: 12.1, lineHeight: 1.45 }}
                            >
                              <Typography sx={{ color: 'inherit', fontSize: 'inherit' }}>
                                Due {formatDueDate(task.dueDate)}
                              </Typography>
                              <DotSeparator />
                              <Typography sx={{ color: 'inherit', fontSize: 'inherit' }}>
                                {task.estimatedEffortHours}h effort
                              </Typography>
                              <DotSeparator />
                              <Typography sx={{ color: 'inherit', fontSize: 'inherit' }}>
                                {task.calculatedWeight.toFixed(1)} weight
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                              <Chip
                                label={task.priority}
                                size="small"
                                sx={{
                                  height: 26,
                                  borderRadius: '999px',
                                  fontWeight: 700,
                                  bgcolor: priorityColors[task.priority].bg,
                                  color: priorityColors[task.priority].color,
                                }}
                              />
                              {!task.isAcknowledged && onAcknowledgeTask ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={updatingTaskId === task.id}
                                  onClick={() => void onAcknowledgeTask(task)}
                                  sx={{
                                    minHeight: 30,
                                    px: 1.35,
                                    borderRadius: '999px',
                                    textTransform: 'none',
                                    fontSize: 11.75,
                                    fontWeight: 700,
                                    boxShadow: 'none',
                                    bgcolor: '#1f5fd3',
                                    '&:hover': {
                                      bgcolor: '#1b52b8',
                                    },
                                  }}
                                >
                                  {updatingTaskId === task.id ? 'Acknowledging...' : 'Acknowledge'}
                                </Button>
                              ) : resolveNextStatuses(task.status).length === 0 ? (
                                <Typography sx={{ color: '#7b8798', fontSize: 11.5, fontWeight: 600 }}>
                                  Final status reached
                                </Typography>
                              ) : (
                                resolveNextStatuses(task.status).map((status) => (
                                  <Button
                                    key={status}
                                    size="small"
                                    variant={status === resolveNextStatuses(task.status)[0] ? 'contained' : 'outlined'}
                                    disabled={updatingTaskId === task.id}
                                    onClick={() => void onUpdateTaskStatus(task, status)}
                                    sx={{
                                      minHeight: 30,
                                      px: 1.35,
                                      borderRadius: '999px',
                                      textTransform: 'none',
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      boxShadow: 'none',
                                    }}
                                  >
                                    {updatingTaskId === task.id
                                      ? 'Updating...'
                                      : status === 'InProgress'
                                        ? 'Start'
                                        : status === 'Blocked'
                                          ? 'Block'
                                          : 'Done'}
                                  </Button>
                                ))
                              )}
                            </Stack>
                          </Stack>
                        </Paper>
                      ))
                    )}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      </Stack>
    </Paper>
  );
}

function resolveNextStatuses(status: TaskSummaryModel['status']) {
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

const priorityColors: Record<TaskSummaryModel['priority'], { bg: string; color: string }> = {
  Low: { bg: '#eef4ff', color: '#4f6ec9' },
  Medium: { bg: '#e8f1ff', color: '#2f6bda' },
  High: { bg: '#ffe9e2', color: '#c2410c' },
  Critical: { bg: '#ffe0df', color: '#b42318' },
};

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function DotSeparator() {
  return <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#cbd5e1', flexShrink: 0 }} />;
}
