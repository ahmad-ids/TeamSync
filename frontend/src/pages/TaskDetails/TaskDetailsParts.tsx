import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Chip, Stack, TableCell, TableRow, Typography } from '@mui/material';
import styled from 'styled-components';
import type { TaskCapacityPointModel, TaskChangeAuditItemModel, TaskStatusTimelineItemModel } from '../../types/domain';

export function ApprovalStatusChip({
  label,
  status,
}: {
  label: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}) {
  const tone =
    status === 'Approved'
      ? { bg: '#e8f7ee', color: '#2d8a57' }
      : status === 'Rejected'
        ? { bg: '#fff1f0', color: '#d14343' }
        : { bg: '#eef4ff', color: '#355fad' };

  return <StatusChip label={label} $bg={tone.bg} $color={tone.color} />;
}

export function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.5}>
      <MetricCaption variant="caption">
        {label}
      </MetricCaption>
      <MetricBody variant="body1">
        {value}
      </MetricBody>
    </Stack>
  );
}

export function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <LineLabel variant="body2">
        {label}
      </LineLabel>
      <LineValue variant="body2">
        {value}
      </LineValue>
    </Stack>
  );
}

export function StatusTimelineRow({ item }: { item: TaskStatusTimelineItemModel }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <TimelineIcon $isCurrent={item.isCurrent} />
      <Stack spacing={0.35}>
        <TimelineLabel variant="body2">
          {item.label}
        </TimelineLabel>
        <Typography variant="caption" color="text.secondary">
          {item.description}
          {item.isCurrent ? ' â€¢ Active' : ''}
        </Typography>
      </Stack>
    </Stack>
  );
}

export function ChangeAuditRow({ item }: { item: TaskChangeAuditItemModel }) {
  const oldValue = item.fromUserName ?? item.oldValue;
  const newValue = item.toUserName ?? item.newValue;
  const updatedByName = item.actionByName ?? item.updatedByName;

  return (
    <TableRow hover>
      <FieldCell>{item.field}</FieldCell>
      <TableCell>{oldValue}</TableCell>
      <NewValueCell>{newValue}</NewValueCell>
      <TableCell>{updatedByName}</TableCell>
      <TableCell>{item.status}</TableCell>
      <DateCell align="right">
        {formatRelativeDate(item.updatedAt)}
      </DateCell>
    </TableRow>
  );
}

export function CapacityCell({ point }: { point: TaskCapacityPointModel }) {
  return (
    <Stack spacing={0.75} alignItems="center">
      <CapacityBar
        $isCurrentDay={point.isCurrentDay}
        $opacity={Math.min(1, 0.35 + point.capacityPercentage / 120)}
      />
      <CapacityLabel variant="caption" $isCurrentDay={point.isCurrentDay}>
        {point.dayLabel}
      </CapacityLabel>
    </Stack>
  );
}

export function toStatusLabel(status: string) {
  return status === 'InProgress' ? 'In Progress' : status;
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffInMs = Date.now() - date.getTime();
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffInDays) <= 1) {
    return 'Today';
  }

  return `${Math.abs(diffInDays)} days ago`;
}

export function resolveRequestError(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return fallback;
  }

  const response = (error as { response?: { data?: unknown; status?: number; headers?: Record<string, string> } }).response;
  const data = response?.data;

  if (response?.status === 405) {
    const allowHeader = response.headers?.allow ?? response.headers?.Allow;
    return typeof allowHeader === 'string' && allowHeader.length > 0
      ? `Delete is not enabled on the current backend task route. Allowed methods: ${allowHeader}.`
      : 'Delete is not enabled on the current backend task route.';
  }

  if (response?.status === 403) {
    return 'You are authenticated, but the backend rejected this delete action for your current role.';
  }

  if (typeof data === 'string' && data.trim().length > 0) {
    return data;
  }

  if (typeof data === 'object' && data !== null) {
    const problemDetails = data as {
      detail?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };

    if (typeof problemDetails.detail === 'string' && problemDetails.detail.trim().length > 0) {
      return problemDetails.detail;
    }

    if (problemDetails.errors) {
      const firstError = Object.values(problemDetails.errors).flat().find((message) => message.trim().length > 0);
      if (firstError) {
        return firstError;
      }
    }

    if (typeof problemDetails.title === 'string' && problemDetails.title.trim().length > 0) {
      return problemDetails.title;
    }
  }

  return fallback;
}

// Styled components
const StatusChip = styled(Chip)<{ $bg: string; $color: string }>`
  font-weight: 700;
  background-color: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
`;

const MetricCaption = styled(Typography)`
  color: #5f6b85;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
`;

const MetricBody = styled(Typography)`
  color: #172033;
  font-weight: 600;
`;

const LineLabel = styled(Typography)`
  color: #1d2d4a;
  font-weight: 600;
`;

const LineValue = styled(Typography)`
  font-weight: 700;
  color: #0b1a33;
`;

const TimelineIcon = styled(CheckCircleRoundedIcon)<{ $isCurrent: boolean }>`
  margin-top: 2px;
  color: ${({ $isCurrent }) => ($isCurrent ? '#2563eb' : '#1d4ed8')};
  font-size: 18px;
`;

const TimelineLabel = styled(Typography)`
  font-weight: 600;
  color: #172033;
`;

const FieldCell = styled(TableCell)`
  font-weight: 700;
`;

const NewValueCell = styled(TableCell)`
  color: #d14343;
  font-weight: 600;
`;

const DateCell = styled(TableCell)`
  color: #5f6b85;
`;

const CapacityBar = styled.div<{ $isCurrentDay: boolean; $opacity: number }>`
  width: 100%;
  height: 22px;
  border-radius: 12px;
  background-color: ${({ $isCurrentDay }) => ($isCurrentDay ? '#2563eb' : '#dbe5f2')};
  opacity: ${({ $opacity }) => $opacity};
`;

const CapacityLabel = styled(Typography)<{ $isCurrentDay: boolean }>`
  color: ${({ $isCurrentDay }) => ($isCurrentDay ? '#2563eb' : '#5f6b85')};
  font-weight: ${({ $isCurrentDay }) => ($isCurrentDay ? 600 : 500)};
`;
