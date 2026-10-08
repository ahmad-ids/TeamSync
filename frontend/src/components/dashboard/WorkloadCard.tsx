import EastOutlinedIcon from '@mui/icons-material/EastOutlined';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { Avatar, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import type { WorkloadCardModel } from '../../types/domain';
import { appColors, getTeamMemberCardLoadColors, workloadMetricColors } from '../../theme/theme';

const statusConfig = {
  Available: { chipBg: '#e8f7ef', chipColor: '#1f9d68', meterColor: '#1f9d68' },
  Moderate: { chipBg: '#fff6db', chipColor: '#d28a00', meterColor: '#d28a00' },
  Overloaded: { chipBg: '#ffe9e7', chipColor: '#d14343', meterColor: '#d14343' },
} as const;

interface WorkloadCardProps {
  member: WorkloadCardModel;
  viewMode: 'grid' | 'list';
  detailsHref: string;
}

function formatTeamName(teamName: string) {
  return teamName === 'Platform Delivery Team' ? 'Platform Team' : teamName;
}

const CardRoot = styled(Paper)<{ $viewMode: 'grid' | 'list' }>(({ $viewMode }) => ({
  padding: 18,
  borderRadius: '16px',
  minHeight: $viewMode === 'grid' ? 252 : 'auto',
  boxShadow: 'none',
  transition: 'box-shadow 180ms ease, transform 180ms ease',
  '&:hover': {
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
    transform: 'translateY(-1px)',
  },
}));

const CardStack = styled(Stack)<{ $viewMode: 'grid' | 'list' }>(({ $viewMode }) => ({
  alignItems: $viewMode === 'list' ? 'center' : 'stretch',
}));

const IdentityRow = styled(Stack)<{ $viewMode: 'grid' | 'list' }>(({ $viewMode }) => ({
  minWidth: $viewMode === 'list' ? 260 : 'auto',
  flexShrink: 0,
}));

const MemberAvatar = styled(Avatar)({
  width: 52,
  height: 52,
  backgroundColor: appColors.light.avatar.memberBg,
  color: appColors.light.avatar.memberIcon,
  fontWeight: 700,
});

const MetricsRow = styled(Stack)<{ $viewMode: 'grid' | 'list' }>(({ $viewMode }) => ({
  flex: 1,
  justifyContent: $viewMode === 'list' ? 'flex-start' : 'space-between',
  alignItems: 'flex-start',
}));

const CapacityBox = styled(Box)({
  flex: 1,
  minWidth: 0,
  paddingInline: 0.1,
});

const StatusDueRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
});

const CapacitySummary = styled(Typography)({
  fontSize: 12.5,
  fontWeight: 700,
});

const CapacityBarLabel = styled(Typography)({
  marginBottom: 4,
  color: '#64748b',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.24,
});

const CapacityBarArea = styled(Box)({
  position: 'relative',
  paddingBottom: 10,
});

const CapacityBarTrack = styled(Box)({
  position: 'relative',
  height: 10,
  borderRadius: 999,
  backgroundColor: '#e8eef6',
  overflow: 'hidden',
});

const CapacityBarSafeFill = styled(Box)<{ $width: number }>(({ $width }) => ({
  position: 'absolute',
  insetBlock: 0,
  left: 0,
  width: `${$width}%`,
  borderRadius: 999,
  background: 'linear-gradient(90deg, #9dbcf7 0%, #426ab8 100%)',
}));

const CapacityBarOverloadFill = styled(Box)<{ $left: number; $width: number }>(({ $left, $width }) => ({
  position: 'absolute',
  insetBlock: 0,
  left: `${$left}%`,
  width: `${$width}%`,
  borderRadius: 999,
  background: 'linear-gradient(90deg, rgba(220, 38, 38, 0.24) 0%, #dc2626 100%)',
}));

const CapacityMarker = styled(Box)<{ $left: number }>(({ $left }) => ({
  position: 'absolute',
  left: `${$left}%`,
  top: 0,
  bottom: 0,
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  pointerEvents: 'none',
}));

const CapacityDivider = styled(Box)({
  width: 2,
  height: 10,
  borderRadius: 999,
  backgroundColor: '#ffffff',
  boxShadow: '0 0 0 1px rgba(148, 163, 184, 0.18)',
});

const CapacityDividerLabel = styled(Typography)({
  marginTop: 4,
  color: '#64748b',
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: 0.18,
  whiteSpace: 'nowrap',
});

const MetricWrapper = styled(Box)({
  minWidth: 0,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  textAlign: 'center',
});

const MetricLabel = styled(Typography)({
  color: '#64748b',
  fontSize: 11,
  lineHeight: 1.2,
  textTransform: 'uppercase',
  fontWeight: 600,
  letterSpacing: 0.45,
  textAlign: 'center',
});

const MetricValue = styled(Typography)({
  marginTop: 2.5,
  fontWeight: 700,
  fontSize: 26,
  lineHeight: 1.15,
  textAlign: 'center',
});

const IdentityText = styled(Box)({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 1,
  flex: 1,
});

const IdentityHeaderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
});

const MemberName = styled(Typography)({
  color: 'text.primary',
  fontWeight: 700,
  fontSize: 18,
  lineHeight: 1.15,
});

const MemberTeam = styled(Typography)({
  color: 'text.secondary',
  fontSize: 14,
  fontWeight: 500,
});

const MemberRole = styled(Typography)({
  color: '#4c5f84',
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.3,
});

const DueDatePanel = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  minWidth: 0,
});

