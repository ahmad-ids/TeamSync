import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import { Avatar, Box, Chip, Divider, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { appColors, getWorkloadWeightMetricColors, workloadMetricColors } from '../../theme/theme';
import type { MemberActivityHistoryItemModel, MemberPrioritySplitModel, MemberWorkloadDetailsModel, TaskSummaryModel, WorkloadStatus } from '../../types/domain';

const statusAccent: Record<WorkloadStatus, string> = {
  Available: '#19a974',
  Moderate: '#d18f00',
  Overloaded: '#d13d3d',
};

const statusText: Record<WorkloadStatus, string> = {
  Available: 'Low',
  Moderate: 'Moderate',
  Overloaded: 'High',
};

const priorityBars: Record<string, string> = {
  Critical: alpha(appColors.light.error.main, 0.78),
  High: alpha(appColors.light.error.main, 0.78),
  Medium: alpha(appColors.light.primary.main, 0.82),
  Low: alpha(appColors.light.success.main, 0.82),
};

const priorityTrackColor = alpha(appColors.light.border.default, 0.45);

const sectionPaperSx = {
  p: { xs: 2.5, md: 3 },
  borderRadius: '16px',
  boxShadow: 'none',
} as const;

const subtlePanelSx = {
  borderRadius: 3,
  backgroundColor: appColors.light.background.accent,
  borderColor: appColors.light.border.default,
  boxShadow: 'none',
} as const;

const summaryRowSx = { fontSize: 12.5, color: '#4f5c76', fontWeight: 600 };

export function OverviewMetrics({ data }: { data: MemberWorkloadDetailsModel }) {
  const deltaColor = data.taskDeltaFromPreviousPeriod <= 0 ? '#27ae60' : '#c73d36';
  const deltaLabel = `${data.taskDeltaFromPreviousPeriod > 0 ? '+' : ''}${data.taskDeltaFromPreviousPeriod} from previous period`;
  const effortProgress = Math.min((data.totalEffortHours / 48) * 100, 100);
  const workloadWeightColors = getWorkloadWeightMetricColors(data.capacityPercentage);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2.5 }}>
      <MetricCard title="Total Tasks" value={String(data.totalTasks)} caption={deltaLabel} accent={workloadMetricColors.totalTasks} background="background.paper" borderColor="#d9e6ff" captionColor={deltaColor} icon={<DescriptionOutlinedIcon sx={{ fontSize: 18 }} />} />
      <MetricCard title="Effort Hours" value={`${data.totalEffortHours}h`} accent={workloadMetricColors.effortHours} background="background.paper" borderColor="#d8e4fb" progress={effortProgress} progressColor="#2563eb" icon={<CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />} />
      <MetricCard title="Workload Weight" value={`${data.capacityPercentage}%`} caption={data.status === 'Overloaded' ? 'Critical threshold' : 'Current load'} accent={workloadWeightColors.accent} background="background.paper" borderColor={workloadWeightColors.borderColor} captionColor={workloadWeightColors.accent} icon={<ErrorOutlineRoundedIcon sx={{ fontSize: 18 }} />} />
      <MetricCard title="Status" value={statusText[data.status]} caption={`Impact score: ${data.impactScore}/10`} accent="#4f46e5" background="background.paper" borderColor="#e1ddff" icon={<FlagRoundedIcon sx={{ fontSize: 18 }} />} />
    </Box>
  );
}

