import type { ReactNode } from 'react';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import type { ChangeRequestListResponseModel, ChangeRequestModel } from '../../types/domain';
import { workloadMetricColors } from '../../theme/theme';

interface ChangeRequestTableProps {
  data: ChangeRequestListResponseModel | null;
  loading: boolean;
  error: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  search: string;
  selectedType: '' | 'ChangeOwner' | 'ChangeDueDate' | 'IncreaseEstimatedEffort';
  sort: 'newest' | 'oldest' | 'impact';
  actionRequestId: string | null;
  onStatusChange: (status: 'Pending' | 'Approved' | 'Rejected') => void;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: '' | 'ChangeOwner' | 'ChangeDueDate' | 'IncreaseEstimatedEffort') => void;
  onSortChange: (value: 'newest' | 'oldest' | 'impact') => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'IncreaseEstimatedEffort', label: 'Complexity Upgrade' },
  { value: 'ChangeDueDate', label: 'Duration Extension' },
  { value: 'ChangeOwner', label: 'Change Owner' },
] as const;

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'impact', label: 'Highest Impact' },
] as const;

const typeChipColors: Record<ChangeRequestModel['requestType'], { bg: string; color: string }> = {
  ChangeOwner: { bg: '#e7f0ff', color: '#426ab8' },
  ChangeDueDate: { bg: '#fff0df', color: '#b86b2e' },
  IncreaseEstimatedEffort: { bg: '#e8efff', color: '#5b77b8' },
};

const statusChipColors: Record<ChangeRequestModel['status'], { bg: string; color: string }> = {
  Pending: { bg: '#fff5db', color: '#8d6300' },
  Approved: { bg: '#e7f5ea', color: '#2c7a4b' },
  Rejected: { bg: '#ffe9e7', color: '#c03f37' },
};

const controlFieldSx = {
  '& .MuiInputLabel-root': {
    color: '#7a879f',
  },
  '& .MuiOutlinedInput-root': {
    minHeight: 46,
    borderRadius: '12px',
    backgroundColor: '#f8fbff',
    '&:hover': {
      bgcolor: '#eef4ff',
    },
    '& input::placeholder': {
      color: '#7b879c',
      opacity: 1,
    },
  },
} as const;

