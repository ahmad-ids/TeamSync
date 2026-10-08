import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import {
  Box,
  Chip,
  IconButton,
  Link as MuiLink,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { appColors } from '../../theme/theme';
import type { TaskSummaryModel } from '../../types/domain';
import { resolveMemberTaskDisplayStatus } from '../../pages/MemberDashboard/useMemberWorkloadState';

interface MemberTaskListProps {
  tasks: TaskSummaryModel[];
  onRequestDelete?: (task: TaskSummaryModel) => void;
  showDeleteAction?: boolean;
  showEditAction?: boolean;
}

const statusStyles: Record<TaskSummaryModel['status'], { label: string; background: string; color: string }> = {
  New: { label: 'To Do', background: '#eef2ff', color: '#4964d8' },
  InProgress: { label: 'In Progress', background: '#e7f0ff', color: '#325ea8' },
  Blocked: { label: 'Blocked', background: '#fdecec', color: '#c73d36' },
  Done: { label: 'Done', background: '#e8f7ef', color: '#17754e' },
};

const priorityStyles: Record<TaskSummaryModel['priority'], { background: string; color: string }> = {
  Low: { background: '#f3f4f6', color: '#5b6474' },
  Medium: { background: '#f8f1de', color: '#8b6a08' },
  High: { background: '#fde9e8', color: '#c03d33' },
  Critical: { background: '#ffe0df', color: '#a92a21' },
};

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export function MemberTaskList({
  tasks,
  onRequestDelete,
  showDeleteAction = false,
  showEditAction = true,
}: MemberTaskListProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskSummaryModel | null>(null);
  const hasMenuActions = showEditAction || (showDeleteAction && Boolean(onRequestDelete));

  function openTaskMenu(event: React.MouseEvent<HTMLElement>, task: TaskSummaryModel) {
    setMenuAnchor(event.currentTarget);
    setSelectedTask(task);
  }

  function closeTaskMenu() {
    setMenuAnchor(null);
    setSelectedTask(null);
  }

  return (
    <>
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: appColors.light.border.default,
          boxShadow: 'none',
          backgroundColor: appColors.light.background.paper,
        }}
      >
        <Table size="medium">
          <TableHead>
            <TableRow
              sx={(theme) => ({
                backgroundColor: theme.palette.mode === 'dark' ? alpha('#182a42', 0.9) : '#f8fbff',
                '& .MuiTableCell-root': {
                  borderBottomColor: '#e6edf8',
                },
              })}
            >
              {['Task Title', 'Status', 'Priority', 'Effort/Wt', 'Due Date', ''].map((label) => (
                <TableCell
                  key={label}
                sx={{
                  color: 'text.secondary',
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                    py: 1.6,
                  }}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((task) => {
              const displayStatus = resolveMemberTaskDisplayStatus(task);
              const statusStyle = statusStyles[displayStatus];
              const priorityStyle = priorityStyles[task.priority];

              return (
                <TableRow
                  key={task.id}
                  hover
                  sx={{
                    '& .MuiTableCell-root': {
                      borderBottomColor: '#edf2f8',
                    },
                    '&:last-child .MuiTableCell-root': {
                      borderBottom: 'none',
                    },
                  }}
                >
                  <TableCell sx={{ py: 2.15, pr: 1.5 }}>
                    <Stack spacing={0.5}>
                      <MuiLink
                        component={Link}
                        to={`/tasks/${task.id}`}
                        underline="none"
                      sx={{
                        color: 'text.primary',
                        fontFamily: '"Cabin Condensed", sans-serif',
                        fontWeight: 600,
                        fontSize: 15.5,
                        lineHeight: 1.35,
                          transition: 'color 120ms ease',
                          '&:hover': {
                            color: 'primary.main',
                          },
                        }}
                      >
                        {task.title}
                      </MuiLink>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12.5, fontFamily: '"Cabin Condensed", sans-serif', letterSpacing: '0.01em' }}>
                        {task.complexity} complexity
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusStyle.label}
                      size="small"
                      sx={{
                        backgroundColor: statusStyle.background,
                        color: statusStyle.color,
                        fontWeight: 600,
                        borderRadius: '999px',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={task.priority.toUpperCase()}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: priorityStyle.background,
                        backgroundColor: priorityStyle.background,
                        color: priorityStyle.color,
                        fontWeight: 600,
                        borderRadius: '999px',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.4}>
                      <Typography sx={{ color: 'text.primary', fontWeight: 600, fontSize: 15, fontFamily: '"Cabin Condensed", sans-serif' }}>
                        {task.estimatedEffortHours}h
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12.5, fontFamily: '"Cabin Condensed", sans-serif', letterSpacing: '0.01em' }}>
                        Wt. {task.calculatedWeight}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 500, fontSize: 14.5, fontFamily: '"Cabin Condensed", sans-serif' }}>
                    {formatDueDate(task.dueDate)}
                  </TableCell>
                  <TableCell align="right" sx={{ width: 72 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title="Open task details">
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/tasks/${task.id}`}
                          sx={{
                            color: 'text.secondary',
                            borderRadius: '10px',
                            '&:hover': {
                              bgcolor: appColors.light.background.accent,
                              color: 'text.primary',
                            },
                          }}
                        >
                          <OpenInNewRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {hasMenuActions ? (
                        <Tooltip title="Task actions">
                          <IconButton
                            size="small"
                            onClick={(event) => openTaskMenu(event, task)}
                            sx={{
                              color: 'text.secondary',
                              borderRadius: '10px',
                              '&:hover': {
                                bgcolor: appColors.light.background.accent,
                                color: 'text.primary',
                              },
                            }}
                          >
                            <MoreHorizRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {hasMenuActions ? (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor && selectedTask)}
          onClose={closeTaskMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: {
                mt: 0.75,
                minWidth: 188,
                borderRadius: '14px',
                border: '1px solid',
                borderColor: appColors.light.border.default,
                boxShadow: '0 14px 36px rgba(15, 23, 42, 0.12)',
              },
            },
          }}
        >
          {showEditAction ? (
            <MenuItem component={Link} to={selectedTask ? `/tasks/${selectedTask.id}/edit` : '/'} onClick={closeTaskMenu}>
              <ListItemIcon>
                <EditRoundedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Edit task" />
            </MenuItem>
          ) : null}
          {showDeleteAction && onRequestDelete ? (
            <MenuItem
              onClick={() => {
                const currentTask = selectedTask;
                closeTaskMenu();
                if (currentTask) {
                  onRequestDelete(currentTask);
                }
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Delete task" />
            </MenuItem>
          ) : null}
        </Menu>
      ) : null}
    </>
  );
}
