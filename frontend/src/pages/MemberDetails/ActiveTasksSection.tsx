import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { MemberTaskList } from '../../components/members/MemberTaskList';
import { appColors } from '../../theme/theme';
import type { TaskSummaryModel } from '../../types/domain';

type TaskStatusFilter = 'all' | TaskSummaryModel['status'];
type TaskSortMode = 'dueDate' | 'priority' | 'effort';

interface ActiveTasksSectionProps {
  tasks: TaskSummaryModel[];
  canDeleteTask: boolean;
  canEditTask?: boolean;
  taskStatusFilter: TaskStatusFilter;
  taskSortMode: TaskSortMode;
  deleteSuccess: string | null;
  deleteError: string | null;
  onOpenFilterMenu: (anchor: HTMLElement) => void;
  onOpenSortMenu: (anchor: HTMLElement) => void;
  onClearTaskStatusFilter: () => void;
  onDismissDeleteSuccess: () => void;
  onDismissDeleteError: () => void;
  onRequestDelete: (task: TaskSummaryModel) => void;
}

const sectionPaperSx = {
  p: { xs: 2.5, md: 3 },
  borderRadius: '16px',
  boxShadow: 'none',
} as const;

export function ActiveTasksSection({
  tasks,
  canDeleteTask,
  canEditTask = true,
  taskStatusFilter,
  taskSortMode,
  deleteSuccess,
  deleteError,
  onOpenFilterMenu,
  onOpenSortMenu,
  onClearTaskStatusFilter,
  onDismissDeleteSuccess,
  onDismissDeleteError,
  onRequestDelete,
}: ActiveTasksSectionProps) {
  return (
    <Box
      sx={{
        px: { xs: 0, md: 0 },
        py: { xs: 0, md: 0 },
      }}
    >
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'flex-start', lg: 'flex-start' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.45} sx={{ maxWidth: 560 }}>
            <Typography sx={{ color: 'text.primary', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Active Tasks
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13.5, lineHeight: 1.65 }}>
              Current work items in the selected period for this member.
            </Typography>
          </Stack>

          <Stack spacing={1.15} alignItems={{ xs: 'stretch', lg: 'flex-end' }} sx={{ width: { xs: '100%', lg: 'auto' } }}>
            <Stack direction="row" spacing={0.75} justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
              <Button
                type="button"
                variant="outlined"
                startIcon={<FilterListRoundedIcon fontSize="small" />}
                onClick={(event) => onOpenFilterMenu(event.currentTarget)}
                sx={{
                  minHeight: 40,
                  width: 'fit-content',
                  px: 1.7,
                  borderRadius: '11px',
                  borderColor: appColors.light.border.default,
                  backgroundColor: appColors.light.background.paper,
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                Filter
              </Button>
              <Button
                type="button"
                variant="outlined"
                startIcon={<TuneRoundedIcon fontSize="small" />}
                onClick={(event) => onOpenSortMenu(event.currentTarget)}
                sx={{
                  minHeight: 40,
                  width: 'fit-content',
                  px: 1.7,
                  borderRadius: '11px',
                  borderColor: appColors.light.border.default,
                  backgroundColor: appColors.light.background.paper,
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                Sort
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
              <Chip
                label={taskStatusFilter === 'all' ? 'All statuses' : `Status: ${taskStatusFilter}`}
                onDelete={taskStatusFilter === 'all' ? undefined : onClearTaskStatusFilter}
                sx={{
                  borderRadius: '999px',
                  bgcolor: appColors.light.background.accent,
                  color: 'text.secondary',
                  fontWeight: 600,
                }}
              />
              <Chip
                label={taskSortMode === 'dueDate' ? 'Sorted by due date' : taskSortMode === 'priority' ? 'Sorted by priority' : 'Sorted by effort'}
                sx={{
                  borderRadius: '999px',
                  bgcolor: appColors.light.background.paper,
                  border: '1px solid',
                  borderColor: appColors.light.border.default,
                  color: 'text.secondary',
                  fontWeight: 600,
                }}
              />
            </Stack>
          </Stack>
        </Stack>

        {deleteSuccess ? (
          <Alert severity="success" onClose={onDismissDeleteSuccess}>
            {deleteSuccess}
          </Alert>
        ) : null}
        {deleteError ? (
          <Alert severity="error" onClose={onDismissDeleteError}>
            {deleteError}
          </Alert>
        ) : null}

        {tasks.length === 0 ? (
          <Paper sx={{ ...sectionPaperSx, py: 4, textAlign: 'center', backgroundColor: appColors.light.background.paper }}>
            <Typography sx={{ color: 'text.secondary' }}>No tasks match the current search.</Typography>
          </Paper>
        ) : (
          <Box
            sx={{
              width: '100%',
              px: 0,
              py: 0,
            }}
          >
            <MemberTaskList
              tasks={tasks}
              showEditAction={canEditTask}
              showDeleteAction={canDeleteTask}
              onRequestDelete={onRequestDelete}
            />
          </Box>
        )}
      </Stack>
    </Box>
  );
}
