import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { Avatar, Box, Paper, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { WorkloadCardModel } from '../../types/domain';
import { appColors } from '../../theme/theme';

interface WorkloadInsightsSectionProps {
  members: WorkloadCardModel[];
}

type InsightTone = {
  accent: string;
  iconBg: string;
  iconColor: string;
  fill?: string;
  track?: string;
};

const availableTone: InsightTone = {
  accent: '#1f9d68',
  iconBg: '#eaf8ef',
  iconColor: '#1f9d68',
  fill: '#31b06f',
  track: '#e4f3ea',
};

const overloadedTone: InsightTone = {
  accent: '#d14343',
  iconBg: '#fff1f0',
  iconColor: '#d14343',
  fill: '#dc2626',
  track: '#fce5e4',
};

const finishingSoonTone = {
  accent: '#2563eb',
  iconBg: '#ebf2ff',
  iconColor: '#2563eb',
} as const;

export function WorkloadInsightsSection({ members }: WorkloadInsightsSectionProps) {
  const availableMembers = useMemo(() => {
    return [...members]
      .filter((member) => member.status !== 'Overloaded')
      .sort((left, right) => compareByCapacityAscending(left, right))
      .slice(0, 4);
  }, [members]);

  const overloadedMembers = useMemo(() => {
    return [...members]
      .filter((member) => member.status === 'Overloaded')
      .sort((left, right) => compareByCapacityDescending(left, right))
      .slice(0, 4);
  }, [members]);

  const finishingSoonMembers = useMemo(() => {
    return [...members]
      .map((member) => ({
        member,
        dueDate: parseDateOnly(member.lastTaskDueDate),
      }))
      .filter((entry): entry is { member: WorkloadCardModel; dueDate: Date } => entry.dueDate !== null)
      .sort((left, right) => compareByDateAscending(left.dueDate, right.dueDate) || left.member.fullName.localeCompare(right.member.fullName))
      .slice(0, 4)
      .map((entry) => entry.member);
  }, [members]);

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.25,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(3, minmax(0, 1fr))',
        },
        alignItems: 'stretch',
      }}
    >
      <InsightCard
        title="Top 4 Available"
        icon={<CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />}
        tone={availableTone}
      >
        {renderRankedMemberRows({
          members: availableMembers,
          emptyMessage: 'No more available employees',
          tone: availableTone,
        })}
      </InsightCard>

      <InsightCard
        title="Top 4 Overloaded"
        icon={<WarningAmberRoundedIcon sx={{ fontSize: 18 }} />}
        tone={overloadedTone}
      >
        {renderRankedMemberRows({
          members: overloadedMembers,
          emptyMessage: 'No more overloaded employees',
          tone: overloadedTone,
        })}
      </InsightCard>

      <InsightCard
        title="Finishing Soon"
        icon={<EventOutlinedIcon sx={{ fontSize: 18 }} />}
        tone={finishingSoonTone}
      >
        {renderDueDateRows(finishingSoonMembers)}
      </InsightCard>
    </Box>
  );
}

function InsightCard({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: ReactNode;
  tone: InsightTone;
  children: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: '16px',
        border: '1px solid',
        borderColor: appColors.light.border.default,
        bgcolor: appColors.light.background.paper,
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
        px: { xs: 1.4, md: 1.6 },
        py: { xs: 1.35, md: 1.5 },
      }}
    >
      <Stack spacing={0.95} sx={{ height: '100%' }}>
        <Stack direction="row" spacing={0.9} alignItems="center">
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '9px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: tone.iconBg,
              color: tone.iconColor,
              flex: '0 0 auto',
            }}
          >
            {icon}
          </Box>

          <Typography
            sx={{
              color: 'text.primary',
              fontSize: '1rem',
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </Typography>
        </Stack>

        <Stack spacing={0.7} sx={{ flex: 1, minHeight: 0 }}>
          {children}
        </Stack>
      </Stack>
    </Paper>
  );
}

function renderRankedMemberRows({
  members,
  emptyMessage,
  tone,
}: {
  members: WorkloadCardModel[];
  emptyMessage: string;
  tone: InsightTone;
}) {
  const rows = Array.from({ length: 4 }, (_, index) => members[index] ?? null);

  return rows.map((member, index) =>
    member ? (
      <InsightMemberRow key={member.memberId} member={member} tone={tone} isLast={index === rows.length - 1} />
    ) : (
      <InsightEmptyRow key={`empty-${index}`} message={emptyMessage} isLast={index === rows.length - 1} />
    ),
  );
}

