import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { WorkloadInsightsSection } from './WorkloadInsightsSection';
import { WorkloadCard } from './WorkloadCard';
import type { TaskSpecialization, WorkloadPeriod, WorkloadSort, WorkloadSummaryModel } from '../../types/domain';
import { appColors, getOverloadedMetricColors, getWorkloadWeightMetricColors, workloadMetricColors } from '../../theme/theme';
import { assignmentSpecializations, getWorkloadPriority, specializationLabel } from '../../utils/specialization';

interface WorkloadOverviewProps {
  data: WorkloadSummaryModel | null;
  error: string;
  isLoading: boolean;
  clickUpConnectionStatus: 'loading' | 'connected' | 'disconnected' | 'error';
  clickUpWorkspaceName: string;
  period: WorkloadPeriod;
  search: string;
  sortBy: WorkloadSort;
  viewMode: 'grid' | 'list';
  customStartDate: string;
  customEndDate: string;
  onPeriodChange: (period: WorkloadPeriod) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: WorkloadSort) => void;
  onViewModeChange: (value: 'grid' | 'list') => void;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
}

const periodOptions: { value: WorkloadPeriod; label: string }[] = [
  { value: 'thisWeek', label: 'This Week' },
  { value: 'nextWeek', label: 'Next Week' },
  { value: 'custom', label: 'Custom Range' },
];

type WorkloadStatusFilter = 'All' | 'Available' | 'Moderate' | 'Overloaded';
type WorkloadRoleFilter = 'All' | Exclude<TaskSpecialization, 'Unknown'>;

const controlFieldSx = {
  '& .MuiInputLabel-root': {
    color: '#7a879f',
  },
  '& .MuiOutlinedInput-root': {
    minHeight: 46,
    borderRadius: '12px',
    '&:hover': {
      bgcolor: appColors.light.background.accent,
    },
    '& input::placeholder': {
      color: '#7b879c',
      opacity: 1,
    },
  },
} as const;

const memberCapacityThreshold = 25;

const filterChipStyles = {
  Available: {
    bg: '#edf8f2',
    border: '#cfe9dc',
    color: '#1f9d68',
    activeBg: '#dff2e8',
    hoverBg: '#e6f5ed',
  },
  Moderate: {
    bg: '#fff6e2',
    border: '#f3dfaa',
    color: '#b7791f',
    activeBg: '#ffedc2',
    hoverBg: '#fff1cf',
  },
  Overloaded: {
    bg: '#fff1ef',
    border: '#ffd8d3',
    color: '#dc2626',
    activeBg: '#ffe3de',
    hoverBg: '#ffebe7',
  },
} as const;

function getSummaryCards(data: WorkloadSummaryModel) {
  const workloadWeightColors = getWorkloadWeightMetricColors(data.capacityPercentage);
  const overloadedColors = getOverloadedMetricColors(data.overloadedMembers);

  return [
    {
      label: 'Total Team',
      value: data.totalTeamMembers.toString(),
      accent: workloadMetricColors.totalTeam,
      background: '#fdfefe',
      borderColor: '#d9e6ff',
    },
    {
      label: 'Total Tasks',
      value: data.totalTasks.toString(),
      accent: workloadMetricColors.totalTasks,
      background: '#fdfefe',
      borderColor: '#d9e6ff',
    },
    {
      label: 'Effort Hours',
      value: `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(data.totalEffortHours)}h`,
      accent: workloadMetricColors.effortHours,
      background: '#fdfefe',
      borderColor: '#d8e4fb',
    },
    {
      label: 'Workload Weight',
      value: `${data.capacityPercentage}%`,
      accent: workloadWeightColors.accent,
      background: '#fdfefe',
      borderColor: workloadWeightColors.borderColor,
    },
    {
      label: 'Overloaded',
      value: data.overloadedMembers.toString(),
      accent: overloadedColors.accent,
      background: '#fdfefe',
      borderColor: overloadedColors.borderColor,
    },
  ];
}

