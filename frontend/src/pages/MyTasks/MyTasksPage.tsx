import {
  Alert,
  Box,
  CircularProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
} from '@mui/material';
import { useState } from 'react';
import { ActiveTasksSection } from '../MemberDetails/ActiveTasksSection';
import { MemberAccessState } from '../MemberDashboard/MemberAccessState';
import { MemberTaskTrackingBoard } from '../MemberDashboard/MemberTaskTrackingBoard';
import { MemberPageFrame } from '../MemberDashboard/MemberPageFrame';
import { sectionPaperSx, eyebrowSx } from '../MemberDashboard/MemberDashboardWorkspace';
import { useMemberWorkloadState } from '../MemberDashboard/useMemberWorkloadState';
import { AcknowledgementQueueSection } from './AcknowledgementQueueSection';

export function MyTasksPage() {
  const {
    data,
    isLoading,
    error,
    accessDeniedMessage,
    memberActionError,
    memberActionSuccess,
    updatingTaskId,
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    taskSearch,
    setTaskSearch,
    taskStatusFilter,
    setTaskStatusFilter,
    taskSortMode,
    setTaskSortMode,
    filteredTasks,
    handleAcknowledgeMemberTask,
    handleUpdateMemberTaskStatus,
  } = useMemberWorkloadState();
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [sortAnchorEl, setSortAnchorEl] = useState<HTMLElement | null>(null);
  const acknowledgementTasks = (data?.tasks ?? [])
    .filter((task) => !task.isAcknowledged)
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());

  if (isLoading && !data) {
    return (
      <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !data) {
    if (accessDeniedMessage) {
      return <MemberAccessState message={accessDeniedMessage} />;
    }

    return <Alert severity="error">{error}</Alert>;
  }

  if (accessDeniedMessage && !data) {
    return <MemberAccessState message={accessDeniedMessage} />;
  }

  return (
    <MemberPageFrame
      title="My Tasks"
      description="Track daily execution, search current assignments, switch status views, and move work forward without leaving the member workflow."
      period={period}
      onPeriodChange={setPeriod}
      customStartDate={customStartDate}
      customEndDate={customEndDate}
      onCustomStartDateChange={setCustomStartDate}
      onCustomEndDateChange={setCustomEndDate}
      searchValue={taskSearch}
      onSearchChange={setTaskSearch}
      searchPlaceholder="Search your tasks..."
      warningMessage={error && data ? error : null}
      infoMessage={period === 'custom' && (!customStartDate || !customEndDate)
        ? 'Choose a start and end date to view a custom planning window.'
        : null}
    >
      <Stack spacing={3}>
        {memberActionSuccess ? <Alert severity="success">{memberActionSuccess}</Alert> : null}
        {memberActionError ? <Alert severity="error">{memberActionError}</Alert> : null}

        {data ? (
          <>
            <AcknowledgementQueueSection
              tasks={acknowledgementTasks}
              updatingTaskId={updatingTaskId}
              onAcknowledgeTask={handleAcknowledgeMemberTask}
              sectionPaperSx={sectionPaperSx}
              eyebrowSx={eyebrowSx}
            />
            <MemberTaskTrackingBoard
              tasks={data.tasks}
              updatingTaskId={updatingTaskId}
              onAcknowledgeTask={handleAcknowledgeMemberTask}
              onUpdateTaskStatus={handleUpdateMemberTaskStatus}
              sectionPaperSx={sectionPaperSx}
              eyebrowSx={eyebrowSx}
            />
          </>
        ) : null}

        <Paper sx={sectionPaperSx}>
          <ActiveTasksSection
            tasks={filteredTasks}
            canDeleteTask={false}
            canEditTask={false}
            taskStatusFilter={taskStatusFilter}
            taskSortMode={taskSortMode}
            deleteSuccess={null}
            deleteError={null}
            onOpenFilterMenu={setFilterAnchorEl}
            onOpenSortMenu={setSortAnchorEl}
            onClearTaskStatusFilter={() => setTaskStatusFilter('all')}
            onDismissDeleteSuccess={() => undefined}
            onDismissDeleteError={() => undefined}
            onRequestDelete={() => undefined}
          />
        </Paper>

        <Alert severity="info" sx={{ borderRadius: 3 }}>
          Acknowledge new assignments here or open a task to review the full activity trail and submit change requests.
        </Alert>
      </Stack>

      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { setTaskStatusFilter('all'); setFilterAnchorEl(null); }}>All tasks</MenuItem>
        <MenuItem onClick={() => { setTaskStatusFilter('New'); setFilterAnchorEl(null); }}>New</MenuItem>
        <MenuItem onClick={() => { setTaskStatusFilter('InProgress'); setFilterAnchorEl(null); }}>In progress</MenuItem>
        <MenuItem onClick={() => { setTaskStatusFilter('Blocked'); setFilterAnchorEl(null); }}>Blocked</MenuItem>
        <MenuItem onClick={() => { setTaskStatusFilter('Done'); setFilterAnchorEl(null); }}>Done</MenuItem>
      </Menu>

      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={() => setSortAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { setTaskSortMode('dueDate'); setSortAnchorEl(null); }}>Sort by due date</MenuItem>
        <MenuItem onClick={() => { setTaskSortMode('priority'); setSortAnchorEl(null); }}>Sort by priority</MenuItem>
        <MenuItem onClick={() => { setTaskSortMode('effort'); setSortAnchorEl(null); }}>Sort by effort</MenuItem>
      </Menu>
    </MemberPageFrame>
  );
}