const DueDateLabel = styled(Typography)({
  color: '#64748b',
  fontSize: 11,
  lineHeight: 1.2,
  textTransform: 'uppercase',
  fontWeight: 600,
  letterSpacing: 0.45,
});

const DueDateValue = styled(Typography)({
  color: '#172033',
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 600,
  wordBreak: 'break-word',
});

export function WorkloadCard({ member, viewMode, detailsHref }: WorkloadCardProps) {
  const status = statusConfig[member.status];
  const loadColors = getTeamMemberCardLoadColors(member.capacityPercentage);
  const hasNoTasks = member.totalTasks === 0;
  const statusLabel = hasNoTasks ? 'NO TASKS' : member.status.toUpperCase();
  const lastTaskDueDateLabel = formatTaskDueDate(member.lastTaskDueDate ?? null);
  const barDisplayMax = Math.max(member.capacityPercentage, 140);
  const safeZoneWidth = (100 / barDisplayMax) * 100;
  const safeFillWidth = (Math.min(member.capacityPercentage, 100) / barDisplayMax) * 100;
  const overloadFillWidth =
    member.capacityPercentage > 100 ? ((member.capacityPercentage - 100) / barDisplayMax) * 100 : 0;

  return (
    <CardRoot $viewMode={viewMode}>
      <CardStack spacing={1.75} direction={viewMode === 'list' ? 'row' : 'column'} $viewMode={viewMode}>
        <IdentityRow direction="row" spacing={1.4} alignItems="center" $viewMode={viewMode}>
          <MemberAvatar>
            <PersonRoundedIcon sx={{ fontSize: 24 }} />
          </MemberAvatar>
          <IdentityText>
            <IdentityHeaderRow>
              <MemberName>{member.fullName}</MemberName>
              <Chip
                label={statusLabel}
                size="small"
                sx={{
                  flexShrink: 0,
                  bgcolor: hasNoTasks ? '#eef3fb' : status.chipBg,
                  color: hasNoTasks ? '#5f6b85' : status.chipColor,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: 0.35,
                }}
              />
            </IdentityHeaderRow>
            <MemberRole>{member.jobTitle}</MemberRole>
            <MemberTeam variant="body2">{formatTeamName(member.teamName)}</MemberTeam>
          </IdentityText>
        </IdentityRow>

        <MetricsRow direction="row" spacing={{ xs: 1.5, sm: 1.75 }} $viewMode={viewMode}>
          <MetricBlock label="Tasks" value={member.totalTasks.toString()} color={workloadMetricColors.totalTasks} />
          <MetricBlock label="Hours" value={`${member.totalEffortHours}h`} color={workloadMetricColors.effortHours} />
          <MetricBlock label="Weight" value={`${member.capacityPercentage}%`} color={loadColors.accent} />
        </MetricsRow>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <StatusDueRow>
            <CapacitySummary sx={{ color: hasNoTasks ? '#64748b' : loadColors.accent }}>
              {hasNoTasks ? 'No active tasks' : loadColors.summaryText}
            </CapacitySummary>
            <DueDatePanel sx={{ alignItems: 'flex-end', textAlign: 'right' }}>
              <DueDateLabel>Last task due</DueDateLabel>
              <DueDateValue>{lastTaskDueDateLabel}</DueDateValue>
            </DueDatePanel>
          </StatusDueRow>
        </Box>

        <CapacityBox>
          <CapacityBarLabel>{hasNoTasks ? 'Workload state' : loadColors.barLabel}</CapacityBarLabel>
          <CapacityBarArea>
            <CapacityBarTrack>
              {!hasNoTasks ? <CapacityBarSafeFill $width={safeFillWidth} /> : null}
              {overloadFillWidth > 0 ? (
                <CapacityBarOverloadFill $left={safeZoneWidth} $width={overloadFillWidth} />
              ) : null}
            </CapacityBarTrack>
            {!hasNoTasks ? (
              <CapacityMarker $left={safeZoneWidth}>
                <CapacityDivider />
                <CapacityDividerLabel>100%</CapacityDividerLabel>
              </CapacityMarker>
            ) : null}
          </CapacityBarArea>
        </CapacityBox>

        <Button
          component={Link}
          to={detailsHref}
          variant="contained"
          endIcon={<EastOutlinedIcon />}
          sx={{
            alignSelf: viewMode === 'list' ? 'center' : 'stretch',
            width: viewMode === 'list' ? 176 : '100%',
            minWidth: viewMode === 'list' ? 176 : 'auto',
            paddingBlock: 1.05,
            borderRadius: '12px',
            backgroundColor: appColors.light.button.detail.base,
            color: '#ffffff',
            fontWeight: 600,
            boxShadow: 'none',
            transition: 'background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
            '&:hover': {
              backgroundColor: appColors.light.button.detail.hover,
              boxShadow: '0 8px 18px rgba(15, 23, 42, 0.14)',
              transform: 'translateY(-1px)',
            },
            '&:active': {
              backgroundColor: appColors.light.button.detail.active,
              boxShadow: 'none',
              transform: 'translateY(0)',
            },
          }}
        >
          View Details
        </Button>
      </CardStack>
    </CardRoot>
  );
}

interface MetricBlockProps {
  label: string;
  value: string;
  color: string;
}

function MetricBlock({ label, value, color }: MetricBlockProps) {
  return (
    <MetricWrapper>
      <MetricLabel>{label}</MetricLabel>
      <MetricValue sx={{ color }}>{value}</MetricValue>
    </MetricWrapper>
  );
}

function formatTaskDueDate(value: string | null | undefined) {
  if (!value) {
    return 'No due date';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'No due date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsedDate);
}