function renderDueDateRows(members: WorkloadCardModel[]) {
  const rows = Array.from({ length: 4 }, (_, index) => members[index] ?? null);

  return rows.map((member, index) =>
    member ? (
      <InsightDueDateRow key={member.memberId} member={member} isLast={index === rows.length - 1} />
    ) : (
      <InsightEmptyRow key={`empty-${index}`} message="No valid due dates" isLast={index === rows.length - 1} />
    ),
  );
}

function InsightMemberRow({
  member,
  tone,
  isLast,
}: {
  member: WorkloadCardModel;
  tone: InsightTone;
  isLast: boolean;
}) {
  const fillWidth = Math.min(Math.max(member.capacityPercentage, 0), 100);
  const fillColor = tone.fill ?? tone.iconColor;
  const trackColor = tone.track ?? '#e4f3ea';

  return (
    <Box
      sx={{
        pb: 0.65,
        borderBottom: isLast ? 'none' : '1px solid #edf2f7',
      }}
    >
      <Stack spacing={0.55}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: tone.iconBg,
              color: tone.iconColor,
              flex: '0 0 auto',
            }}
          >
            <PersonRoundedIcon sx={{ fontSize: 16 }} />
          </Avatar>

          <Typography
            noWrap
            sx={{
              flex: 1,
              minWidth: 0,
              color: 'text.primary',
              fontSize: 13.5,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {member.fullName}
          </Typography>

          <Typography
            sx={{
              flex: '0 0 auto',
              color: tone.accent,
              fontSize: 12.5,
              lineHeight: 1.2,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {member.capacityPercentage}%
          </Typography>
        </Stack>

        <Box
          sx={{
            height: 4,
            borderRadius: 999,
            bgcolor: trackColor,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${fillWidth}%`,
              borderRadius: 'inherit',
              bgcolor: fillColor,
            }}
          />
        </Box>
      </Stack>
    </Box>
  );
}

function InsightDueDateRow({
  member,
  isLast,
}: {
  member: WorkloadCardModel;
  isLast: boolean;
}) {
  const dueDate = parseDateOnly(member.lastTaskDueDate);

  return (
    <Box
      sx={{
        pb: 0.65,
        borderBottom: isLast ? 'none' : '1px solid #edf2f7',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Avatar
          sx={{
            width: 28,
            height: 28,
            bgcolor: finishingSoonTone.iconBg,
            color: finishingSoonTone.iconColor,
            flex: '0 0 auto',
          }}
        >
          <PersonRoundedIcon sx={{ fontSize: 16 }} />
        </Avatar>

        <Typography
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            color: 'text.primary',
            fontSize: 13.5,
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          {member.fullName}
        </Typography>

        <Typography
          sx={{
            flex: '0 0 auto',
            color: '#4c5f84',
            fontSize: 12.5,
            lineHeight: 1.2,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {dueDate ? formatDateOnly(dueDate) : 'No valid due date'}
        </Typography>
      </Stack>
    </Box>
  );
}

function InsightEmptyRow({
  message,
  isLast,
}: {
  message: string;
  isLast: boolean;
}) {
  return (
    <Box
      sx={{
        pb: 0.65,
        borderBottom: isLast ? 'none' : '1px solid #edf2f7',
      }}
    >
        <Box
          sx={{
            minHeight: 36,
            px: 1.2,
            display: 'flex',
            alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '10px',
          border: '1px dashed #dde6f1',
          bgcolor: '#fafcff',
        }}
      >
        <Typography
          sx={{
            color: '#7c879c',
            fontSize: 12,
            lineHeight: 1.25,
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {message}
        </Typography>
      </Box>
    </Box>
  );
}

function compareByCapacityAscending(left: WorkloadCardModel, right: WorkloadCardModel) {
  return left.capacityPercentage - right.capacityPercentage || left.fullName.localeCompare(right.fullName);
}

function compareByCapacityDescending(left: WorkloadCardModel, right: WorkloadCardModel) {
  return right.capacityPercentage - left.capacityPercentage || left.fullName.localeCompare(right.fullName);
}

function compareByDateAscending(left: Date, right: Date) {
  return left.getTime() - right.getTime();
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const segments = value.split('-').map((segment) => Number(segment));
  if (segments.length !== 3 || segments.some((segment) => Number.isNaN(segment))) {
    return null;
  }

  const [year, month, day] = segments;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
