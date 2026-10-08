import { Alert, CircularProgress } from '@mui/material';
import styled from 'styled-components';
import { HistoryPanel } from '../MemberDetails/MemberDetailsSections';
import { MemberAccessState } from '../MemberDashboard/MemberAccessState';
import { MemberPageFrame } from '../MemberDashboard/MemberPageFrame';
import { useMemberWorkloadState } from '../MemberDashboard/useMemberWorkloadState';
import { useMemberAccessState } from '../MemberDashboard/useMemberAccessState';

export function MemberActivityPage() {
  const {
    data,
    isLoading,
    error,
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useMemberWorkloadState();
  const {
    isLoading: accessLoading,
    accessDeniedMessage,
  } = useMemberAccessState();

  if (isLoading || accessLoading) {
    return (
      <LoadingShell>
        <CircularProgress />
      </LoadingShell>
    );
  }

  if (accessDeniedMessage) {
    return <MemberAccessState message={accessDeniedMessage} />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <MemberPageFrame
      title="My Activity"
      description="Follow the timeline of acknowledgements, task progress, workload changes, and delivery events tied to your current planning window."
      showPeriodSelector={false}
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
      {data ? <HistoryPanel items={data.history} formatHistoryDate={formatHistoryDate} /> : null}
    </MemberPageFrame>
  );
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

// Styled components
const LoadingShell = styled.div`
  min-height: 360px;
  display: grid;
  place-items: center;
`;