export function ChangeRequestTable({
  data,
  loading,
  error,
  status,
  search,
  selectedType,
  sort,
  actionRequestId,
  onStatusChange,
  onSearchChange,
  onTypeChange,
  onSortChange,
  onApprove,
  onReject,
}: ChangeRequestTableProps) {
  const metrics = data?.metrics;
  const requests = data?.requests ?? [];

  return (
    <Stack spacing={4}>
      <Stack spacing={1.1}>
        <Typography sx={{ color: 'text.primary', fontSize: 28, lineHeight: 1.08, fontWeight: 700, letterSpacing: '-0.03em' }}>
          Change Requests
        </Typography>
        <Typography sx={{ color: 'text.secondary', maxWidth: 720, fontSize: 14, lineHeight: 1.7 }}>
          Review and manage major task modifications across the team with clear impact, ownership, and approval context.
        </Typography>
      </Stack>

      <Paper
        sx={{
          p: 0.5,
          borderRadius: '14px',
          bgcolor: '#eef3fb',
          boxShadow: 'none',
          overflow: 'hidden',
          width: 'fit-content',
        }}
      >
        <Tabs
          value={status}
          onChange={(_, value: 'Pending' | 'Approved' | 'Rejected') => onStatusChange(value)}
          sx={{
            minHeight: 42,
            '& .MuiTabs-flexContainer': {
              gap: 0.5,
            },
            '& .MuiTab-root': {
              minHeight: 42,
              px: 2.25,
              borderRadius: '10px',
              color: 'text.secondary',
              fontWeight: 500,
              textTransform: 'none',
            },
            '& .Mui-selected': {
              color: 'text.primary',
              bgcolor: '#ffffff',
              boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
            },
            '& .MuiTabs-indicator': {
              display: 'none',
            },
          }}
        >
          <Tab value="Pending" label={`Pending ${metrics ? `(${metrics.pendingCount})` : ''}`} />
          <Tab value="Approved" label={`Approved ${metrics ? `(${metrics.approvedCount})` : ''}`} />
          <Tab value="Rejected" label={`Rejected ${metrics ? `(${metrics.rejectedCount})` : ''}`} />
        </Tabs>
      </Paper>

      <Paper
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: '16px',
          bgcolor: '#f8fbff',
          border: '1px solid',
          borderColor: '#d9e3f1',
          boxShadow: 'none',
        }}
      >
        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xl: 'center' }}>
          <TextField
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter by task or requester..."
            sx={{ ...controlFieldSx, flex: 1, maxWidth: { xl: 480 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: '#94a3b8' }} />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              value={selectedType}
              onChange={(event) => onTypeChange(event.target.value as ChangeRequestTableProps['selectedType'])}
              label="Type"
              sx={{ ...controlFieldSx, minWidth: 190 }}
            >
              {typeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as ChangeRequestTableProps['sort'])}
              label="Sort"
              sx={{ ...controlFieldSx, minWidth: 180 }}
            >
              {sortOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </Paper>

      {loading ? (
        <Paper sx={{ p: 6, borderRadius: '16px', textAlign: 'center', boxShadow: 'none', border: '1px solid', borderColor: '#d9e3f1' }}>
          <CircularProgress />
        </Paper>
      ) : error ? (
        <Alert severity="error">
          {error}
        </Alert>
      ) : requests.length === 0 ? (
        <Paper sx={{ p: 6, borderRadius: '16px', textAlign: 'center', boxShadow: 'none', border: '1px solid', borderColor: '#d9e3f1' }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary', letterSpacing: '-0.02em' }}>
            No change requests found.
          </Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.7 }}>
            Adjust the filters or wait for members to submit a new major-change request.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2.5}>
          {requests.map((request) => (
            <Paper
              key={request.id}
              sx={{
                p: { xs: 2.4, md: 3 },
                borderRadius: '18px',
                border: '1px solid',
                borderColor: '#d9e3f1',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,251,255,0.98) 100%)',
                boxShadow: 'none',
              }}
            >
              <Stack spacing={2.5}>
                <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2.5} justifyContent="space-between">
                  <Stack spacing={1.25} sx={{ minWidth: 260, flex: 1 }}>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                      <Chip
                        label={request.requestTypeLabel}
                        sx={{
                          bgcolor: typeChipColors[request.requestType].bg,
                          color: typeChipColors[request.requestType].color,
                          fontWeight: 700,
                          borderRadius: '999px',
                        }}
                      />
                      <Chip
                        label={`${request.impactPercentage}% impact`}
                        sx={{
                          bgcolor: '#eef4ff',
                          color: '#325ea8',
                          fontWeight: 700,
                          borderRadius: '999px',
                        }}
                      />
                    </Stack>
                    <Stack spacing={0.7}>
                      <Typography sx={{ fontSize: 22, lineHeight: 1.2, fontWeight: 700, color: 'text.primary', letterSpacing: '-0.02em' }}>
                        {request.taskTitle}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                        <AccessTimeRoundedIcon sx={{ fontSize: 16 }} />
                        <Typography sx={{ fontSize: 13.5 }}>{formatRelativeTime(request.submittedAt)}</Typography>
                      </Stack>
                    </Stack>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2.5}
                    sx={{
                      flex: 1.2,
                      alignItems: { md: 'flex-start' },
                      justifyContent: 'space-between',
                    }}
                  >
                    <InfoBlock label="Requester" value={request.requesterName} icon={<PersonRoundedIcon sx={{ fontSize: 18, color: '#2563eb' }} />} />
                    <InfoBlock label="Assigned To" value={request.assignedMemberName} />
                    <Stack spacing={0.65}>
                      <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.65 }}>
                        Proposed Change
                      </Typography>
                      <Typography sx={{ color: 'text.primary', fontSize: 14.5, fontWeight: 600, lineHeight: 1.55 }}>
                        {request.oldValue}
                        <Box component="span" sx={{ mx: 0.9, color: '#8aa0c4' }}>→</Box>
                        {request.newValue}
                      </Typography>
                    </Stack>
                  </Stack>

                  <Stack spacing={1.1} alignItems={{ xs: 'flex-start', xl: 'flex-end' }}>
                    {request.status === 'Pending' ? null : (
                      <Chip
                        label={`${request.status}${request.reviewedByName ? ` by ${request.reviewedByName}` : ''}`}
                        sx={{
                          bgcolor: statusChipColors[request.status].bg,
                          color: statusChipColors[request.status].color,
                          fontWeight: 700,
                          borderRadius: '999px',
                        }}
                      />
                    )}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} alignItems={{ sm: 'center' }}>
                      <Button
                        component={Link}
                        to={`/tasks/${request.taskId}`}
                        variant="text"
                        endIcon={<ArrowForwardRoundedIcon />}
                        sx={{ color: 'primary.main', fontWeight: 600, textTransform: 'none' }}
                      >
                        View Details
                      </Button>
                    {request.status === 'Pending' ? (
                      <>
                        <Button
                          variant="outlined"
                          color="error"
                          disabled={actionRequestId === request.id}
                          onClick={() => onReject(request.id)}
                          sx={{
                            px: 2.25,
                            minHeight: 40,
                            borderRadius: '11px',
                            fontWeight: 600,
                            textTransform: 'none',
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="contained"
                          disabled={actionRequestId === request.id}
                          onClick={() => onApprove(request.id)}
                          sx={{
                            px: 2.5,
                            minHeight: 40,
                            borderRadius: '11px',
                            fontWeight: 600,
                            textTransform: 'none',
                            bgcolor: 'primary.main',
                            '&:hover': { bgcolor: 'primary.dark' },
                          }}
                        >
                          {actionRequestId === request.id ? 'Saving...' : 'Approve'}
                        </Button>
                      </>
                    ) : null}
                    </Stack>
                  </Stack>
                </Stack>

                <Divider sx={{ borderColor: '#e3eaf5' }} />

                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={2.5}
                  justifyContent="space-between"
                  alignItems={{ lg: 'flex-start' }}
                >
                  <Stack spacing={0.65} sx={{ flex: 1, maxWidth: 780 }}>
                    <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.65 }}>
                      Reason
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{request.reason}</Typography>
                  </Stack>
                  <Stack spacing={0.75} alignItems={{ lg: 'flex-end' }}>
                    {request.reviewedAt ? (
                      <Typography sx={{ color: 'text.secondary', fontSize: 13.5 }}>
                        Reviewed {formatRelativeTime(request.reviewedAt)}
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 2.5,
        }}
      >
        <MetricCard
          title="Approval Velocity"
          value={`${metrics?.averageResponseHours ?? 0} hrs`}
          caption="Avg. response time"
          icon={<AccessTimeRoundedIcon />}
          accent="#1d4ed8"
          background="background.paper"
          borderColor="#d9e6ff"
        />
        <MetricCard
          title="Total Impact"
          value={`+${metrics?.totalImpactPercentage ?? 0}%`}
          caption="Resource variance"
          icon={<FilterListRoundedIcon />}
          accent="#4f46e5"
          background="background.paper"
          borderColor="#e1ddff"
        />
        <MetricCard
          title="Queue Health"
          value={metrics?.queueHealth ?? 'Balanced'}
          caption={metrics?.queueHealthDetail ?? '0.0 requests per member'}
          icon={<CheckCircleRoundedIcon />}
          accent={workloadMetricColors.effortHours}
          background="background.paper"
          borderColor="#d8e4fb"
        />
      </Box>
    </Stack>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <Stack spacing={0.55}>
      <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.65 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.75} alignItems="center">
        {icon}
        <Typography sx={{ color: 'text.primary', fontSize: 14.5, fontWeight: 600, lineHeight: 1.45 }}>{value}</Typography>
      </Stack>
    </Stack>
  );
}

function MetricCard({
  title,
  value,
  caption,
  icon,
  accent,
  background,
  borderColor,
}: {
  title: string;
  value: string;
  caption: string;
  icon: ReactNode;
  accent: string;
  background: string;
  borderColor: string;
}) {
  return (
    <Paper
      sx={(theme) => ({
        p: 2.2,
        borderRadius: '16px',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? alpha(accent, 0.22) : borderColor,
        bgcolor: background,
        boxShadow: 'none',
      })}
    >
      <Stack spacing={1.5} justifyContent="space-between" sx={{ minHeight: 112 }}>
        <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 26, lineHeight: 1.15, fontWeight: 700, color: accent }}>{value}</Typography>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 500 }}>{caption}</Typography>
          <Box sx={{ color: accent }}>{icon}</Box>
        </Stack>
      </Stack>
    </Paper>
  );
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  for (const [unit, amount] of ranges) {
    if (Math.abs(seconds) >= amount || unit === 'minute') {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(seconds / amount), unit);
    }
  }

  return date.toLocaleDateString();
}