export function WorkloadInsightsPanel({ data, filteredTasks }: { data: MemberWorkloadDetailsModel; filteredTasks: TaskSummaryModel[] }) {
  const circumference = 251.2;
  const progress = Math.min(data.capacityPercentage, 100);
  const prioritySplit = data.prioritySplit.length > 0 ? data.prioritySplit : derivePrioritySplit(filteredTasks);
  const totalTaskCount = Math.max(data.totalTasks, 1);
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxEffort = Math.max(...data.dailyEffortHours, 1);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<HTMLDivElement | null>(null);
  const [hasAnimatedRing, setHasAnimatedRing] = useState(false);
  const [hasAnimatedBars, setHasAnimatedBars] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [animatedEffort, setAnimatedEffort] = useState<number[]>(() => data.dailyEffortHours.map(() => 0));

  useEffect(() => {
    if (!ringRef.current || hasAnimatedRing) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) {
        return;
      }

      setHasAnimatedRing(true);
      observer.disconnect();
    }, { threshold: 0.45, rootMargin: '0px 0px -6% 0px' });

    observer.observe(ringRef.current);

    return () => observer.disconnect();
  }, [hasAnimatedRing]);

  useEffect(() => {
    if (!barsRef.current || hasAnimatedBars) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) {
        return;
      }

      setHasAnimatedBars(true);
      observer.disconnect();
    }, { threshold: 0.4, rootMargin: '0px 0px -4% 0px' });

    observer.observe(barsRef.current);

    return () => observer.disconnect();
  }, [hasAnimatedBars]);

  useEffect(() => {
    if (!hasAnimatedRing) {
      setAnimatedProgress(0);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setAnimatedProgress(progress);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hasAnimatedRing, progress]);

  useEffect(() => {
    if (!hasAnimatedBars) {
      setAnimatedEffort(data.dailyEffortHours.map(() => 0));
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setAnimatedEffort([...data.dailyEffortHours]);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [data.dailyEffortHours, hasAnimatedBars]);

  const animatedDashOffset = circumference - (animatedProgress / 100) * circumference;

  const workloadWeightColors = getWorkloadWeightMetricColors(data.capacityPercentage);

  return (
    <Paper
      ref={sectionRef}
      sx={{
        ...sectionPaperSx,
        border: '1px solid',
        borderColor: alpha('#b7c6df', 0.55),
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.98) 100%)',
      }}
    >
      <Stack spacing={3}>
        <Stack spacing={0.45}>
          <Typography sx={{ color: 'text.primary', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Workload Insights</Typography>
          <Typography sx={{ color: '#6b7a90', fontSize: 13, lineHeight: 1.5 }}>
            Capacity, priority balance, and weekly effort pacing in one view.
          </Typography>
          <Typography sx={{ ...summaryRowSx }}>
            Total Tasks: <Box component="span" sx={{ color: appColors.light.primary.main, fontWeight: 700 }}>{data.totalTasks}</Box> • Effort: <Box component="span" sx={{ color: appColors.light.primary.main, fontWeight: 700 }}>{data.totalEffortHours}h</Box> • Weight: <Box component="span" sx={{ color: appColors.light.primary.main, fontWeight: 700 }}>{data.capacityPercentage}%</Box>
          </Typography>
        </Stack>
        <Paper
          ref={ringRef}
          sx={{
            p: 2,
            borderRadius: '16px',
            border: '1px solid',
            borderColor: alpha('#cad6ea', 0.8),
            backgroundColor: alpha('#f8fbff', 0.95),
            boxShadow: 'none',
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.2} alignItems="center">
            <Box sx={{ position: 'relative', width: 138, height: 138, flexShrink: 0 }}>
              <svg width="138" height="138" viewBox="0 0 138 138">
                <circle cx="69" cy="69" r="42" fill="none" stroke={alpha('#8aa0c8', 0.14)} strokeWidth="9" />
                <AnimatedRingCircle
                  cx="69"
                  cy="69"
                  r="42"
                  fill="none"
                  stroke={statusAccent[data.status]}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={animatedDashOffset}
                  transform="rotate(-90 69 69)"
                />
              </svg>
              <Stack
                spacing={0.35}
                alignItems="center"
                justifyContent="center"
                sx={{
                  position: 'absolute',
                  inset: 17,
                  borderRadius: '50%',
                  backgroundColor: alpha('#ffffff', 0.92),
                  boxShadow: 'inset 0 0 0 1px rgba(210, 222, 241, 0.55)',
                  px: 1.25,
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ color: 'text.primary', fontSize: 22, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
                  {Math.round(animatedProgress)}%
                </Typography>
                <Typography
                  sx={{
                    color: '#73839b',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                    lineHeight: 1.2,
                    maxWidth: 68,
                  }}
                >
                  Workload
                </Typography>
              </Stack>
            </Box>
            <Stack spacing={1.15} sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Capacity Overview</Typography>
              <Typography sx={{ color: 'text.primary', fontSize: 16, lineHeight: 1.35, fontWeight: 700 }}>
                {data.status === 'Overloaded'
                  ? 'Workload is above safe operating capacity.'
                  : data.status === 'Moderate'
                    ? 'Workload is balanced and manageable.'
                    : 'Capacity remains open for additional work.'}
              </Typography>
              <Typography sx={{ color: '#6b7a90', fontSize: 13, lineHeight: 1.65 }}>
                Current load is <Box component="span" sx={{ color: statusAccent[data.status], fontWeight: 700 }}>{data.capacityPercentage}%</Box> of standard capacity.
              </Typography>
              <Chip
                label={data.status === 'Overloaded' ? 'Over-capacity' : data.status === 'Moderate' ? 'Balanced' : 'Available'}
                sx={{
                  alignSelf: 'flex-start',
                  height: 28,
                  borderRadius: '999px',
                  backgroundColor: alpha(statusAccent[data.status], 0.12),
                  color: statusAccent[data.status],
                  fontSize: 12,
                  fontWeight: 700,
                }}
              />
            </Stack>
          </Stack>
        </Paper>
        <Divider />
        <Stack spacing={1.5}>
          <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Priority Split</Typography>
          {prioritySplit.map((item) => {
            const barWidth = item.taskCount === 0
              ? 0
              : Math.max(8, (item.taskCount / totalTaskCount) * 100);
            return (
              <Stack key={item.priority} direction="row" alignItems="center" spacing={1.25}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: priorityBars[item.priority] ?? '#c9d0de' }} />
                <Typography sx={{ flexBasis: 92, color: '#6b7a90', fontSize: 12.5, fontWeight: 500 }}>{item.priority} Priority</Typography>
                <Typography sx={{ width: 18, color: 'text.primary', fontSize: 12.5, fontWeight: 700 }}>{item.taskCount}</Typography>
                <Box sx={{ flexGrow: 1, height: 8, borderRadius: 99, backgroundColor: priorityTrackColor, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${barWidth}%`,
                      height: '100%',
                      borderRadius: 99,
                      background: `linear-gradient(90deg, ${alpha(priorityBars[item.priority] ?? appColors.light.success.main, 0.62)} 0%, ${priorityBars[item.priority] ?? appColors.light.success.main} 100%)`,
                      boxShadow: `0 0 0 1px ${alpha(priorityBars[item.priority] ?? appColors.light.success.main, 0.10)} inset`,
                      transition: 'width 800ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </Box>
              </Stack>
            );
          })}
        </Stack>
        <Divider />
        <Stack spacing={1.5} ref={barsRef}>
          <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Weekly Effort Distribution</Typography>
          <Stack direction="row" spacing={1.1} alignItems="flex-end">
            {animatedEffort.map((value, index) => (
              <Stack key={weekdays[index]} spacing={0.75} alignItems="center" sx={{ flex: 1 }}>
                <Typography sx={{ color: '#7b8798', fontSize: 10.5, fontWeight: 600 }}>{data.dailyEffortHours[index]}h</Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: `${Math.max(26, (value / maxEffort) * 88)}px`,
                    borderRadius: '10px 10px 4px 4px',
                    backgroundColor: index === 4 ? '#355fad' : '#d9e1ee',
                    transition: 'height 1750ms cubic-bezier(0.22, 1, 0.36, 1), background-color 220ms ease',
                  }}
                />
                <Typography sx={{ color: '#6b7a90', fontSize: 10.5, fontWeight: 700 }}>{weekdays[index]}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}

function MetricCard(props: { title: string; value: string; accent: string; background: string; borderColor: string; caption?: string; captionColor?: string; progress?: number; progressColor?: string; icon: React.ReactNode }) {
  return (
    <Paper sx={(theme) => ({ p: 2.4, borderRadius: '16px', border: '1px solid', borderColor: theme.palette.mode === 'dark' ? alpha(props.accent, 0.22) : props.borderColor, bgcolor: props.background, boxShadow: 'none' })}>
      <Stack spacing={1.8}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{props.title}</Typography>
          <Box sx={{ color: props.accent }}>{props.icon}</Box>
        </Stack>
        <Typography sx={{ color: props.accent, fontSize: 25, lineHeight: 1.15, fontWeight: 700 }}>{props.value}</Typography>
        {typeof props.progress === 'number' ? (
          <LinearProgress variant="determinate" value={props.progress} sx={{ height: 6, borderRadius: 999, backgroundColor: '#e7ebf3', '& .MuiLinearProgress-bar': { borderRadius: 999, backgroundColor: props.progressColor ?? props.accent } }} />
        ) : null}
        {props.caption ? <Typography sx={{ color: props.captionColor ?? '#64748b', fontSize: 11.5, fontWeight: 600 }}>{props.caption}</Typography> : null}
      </Stack>
    </Paper>
  );
}

export function AnalyticsPanel({ data, filteredTasks }: { data: MemberWorkloadDetailsModel; filteredTasks: TaskSummaryModel[] }) {
  const circumference = 251.2;
  const progress = Math.min(data.capacityPercentage, 100);
  const prioritySplit = data.prioritySplit.length > 0 ? data.prioritySplit : derivePrioritySplit(filteredTasks);
  const totalTaskCount = Math.max(data.totalTasks, 1);
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxEffort = Math.max(...data.dailyEffortHours, 1);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<HTMLDivElement | null>(null);
  const [hasAnimatedRing, setHasAnimatedRing] = useState(false);
  const [hasAnimatedBars, setHasAnimatedBars] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [animatedEffort, setAnimatedEffort] = useState<number[]>(() => data.dailyEffortHours.map(() => 0));

  useEffect(() => {
    if (!ringRef.current || hasAnimatedRing) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) {
        return;
      }

      setHasAnimatedRing(true);
      observer.disconnect();
    }, { threshold: 0.45, rootMargin: '0px 0px -6% 0px' });

    observer.observe(ringRef.current);

    return () => observer.disconnect();
  }, [hasAnimatedRing]);

  useEffect(() => {
    if (!barsRef.current || hasAnimatedBars) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) {
        return;
      }

      setHasAnimatedBars(true);
      observer.disconnect();
    }, { threshold: 0.4, rootMargin: '0px 0px -4% 0px' });

    observer.observe(barsRef.current);

    return () => observer.disconnect();
  }, [hasAnimatedBars]);

  useEffect(() => {
    if (!hasAnimatedRing) {
      setAnimatedProgress(0);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setAnimatedProgress(progress);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hasAnimatedRing, progress]);

  useEffect(() => {
    if (!hasAnimatedBars) {
      setAnimatedEffort(data.dailyEffortHours.map(() => 0));
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setAnimatedEffort([...data.dailyEffortHours]);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [data.dailyEffortHours, hasAnimatedBars]);

  const animatedDashOffset = circumference - (animatedProgress / 100) * circumference;

  return (
    <Paper
      ref={sectionRef}
      sx={{
        ...sectionPaperSx,
        border: '1px solid',
        borderColor: alpha('#b7c6df', 0.55),
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.98) 100%)',
      }}
    >
      <Stack spacing={2.5}>
        <Stack spacing={0.45}>
          <Typography sx={{ color: 'text.primary', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Visual Analytics</Typography>
          <Typography sx={{ color: '#6b7a90', fontSize: 12.75, lineHeight: 1.55 }}>
            Current workload composition, priority balance, and weekly effort pacing.
          </Typography>
        </Stack>
        <Paper
          ref={ringRef}
          sx={{
            p: 2,
            borderRadius: '15px',
            border: '1px solid',
            borderColor: alpha('#cad6ea', 0.8),
            backgroundColor: alpha('#f8fbff', 0.95),
            boxShadow: 'none',
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.2} alignItems="center">
            <Box sx={{ position: 'relative', width: 138, height: 138, flexShrink: 0 }}>
              <svg width="138" height="138" viewBox="0 0 138 138">
                <circle cx="69" cy="69" r="42" fill="none" stroke={alpha('#8aa0c8', 0.14)} strokeWidth="9" />
                <AnimatedRingCircle
                  cx="69"
                  cy="69"
                  r="42"
                  fill="none"
                  stroke={statusAccent[data.status]}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={animatedDashOffset}
                  transform="rotate(-90 69 69)"
                />
              </svg>
              <Stack
                spacing={0.35}
                alignItems="center"
                justifyContent="center"
                sx={{
                  position: 'absolute',
                  inset: 17,
                  borderRadius: '50%',
                  backgroundColor: alpha('#ffffff', 0.92),
                  boxShadow: 'inset 0 0 0 1px rgba(210, 222, 241, 0.55)',
                  px: 1.25,
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ color: 'text.primary', fontSize: 22, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
                  {Math.round(animatedProgress)}%
                </Typography>
                <Typography
                  sx={{
                    color: '#73839b',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                    lineHeight: 1.2,
                    maxWidth: 68,
                  }}
                >
                  Workload
                </Typography>
              </Stack>
            </Box>
            <Stack spacing={1.15} sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Capacity Overview
              </Typography>
              <Typography sx={{ color: 'text.primary', fontSize: 16, lineHeight: 1.35, fontWeight: 700 }}>
                {data.status === 'Overloaded' ? 'Workload is above safe operating capacity.' : data.status === 'Moderate' ? 'Workload is balanced and manageable.' : 'Capacity remains open for additional work.'}
              </Typography>
              <Typography sx={{ color: '#6b7a90', fontSize: 13, lineHeight: 1.65 }}>
                Current load is <Box component="span" sx={{ color: statusAccent[data.status], fontWeight: 700 }}>{data.capacityPercentage}%</Box> of standard capacity across the selected planning window.
              </Typography>
              <Chip
                label={data.status === 'Overloaded' ? 'Over-capacity' : data.status === 'Moderate' ? 'Balanced' : 'Available'}
                sx={{
                  alignSelf: 'flex-start',
                  height: 28,
                  borderRadius: '999px',
                  backgroundColor: alpha(statusAccent[data.status], 0.12),
                  color: statusAccent[data.status],
                  fontSize: 12,
                  fontWeight: 700,
                }}
              />
            </Stack>
          </Stack>
        </Paper>
        <Divider />
        <Stack spacing={1.5}>
          <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Priority Split</Typography>
          {prioritySplit.map((item) => {
            const barWidth = item.taskCount === 0
              ? 0
              : Math.max(8, (item.taskCount / totalTaskCount) * 100);
            return (
              <Stack key={item.priority} direction="row" alignItems="center" spacing={1.25}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: priorityBars[item.priority] ?? '#c9d0de' }} />
                <Typography sx={{ flexBasis: 92, color: '#6b7a90', fontSize: 12.5, fontWeight: 500 }}>{item.priority} Priority</Typography>
                <Typography sx={{ width: 18, color: 'text.primary', fontSize: 12.5, fontWeight: 700 }}>{item.taskCount}</Typography>
                <Box sx={{ flexGrow: 1, height: 8, borderRadius: 99, backgroundColor: priorityTrackColor, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${barWidth}%`,
                      height: '100%',
                      borderRadius: 99,
                      background: `linear-gradient(90deg, ${alpha(priorityBars[item.priority] ?? appColors.light.success.main, 0.62)} 0%, ${priorityBars[item.priority] ?? appColors.light.success.main} 100%)`,
                      boxShadow: `0 0 0 1px ${alpha(priorityBars[item.priority] ?? appColors.light.success.main, 0.10)} inset`,
                      transition: 'width 800ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </Box>
              </Stack>
            );
          })}
        </Stack>
        <Divider />
        <Stack spacing={1.5} ref={barsRef}>
          <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Weekly Effort Distribution</Typography>
          <Stack direction="row" spacing={1.1} alignItems="flex-end">
            {animatedEffort.map((value, index) => (
              <Stack key={weekdays[index]} spacing={0.75} alignItems="center" sx={{ flex: 1 }}>
                <Typography sx={{ color: '#7b8798', fontSize: 10.5, fontWeight: 600 }}>{data.dailyEffortHours[index]}h</Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: `${Math.max(26, (value / maxEffort) * 88)}px`,
                    borderRadius: '10px 10px 4px 4px',
                    backgroundColor: index === 4 ? '#355fad' : '#d9e1ee',
                    transition: 'height 1750ms cubic-bezier(0.22, 1, 0.36, 1), background-color 220ms ease',
                  }}
                />
                <Typography sx={{ color: '#6b7a90', fontSize: 10.5, fontWeight: 700 }}>{weekdays[index]}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
        <Paper sx={{ ...subtlePanelSx, p: 2 }}>
          <Typography sx={{ color: '#5e6c82', fontSize: 12.75, lineHeight: 1.65 }}>{data.insight}</Typography>
        </Paper>
      </Stack>
    </Paper>
  );
}

function derivePrioritySplit(tasks: TaskSummaryModel[]): MemberPrioritySplitModel[] {
  const priorities: TaskSummaryModel['priority'][] = ['High', 'Medium', 'Low', 'Critical'];
  return priorities
    .map((priority) => ({
      priority,
      taskCount: tasks.filter((task) => task.priority === priority).length,
      weight: tasks.filter((task) => task.priority === priority).reduce((sum, task) => sum + task.calculatedWeight, 0),
    }))
    .filter((item) => item.taskCount > 0);
}

export function HistoryPanel({ items, formatHistoryDate }: { items: MemberActivityHistoryItemModel[]; formatHistoryDate: (value: string) => string }) {
  if (items.length === 0) {
    return (
      <Paper sx={sectionPaperSx}>
        <Typography sx={{ color: 'text.secondary' }}>No history events are available for this member yet.</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={sectionPaperSx}>
      <Stack spacing={2.5}>
        {items.map((item, index) => (
          <Stack key={item.id} direction="row" spacing={2}>
            <Stack alignItems="center" sx={{ pt: 0.25 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#2563eb' }} />
              {index < items.length - 1 ? <Box sx={{ width: 2, flexGrow: 1, backgroundColor: '#d9e3f1', mt: 1 }} /> : null}
            </Stack>
            <Box sx={{ pb: 2.5 }}>
              <Typography sx={{ color: 'text.primary', fontWeight: 600 }}>{formatHistoryHeadline(item)}</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{item.taskId ? <MuiTaskLink taskId={item.taskId} title={item.taskTitle} /> : item.taskTitle}</Typography>
              {item.details ? <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5, maxWidth: 720 }}>{formatHistoryDetails(item)}</Typography> : null}
              <Typography sx={{ color: 'text.secondary', fontSize: 12, mt: 0.75 }}>{formatHistoryDate(item.occurredAt)}</Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function MuiTaskLink({ taskId, title }: { taskId: string; title: string }) {
  return (
    <Typography component={Link} to={`/tasks/${taskId}`} sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 600 }}>
      {title}
    </Typography>
  );
}

function formatHistoryHeadline(item: MemberActivityHistoryItemModel) {
  if (item.eventType === 'ChangeRequest' && item.fromUserName && item.toUserName) {
    const actor = item.actionByName ?? 'Team Leader';
    if (item.summary.toLowerCase().includes('approved')) {
      return `${actor} reassigned the task from ${item.fromUserName} to ${item.toUserName}`;
    }
    if (item.summary.toLowerCase().includes('rejected')) {
      return `${actor} rejected the reassignment from ${item.fromUserName} to ${item.toUserName}`;
    }
    return `${actor} requested reassignment from ${item.fromUserName} to ${item.toUserName}`;
  }

  if (item.eventType === 'Status' && item.actionByName) {
    return `${item.summary} by ${item.actionByName}`;
  }

  if (item.eventType === 'Assignment' && item.actionByName) {
    return `Task assigned by ${item.actionByName}`;
  }

  if (item.eventType === 'Acknowledgement' && item.actionByName) {
    return `Task acknowledged by ${item.actionByName}`;
  }

  return item.summary;
}

function formatHistoryDetails(item: MemberActivityHistoryItemModel) {
  if (item.eventType === 'ChangeRequest' && item.fromUserName && item.toUserName && item.actionByName) {
    if (item.summary.toLowerCase().includes('approved')) {
      return `The reassignment from ${item.fromUserName} to ${item.toUserName} was approved by ${item.actionByName}.`;
    }

    if (item.summary.toLowerCase().includes('rejected')) {
      return `The reassignment from ${item.fromUserName} to ${item.toUserName} was rejected by ${item.actionByName}.`;
    }
  }

  return item.details ?? '';
}

export function getMemberStatusAccent(status: WorkloadStatus) {
  return statusAccent[status];
}

// Styled components
const AnimatedRingCircle = styled.circle`
  transition: stroke-dashoffset 1850ms cubic-bezier(0.22, 1, 0.36, 1);
`;
