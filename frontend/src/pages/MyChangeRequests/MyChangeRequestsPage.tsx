import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Link as MuiLink,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getChangeRequests } from '../../services/changeRequestService';
import type { ChangeRequestListResponseModel, ChangeRequestModel } from '../../types/domain';
import { MemberAccessState } from '../MemberDashboard/MemberAccessState';
import { MemberPageFrame } from '../MemberDashboard/MemberPageFrame';
import { sectionPaperSx } from '../MemberDashboard/MemberDashboardWorkspace';
import { useMemberAccessState } from '../MemberDashboard/useMemberAccessState';

type ChangeRequestStatus = 'Pending' | 'Approved' | 'Rejected';
type ChangeRequestType = '' | 'ChangeOwner' | 'ChangeDueDate' | 'IncreaseEstimatedEffort';
type ChangeRequestSort = 'newest' | 'oldest' | 'impact';

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'IncreaseEstimatedEffort', label: 'Effort Increase' },
  { value: 'ChangeDueDate', label: 'Due Date Change' },
  { value: 'ChangeOwner', label: 'Change Owner' },
] as const;

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'impact', label: 'Highest Impact' },
] as const;

const statusStyles: Record<ChangeRequestModel['status'], { bg: string; color: string }> = {
  Pending: { bg: '#fff5db', color: '#8a6700' },
  Approved: { bg: '#e8f7ee', color: '#256c47' },
  Rejected: { bg: '#fff1f0', color: '#c03434' },
};

export function MyChangeRequestsPage() {
  const { isLoading: accessLoading, accessDeniedMessage } = useMemberAccessState();
  const [status, setStatus] = useState<ChangeRequestStatus>('Pending');
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<ChangeRequestType>('');
  const [sort, setSort] = useState<ChangeRequestSort>('newest');
  const [data, setData] = useState<ChangeRequestListResponseModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (accessLoading || accessDeniedMessage) {
      return () => undefined;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    void getChangeRequests({
      status,
      type: selectedType || undefined,
      search: deferredSearch || undefined,
      sort,
    })
      .then((response) => {
        if (isMounted) {
          setData(response);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Unable to load your change requests right now.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessDeniedMessage, accessLoading, deferredSearch, selectedType, sort, status]);

  if (accessLoading) {
    return (
      <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (accessDeniedMessage) {
    return <MemberAccessState message={accessDeniedMessage} />;
  }

  return (
    <MemberPageFrame
      title="My Change Requests"
      description="Review the task changes you have submitted, track approval status, and jump back into the related task when follow-up is needed."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by task title..."
    >
      <Stack spacing={3}>
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
            onChange={(_, value: ChangeRequestStatus) => setStatus(value)}
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
            <Tab value="Pending" label={`Pending ${data ? `(${data.metrics.pendingCount})` : ''}`} />
            <Tab value="Approved" label={`Approved ${data ? `(${data.metrics.approvedCount})` : ''}`} />
            <Tab value="Rejected" label={`Rejected ${data ? `(${data.metrics.rejectedCount})` : ''}`} />
          </Tabs>
        </Paper>

        <Paper sx={{ ...sectionPaperSx, p: { xs: 2, md: 2.5 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as ChangeRequestType)}
              label="Type"
              sx={{ minWidth: 190 }}
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
              onChange={(event) => setSort(event.target.value as ChangeRequestSort)}
              label="Sort"
              sx={{ minWidth: 190 }}
            >
              {sortOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (data?.requests.length ?? 0) === 0 ? (
          <Paper sx={{ ...sectionPaperSx, p: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary', letterSpacing: '-0.02em' }}>
              No change requests found
            </Typography>
            <Typography sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.7 }}>
              Submit a task change from a task details page to start the approval flow.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {data?.requests.map((request) => (
              <MemberChangeRequestCard key={request.id} request={request} />
            ))}
          </Stack>
        )}
      </Stack>
    </MemberPageFrame>
  );
}

function MemberChangeRequestCard({ request }: { request: ChangeRequestModel }) {
  const statusStyle = statusStyles[request.status];

  return (
    <Paper
      sx={{
        ...sectionPaperSx,
        border: '1px solid',
        borderColor: alpha('#d9e3f1', 0.95),
        background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,251,255,0.98) 100%)',
      }}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
          <Stack spacing={0.85}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
              <Chip
                label={request.requestTypeLabel}
                sx={{
                  bgcolor: '#eef4ff',
                  color: '#325ea8',
                  fontWeight: 700,
                  borderRadius: '999px',
                }}
              />
              <Chip
                label={request.status}
                sx={{
                  bgcolor: statusStyle.bg,
                  color: statusStyle.color,
                  fontWeight: 700,
                  borderRadius: '999px',
                }}
              />
            </Stack>
            <Typography sx={{ fontSize: 21, lineHeight: 1.2, fontWeight: 700, color: 'text.primary', letterSpacing: '-0.02em' }}>
              {request.taskTitle}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
              <AccessTimeRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 13.5 }}>Submitted {formatDateTime(request.submittedAt)}</Typography>
            </Stack>
          </Stack>

          <MuiLink
            component={Link}
            to={`/tasks/${request.taskId}`}
            underline="none"
            sx={{ color: 'primary.main', fontWeight: 700, alignSelf: 'flex-start' }}
          >
            Open task details
          </MuiLink>
        </Stack>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            bgcolor: alpha('#eef4ff', 0.52),
          }}
        >
          <ValueBlock label="Current value" value={request.oldValue} />
          <ValueBlock label="Requested value" value={request.newValue} />
          <ValueBlock label="Impact" value={`${request.impactPercentage}%`} />
        </Stack>

        <Stack spacing={0.6}>
          <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.65 }}>
            Reason
          </Typography>
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
            {request.reason}
          </Typography>
        </Stack>

        {request.reviewedAt ? (
          <Typography sx={{ color: 'text.secondary', fontSize: 13.25 }}>
            Reviewed by {request.reviewedByName ?? 'Team Leader'} on {formatDateTime(request.reviewedAt)}
          </Typography>
        ) : (
          <Typography sx={{ color: '#8a6700', fontSize: 13.25, fontWeight: 600 }}>
            Awaiting Team Leader review
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

function ValueBlock({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ color: '#64748b', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.65 }}>
        {label}
      </Typography>
      <Typography sx={{ color: 'text.primary', fontSize: 14.5, fontWeight: 600, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
