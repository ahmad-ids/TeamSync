import { Alert, CircularProgress } from '@mui/material';
import styled from 'styled-components';
import { MemberAccessState } from './MemberAccessState';
import { MemberDashboardOverview } from './MemberDashboardWorkspace';
import { MemberPageFrame } from './MemberPageFrame';
import { useMemberWorkloadState } from './useMemberWorkloadState';

export function MemberDashboardPage() {
  const {
    data,
    isLoading,
    error,
    accessDeniedMessage,
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    filteredTasks,
  } = useMemberWorkloadState();

  if (isLoading && !data) {
    return (
      <LoadingShell>
        <CircularProgress />
      </LoadingShell>
    );
  }

  if (accessDeniedMessage && !data) {
    return <MemberAccessState message={accessDeniedMessage} />;
  }

  if (error && !data) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <MemberPageFrame
      title="Member Dashboard"
      description="Review your workload posture, planning window, and delivery signals in one overview before drilling into task execution."
      period={period}
      onPeriodChange={setPeriod}
      customStartDate={customStartDate}
      customEndDate={customEndDate}
      onCustomStartDateChange={setCustomStartDate}
      onCustomEndDateChange={setCustomEndDate}
      warningMessage={error && data ? error : null}
      infoMessage={period === 'custom' && (!customStartDate || !customEndDate)
        ? 'Choose a start and end date to view a custom planning window.'
        : null}
    >
      {data ? <MemberDashboardOverview data={data} filteredTasks={filteredTasks} /> : null}
    </MemberPageFrame>
  );
}

// Styled components
const LoadingShell = styled.div`
  min-height: 360px;
  display: grid;
  place-items: center;
`;