function buildSummaryData(
  sourceMembers: WorkloadSummaryModel['members'],
  baseData: Pick<WorkloadSummaryModel, 'startDate' | 'endDate' | 'teams'>,
): WorkloadSummaryModel {
  const totalTeamMembers = sourceMembers.length;
  const totalTasks = sourceMembers.reduce((sum, member) => sum + member.totalTasks, 0);
  const totalEffortHours = sourceMembers.reduce((sum, member) => sum + member.totalEffortHours, 0);
  const totalWeight = sourceMembers.reduce((sum, member) => sum + member.totalWeight, 0);
  const overloadedMembers = sourceMembers.filter((member) => member.status === 'Overloaded').length;
  const capacityPercentage = totalTeamMembers === 0
    ? 0
    : Math.round((totalWeight / (totalTeamMembers * memberCapacityThreshold)) * 1000) / 10;

  return {
    ...baseData,
    totalTeamMembers,
    totalTasks,
    totalEffortHours,
    totalWeight,
    capacityPercentage,
    overloadedMembers,
    members: sourceMembers,
  };
}

export function WorkloadOverview({
  data,
  error,
  isLoading,
  clickUpConnectionStatus,
  clickUpWorkspaceName,
  period,
  search,
  sortBy,
  viewMode,
  customStartDate,
  customEndDate,
  onPeriodChange,
  onSearchChange,
  onSortChange,
  onViewModeChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
}: WorkloadOverviewProps) {
  const [statusFilter, setStatusFilter] = useState<WorkloadStatusFilter>('All');
  const [roleFilter, setRoleFilter] = useState<WorkloadRoleFilter>('All');
  const [addTeamMemberDialogOpen, setAddTeamMemberDialogOpen] = useState(false);
  const roleOptions = useMemo(
    () =>
      assignmentSpecializations.filter((specialization) =>
        data?.members.some((member) => member.specialization === specialization),
      ),
    [data],
  );
  const roleFilteredMembers = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.members.filter((member) => roleFilter === 'All' || member.specialization === roleFilter);
  }, [data, roleFilter]);
  const visibleMembers = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalizedSearch = search.trim().toLowerCase();
    const filteredMembers = roleFilteredMembers.filter((member) => {
      const matchesStatus = statusFilter === 'All' || member.status === statusFilter;
      const matchesSearch = normalizedSearch.length === 0
        || member.fullName.toLowerCase().includes(normalizedSearch)
        || member.email.toLowerCase().includes(normalizedSearch)
        || member.jobTitle.toLowerCase().includes(normalizedSearch)
        || member.teamName.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });

    return [...filteredMembers].sort((left, right) => {
      const primaryDelta = compareMembers(left, right, sortBy);
      if (primaryDelta !== 0) {
        return primaryDelta;
      }

      const statusDelta = getWorkloadPriority(left.status) - getWorkloadPriority(right.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      if (left.capacityPercentage !== right.capacityPercentage) {
        return left.capacityPercentage - right.capacityPercentage;
      }

      return left.fullName.localeCompare(right.fullName);
    });
  }, [data, roleFilteredMembers, search, sortBy, statusFilter]);
  const summaryData = useMemo(() => {
    if (!data) {
      return null;
    }

    return buildSummaryData(roleFilteredMembers, {
      startDate: data.startDate,
      endDate: data.endDate,
      teams: data.teams,
    });
  }, [data, roleFilteredMembers]);

  return (
    <Stack spacing={2.25}>
      <Stack
        direction={{ xs: 'column', xl: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', xl: 'center' }}
        spacing={1.25}
      >
        <Box>
          <Typography sx={{ fontSize: 28, lineHeight: 1.08, fontWeight: 700, color: 'text.primary', letterSpacing: '-0.03em' }}>
            Workload Dashboard
          </Typography>
          <Typography sx={{ mt: 0.55, color: 'text.secondary' }}>
            Monitor and distribute tasks for your team.
          </Typography>
          <Typography
            sx={{
              mt: 0.85,
              color: clickUpConnectionStatus === 'connected'
                ? '#1f7a46'
                : clickUpConnectionStatus === 'error'
                  ? '#b45309'
                  : '#6b7280',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            {clickUpConnectionStatus === 'loading'
              ? 'Checking ClickUp connection...'
              : clickUpConnectionStatus === 'connected'
                ? `ClickUp connected: ${clickUpWorkspaceName}`
                : clickUpConnectionStatus === 'error'
                  ? 'Unable to verify ClickUp connection'
                  : 'ClickUp is not connected'}
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => setAddTeamMemberDialogOpen(true)}
            sx={{
              minWidth: 150,
              minHeight: 42,
              px: 2.1,
              fontWeight: 500,
              bgcolor: '#ffffff',
              color: appColors.light.primary.main,
              borderColor: '#C7DAFF',
              boxShadow: '0 8px 18px rgba(37, 99, 235, 0.10)',
              '& .MuiButton-startIcon': {
                color: 'inherit',
              },
              '&:hover': {
                bgcolor: '#F5F9FF',
                borderColor: '#AFCBFF',
                boxShadow: '0 10px 22px rgba(37, 99, 235, 0.14)',
              },
              '&.Mui-focusVisible': {
                boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.16), 0 8px 18px rgba(37, 99, 235, 0.10)',
              },
              transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
            }}
          >
            Add Team Member
          </Button>
        </Stack>
      </Stack>

      {error && !data ? <Alert severity="warning">{error}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            lg: 'minmax(0, 2.6fr) minmax(320px, 1fr)',
          },
          gridTemplateRows: {
            lg: 'auto auto',
          },
          alignItems: {
            xs: 'start',
            lg: 'stretch',
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            minWidth: 0,
            height: {
              lg: '100%',
            },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(5, minmax(0, 1fr))',
              },
            }}
          >
            {(summaryData ? getSummaryCards(summaryData) : getSummaryCards({
              startDate: '',
              endDate: '',
              totalTeamMembers: 0,
              totalTasks: 0,
              totalEffortHours: 0,
              totalWeight: 0,
              capacityPercentage: 0,
              overloadedMembers: 0,
              teams: [],
              members: [],
            } as WorkloadSummaryModel)).map((item) => (
              <Box key={item.label}>
                <SummaryCard
                  label={item.label}
                  value={summaryData ? item.value : '--'}
                  accent={item.accent}
                  background={item.background}
                  borderColor={item.borderColor}
                />
              </Box>
            ))}
          </Box>

          <WorkloadInsightsSection members={roleFilteredMembers} />
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            minWidth: 0,
            height: {
              lg: '100%',
            },
            gridColumn: {
              lg: 2,
            },
            gridRow: {
              lg: '1 / span 2',
            },
          }}
        >
          <Paper
            sx={{
              px: 1.75,
              pt: 1.75,
              pb: 0.7,
              borderRadius: '16px',
              bgcolor: appColors.light.background.accent,
              borderColor: 'divider',
              boxShadow: 'none',
              minWidth: 0,
              flex: {
                lg: 1,
              },
            }}
          >
            <Stack spacing={1.15} sx={{ height: '100%' }}>
            <TextField
              placeholder="Search team members..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              fullWidth
              sx={{ ...controlFieldSx }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: '#7b8ba6', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                },
                alignItems: 'start',
              }}
            >
              <TextField
                select
                label="Role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as WorkloadRoleFilter)}
                fullWidth
                sx={{ ...controlFieldSx, minWidth: 0 }}
              >
                <MenuItem value="All">All Roles</MenuItem>
                {roleOptions.map((specialization) => (
                  <MenuItem key={specialization} value={specialization}>
                    {specializationLabel[specialization]}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Sort"
                value={sortBy}
                onChange={(event) => onSortChange(event.target.value as WorkloadSort)}
                fullWidth
                sx={{ ...controlFieldSx, minWidth: 0 }}
              >
                <MenuItem value="workload">Highest workload</MenuItem>
                <MenuItem value="workloadAsc">Lowest workload</MenuItem>
                <MenuItem value="effort">Effort</MenuItem>
                <MenuItem value="tasks">Tasks</MenuItem>
                <MenuItem value="name">Name</MenuItem>
              </TextField>
            </Box>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <LegendChip label="All" selected={statusFilter === 'All'} onClick={() => setStatusFilter('All')} />
              <LegendChip label="Available" selected={statusFilter === 'Available'} onClick={() => setStatusFilter('Available')} />
              <LegendChip label="Moderate" selected={statusFilter === 'Moderate'} onClick={() => setStatusFilter('Moderate')} />
              <LegendChip label="Overloaded" selected={statusFilter === 'Overloaded'} onClick={() => setStatusFilter('Overloaded')} />
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto' }}>
              <ToggleButtonGroup
                size="small"
                value={viewMode}
                exclusive
                onChange={(_, value: 'grid' | 'list' | null) => value && onViewModeChange(value)}
                sx={{
                  p: 0.25,
                  borderRadius: '12px',
                  bgcolor: '#edf3fb',
                  border: '1px solid',
                  borderColor: 'divider',
                  gap: 0.25,
                  '& .MuiToggleButtonGroup-grouped': {
                    border: 'none',
                    borderRadius: '10px !important',
                    minWidth: 42,
                    color: '#6b7890',
                    transition: 'background-color 180ms ease, color 180ms ease, box-shadow 180ms ease',
                    '&:hover': {
                      bgcolor: '#e3ecf8',
                    },
                    '&.Mui-selected': {
                      bgcolor: '#ffffff',
                      color: '#172033',
                      boxShadow: '0 4px 10px rgba(15, 23, 42, 0.08)',
                    },
                    '&.Mui-selected:hover': {
                      bgcolor: '#ffffff',
                    },
                  },
                }}
              >
                <ToggleButton value="grid" sx={{ px: 1.6 }}>
                  <ViewModuleRoundedIcon />
                </ToggleButton>
                <ToggleButton value="list" sx={{ px: 1.6 }}>
                  <ViewAgendaOutlinedIcon />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            </Stack>
          </Paper>

          <Paper
            sx={{
              p: 0.5,
              borderRadius: '14px',
              bgcolor: appColors.light.background.muted,
              boxShadow: 'none',
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <ToggleButtonGroup
              size="small"
              value={period}
              exclusive
              onChange={(_, value: WorkloadPeriod | null) => value && onPeriodChange(value)}
              fullWidth
              sx={{
                gap: 0,
                borderRadius: '12px',
                overflow: 'hidden',
                width: '100%',
                '& .MuiToggleButtonGroup-grouped': {
                  margin: 0,
                  border: 'none',
                  borderRadius: 0,
                  flex: 1,
                },
                '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
                  borderLeft: `1px solid ${appColors.light.border.default}`,
                },
                '& .MuiToggleButtonGroup-grouped:first-of-type': {
                  borderTopLeftRadius: '10px',
                  borderBottomLeftRadius: '10px',
                },
                '& .MuiToggleButtonGroup-grouped:last-of-type': {
                  borderTopRightRadius: '10px',
                  borderBottomRightRadius: '10px',
                },
              }}
            >
              {periodOptions.map((option) => (
                <ToggleButton
                  key={option.value}
                  value={option.value}
                  sx={{
                    border: 'none',
                    px: 1.75,
                    color: 'text.secondary',
                    fontWeight: 500,
                    textTransform: 'none',
                    minHeight: 40,
                    width: '100%',
                    '&.Mui-selected': {
                      bgcolor: appColors.light.background.paper,
                      color: 'text.primary',
                      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                    },
                    '&.Mui-selected:first-of-type': {
                      borderTopLeftRadius: '10px',
                      borderBottomLeftRadius: '10px',
                    },
                    '&.Mui-selected:last-of-type': {
                      borderTopRightRadius: '10px',
                      borderBottomRightRadius: '10px',
                    },
                  }}
                >
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>

          {period === 'custom' && (
            <Paper
              sx={{
                p: 0.5,
                borderRadius: '14px',
                bgcolor: appColors.light.background.muted,
                boxShadow: 'none',
                overflow: 'hidden',
                width: '100%',
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={customStartDate}
                  onChange={(event) => onCustomStartDateChange(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: { xs: '100%', md: 220 } }}
                />
                <TextField
                  label="End Date"
                  type="date"
                  value={customEndDate}
                  onChange={(event) => onCustomEndDateChange(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: { xs: '100%', md: 220 } }}
                />
              </Stack>
            </Paper>
          )}
        </Box>
      </Box>

      {isLoading && data ? (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={18} />
          <Typography color="text.secondary">Refreshing workload data...</Typography>
        </Stack>
      ) : null}

      {period === 'custom' && (!customStartDate || !customEndDate) ? (
        <Alert severity="info">Choose a start and end date to view a custom workload range.</Alert>
      ) : null}

      {!isLoading && data && visibleMembers.length === 0 ? (
        <Paper sx={{ p: 3, borderRadius: 3.5, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
            No members match the current filters.
          </Typography>
          <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
            Try another role, status, search term, or time range.
          </Typography>
        </Paper>
      ) : null}

      <Grid container spacing={1.5}>
        {visibleMembers.map((member) => (
          <Grid key={member.memberId} size={{ xs: 12, xl: viewMode === 'grid' ? 4 : 12 }}>
            <WorkloadCard
              member={member}
              viewMode={viewMode}
              detailsHref={buildMemberDetailsHref(member.memberId, period, customStartDate, customEndDate)}
            />
          </Grid>
        ))}
      </Grid>

      <AddTeamMemberDialog
        open={addTeamMemberDialogOpen}
        onClose={() => setAddTeamMemberDialogOpen(false)}
      />
    </Stack>
  );
}

interface AddTeamMemberDialogProps {
  open: boolean;
  onClose: () => void;
}

function AddTeamMemberDialog({ open, onClose }: AddTeamMemberDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(23, 32, 51, 0.28)',
          },
        },
        paper: {
          sx: {
            borderRadius: '18px',
            border: '1px solid',
            borderColor: appColors.light.border.default,
            boxShadow: '0 24px 54px rgba(40, 61, 112, 0.10)',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          px: { xs: 2.5, sm: 3.5, md: 4.1 },
          pt: { xs: 2.5, md: 3.1 },
          pb: 0,
        }}
      >
        <Stack spacing={0.35}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography
                sx={{
                  color: 'text.primary',
                  fontSize: { xs: '1.55rem', md: '1.8rem' },
                  lineHeight: 1.08,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                }}
              >
                Add Team Member
              </Typography>
              <Typography
                sx={{
                  mt: 1.1,
                  ml: 0.75,
                  mb: 1.5,
                  color: 'text.secondary',
                  fontSize: { xs: '0.92rem', md: '0.95rem' },
                  lineHeight: 1.45,
                  maxWidth: 620,
                }}
              >
                Add an employee to your team using their ClickUp email address.
              </Typography>
            </Box>
            <IconButton
              aria-label="Close add team member dialog"
              onClick={onClose}
              sx={{
                mt: -0.25,
                mr: -0.5,
                color: 'text.secondary',
                borderRadius: '10px',
              }}
            >
              <CloseRoundedIcon />
            </IconButton>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent
        sx={{
          px: { xs: 2.5, sm: 3.5, md: 4.1 },
          pb: { xs: 2.5, md: 3.1 },
          pt: 4.5,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            borderRadius: '14px',
            border: '1px solid',
            borderColor: appColors.light.border.default,
            backgroundColor: appColors.light.background.paper,
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
            px: { xs: 2, sm: 2.5, md: 2.8 },
            py: { xs: 2, md: 2.25 },
          }}
        >
          <Stack spacing={3.2}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '9px',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: '#ebf2ff',
                  color: appColors.light.primary.main,
                  flex: '0 0 auto',
                }}
              >
                <PersonAddAltOutlinedIcon sx={{ fontSize: 17 }} />
              </Box>
              <Typography
                sx={{
                  color: 'text.primary',
                  fontSize: '1.04rem',
                  lineHeight: 1.2,
                  fontWeight: 700,
                }}
              >
                Member Information
              </Typography>
            </Stack>

            <Stack spacing={0.75}>
              <Typography
                component="label"
                htmlFor="clickup-email"
                sx={{
                  color: '#6b7280',
                  fontSize: 13,
                  lineHeight: 1.2,
                  fontWeight: 600,
                }}
              >
                ClickUp Email Address
              </Typography>
              <TextField
                id="clickup-email"
                placeholder="name@company.com"
                fullWidth
                autoComplete="email"
                InputProps={{
                  sx: {
                    minHeight: 42,
                    borderRadius: '11px',
                    backgroundColor: '#eef3f8',
                    '& input': {
                      px: 1.7,
                      py: 1.15,
                      fontSize: 14,
                      fontWeight: 500,
                      color: appColors.light.text.primary,
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'transparent',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#d7dfea',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: appColors.light.border.focus,
                    },
                  },
                }}
              />
              <Stack direction="row" spacing={0.7} alignItems="flex-start" sx={{ mt: -0.15 }}>
                <InfoOutlinedIcon sx={{ fontSize: 14, color: '#8a93a7', mt: '2px', flex: '0 0 auto' }} />
                <Typography
                  sx={{
                    color: '#75809a',
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  The email must belong to a user in the connected ClickUp workspace.
                </Typography>
              </Stack>
            </Stack>

          </Stack>
        </Paper>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2.5, sm: 3.5, md: 4.1 }, pb: { xs: 2.5, md: 3.1 }, pt: 0.15, gap: 1.25 }}>
        <Button
          type="button"
          variant="text"
          onClick={onClose}
          sx={{
            minHeight: 42,
            px: 0.75,
            color: appColors.light.text.primary,
            fontWeight: 600,
            borderRadius: '11px',
            '&:hover': {
              backgroundColor: 'transparent',
              color: appColors.light.primary.main,
            },
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="contained"
          disableElevation
          onClick={() => undefined}
          sx={{
            minWidth: 150,
            minHeight: 42,
            borderRadius: '11px',
            bgcolor: appColors.light.button.primary.base,
            boxShadow: appColors.light.shadow.button,
            px: 2.5,
            '&:hover': {
              bgcolor: appColors.light.button.primary.hover,
              boxShadow: appColors.light.shadow.buttonHover,
            },
            '&:active': {
              bgcolor: appColors.light.button.primary.active,
              boxShadow: 'none',
            },
          }}
        >
          Add Team Member
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  accent: string;
  background: string;
  borderColor: string;
}

function SummaryCard({ label, value, accent, background, borderColor }: SummaryCardProps) {
  return (
    <Paper
      sx={{
        p: 1.6,
        borderRadius: '16px',
        border: '1px solid',
        borderColor,
        bgcolor: background,
        minHeight: 84,
        boxShadow: 'none',
      }}
    >
      <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.5, color: accent, fontSize: 26, lineHeight: 1.15, fontWeight: 700 }}>
        {value}
      </Typography>
    </Paper>
  );
}

interface LegendChipProps {
  label: WorkloadStatusFilter;
  selected: boolean;
  onClick: () => void;
}

function LegendChip({ label, selected, onClick }: LegendChipProps) {
  const tone =
    label === 'All'
      ? {
          bg: '#eef3fb',
          border: '#d7e0ec',
          color: '#5f6b85',
          activeBg: '#e2ebf8',
          hoverBg: '#e8f0fa',
        }
      : filterChipStyles[label];

  return (
    <Chip
      label={label}
      component="button"
      clickable
      onClick={onClick}
      sx={{
        height: 34,
        borderRadius: '999px',
        border: '1px solid',
        borderColor: selected ? tone.color : tone.border,
        bgcolor: selected ? tone.activeBg : tone.bg,
        color: tone.color,
        transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
        '&:hover': {
          bgcolor: selected ? tone.activeBg : tone.hoverBg,
          boxShadow: '0 4px 10px rgba(15, 23, 42, 0.06)',
          transform: 'translateY(-1px)',
        },
        '& .MuiChip-label': {
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontWeight: 600,
          paddingInline: '12px',
        },
      }}
    />
  );
}

function buildMemberDetailsHref(memberId: string, period: WorkloadPeriod, startDate: string, endDate: string) {
  const params = new URLSearchParams({ period });
  if (period === 'custom') {
    if (startDate) {
      params.set('startDate', startDate);
    }
    if (endDate) {
      params.set('endDate', endDate);
    }
  }

  return `/members/${memberId}?${params.toString()}`;
}

function compareMembers(left: WorkloadSummaryModel['members'][number], right: WorkloadSummaryModel['members'][number], sortBy: WorkloadSort) {
  switch (sortBy) {
    case 'name':
      return left.fullName.localeCompare(right.fullName);
    case 'tasks':
      return right.totalTasks - left.totalTasks;
    case 'effort':
      return right.totalEffortHours - left.totalEffortHours;
    case 'workloadAsc':
      return left.totalWeight - right.totalWeight;
    case 'workload':
    default:
      return right.totalWeight - left.totalWeight;
  }
}
