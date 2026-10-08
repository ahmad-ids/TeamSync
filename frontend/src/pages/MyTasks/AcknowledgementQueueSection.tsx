import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
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

interface AcknowledgementQueueSectionProps {
  tasks: TaskSummaryModel[];
  updatingTaskId: string | null;
  onAcknowledgeTask: (task: TaskSummaryModel) => Promise<void>;
  sectionPaperSx: SxProps<Theme>;
  eyebrowSx: SxProps<Theme>;
}

export function AcknowledgementQueueSection({
  tasks,
  updatingTaskId,
  onAcknowledgeTask,
  sectionPaperSx,
  eyebrowSx,
}: AcknowledgementQueueSectionProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <Paper
      sx={{
        ...sectionPaperSx,
        p: { xs: 2.25, md: 2.5 },
        borderColor: alpha('#cbd5e1', 0.72),
        background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.96) 100%)',
      }}
    >
      <Stack spacing={1.8}>
        <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '12px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha('#f59e0b', 0.1),
                color: '#b45309',
                flexShrink: 0,
              }}
            >
              <WarningAmberRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ ...eyebrowSx, color: '#9a5b05' }}>Needs Acknowledgement</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 13, lineHeight: 1.45 }}>
                Pending assignments waiting for your confirmation.
              </Typography>
            </Box>
          </Stack>
          <Chip
            label={`${tasks.length} pending`}
            size="small"
            sx={{
              height: 28,
              borderRadius: '999px',
              bgcolor: alpha('#f59e0b', 0.1),
              color: '#9a5b05',
              fontWeight: 700,
            }}
          />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 1.1,
            gridTemplateColumns: '1fr',
          }}
        >
          {tasks.map((task) => (
            <Paper
              key={task.id}
              sx={{
                p: { xs: 1.5, sm: 1.65 },
                borderRadius: '16px',
                border: '1px solid',
                borderColor: alpha('#cbd5e1', 0.8),
                bgcolor: '#fff',
                boxShadow: 'none',
              }}
            >
              <Stack spacing={1.15}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.25}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', md: 'center' }}
                >
                  <Stack spacing={0.55} sx={{ minWidth: 0, flex: 1 }}>
                    <MuiLink
                      component={Link}
                      to={`/tasks/${task.id}`}
                      underline="none"
                      sx={{
                        color: 'text.primary',
                        fontSize: 15.25,
                        fontWeight: 700,
                        lineHeight: 1.35,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '&:hover': {
                          color: 'primary.main',
                        },
                      }}
                    >
                      {task.title}
                    </MuiLink>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                      <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>
                        Due {formatDueDate(task.dueDate)}
                      </Typography>
                      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#cbd5e1' }} />
                      <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>
                        {task.estimatedEffortHours}h effort
                      </Typography>
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={0.9} useFlexGap flexWrap="wrap" sx={{ flexShrink: 0 }}>
                    <Chip
                      label={task.priority}
                      size="small"
                      sx={{
                        height: 28,
                        borderRadius: '999px',
                        fontWeight: 700,
                        bgcolor: priorityColors[task.priority].bg,
                        color: priorityColors[task.priority].color,
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AssignmentTurnedInRoundedIcon />}
                      disabled={updatingTaskId === task.id}
                      onClick={() => void onAcknowledgeTask(task)}
                      sx={{
                        minHeight: 34,
                        px: 1.7,
                        borderRadius: '999px',
                        textTransform: 'none',
                        fontSize: 12.25,
                        fontWeight: 700,
                        boxShadow: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {updatingTaskId === task.id ? 'Acknowledging...' : 'Acknowledge'}
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Stack>
    </Paper>
  );
}

const priorityColors: Record<TaskSummaryModel['priority'], { bg: string; color: string }> = {
  Low: { bg: '#eef2f7', color: '#5f6d82' },
  Medium: { bg: '#f8f1de', color: '#8b6a08' },
  High: { bg: '#fde9e8', color: '#c03d33' },
  Critical: { bg: '#ffe0df', color: '#a92a21' },
};

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
}
