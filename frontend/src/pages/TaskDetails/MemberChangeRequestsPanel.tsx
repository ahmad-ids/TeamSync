import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ChangeRequestModel } from '../../types/domain';
import { appColors } from '../../theme/theme';

interface MemberChangeRequestsPanelProps {
  requests: ChangeRequestModel[];
  isLoading: boolean;
}

const statusStyles: Record<ChangeRequestModel['status'], { bg: string; color: string }> = {
  Pending: { bg: '#fff5db', color: '#8a6700' },
  Approved: { bg: '#e8f7ee', color: '#256c47' },
  Rejected: { bg: '#fff1f0', color: '#c03434' },
};

export function MemberChangeRequestsPanel({ requests, isLoading }: MemberChangeRequestsPanelProps) {
  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: alpha(appColors.light.border.default, 0.8),
        background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,255,0.98) 100%)',
        boxShadow: 'none',
      }}
    >
      <Stack spacing={2.25}>
        <Stack spacing={0.75}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
            My Change Requests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track the approval status of the major changes you have submitted for this task.
          </Typography>
        </Stack>

        {isLoading ? (
          <Alert severity="info">Loading your submitted change requests...</Alert>
        ) : requests.length === 0 ? (
          <Alert severity="info">No change requests submitted for this task yet.</Alert>
        ) : (
          <Stack spacing={1.5}>
            {requests.map((request) => {
              const statusStyle = statusStyles[request.status];
              return (
                <Stack
                  key={request.id}
                  spacing={1}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: `1px solid ${alpha(appColors.light.border.default, 0.9)}`,
                    bgcolor: appColors.light.background.paper,
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {request.requestTypeLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Submitted {formatDateTime(request.submittedAt)}
                      </Typography>
                    </Stack>
                    <Chip
                      label={request.status}
                      size="small"
                      sx={{ alignSelf: 'flex-start', bgcolor: statusStyle.bg, color: statusStyle.color, fontWeight: 700 }}
                      />
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      bgcolor: alpha(appColors.light.background.subtle, 0.95),
                    }}
                  >
                    <ValueBlock label="Current" value={request.oldValue} />
                    <ValueBlock label="Requested" value={request.newValue} />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    {request.reason}
                  </Typography>

                  {request.reviewedAt ? (
                    <Typography variant="caption" color="text.secondary">
                      Reviewed by {request.reviewedByName ?? 'Team Leader'} on {formatDateTime(request.reviewedAt)}
                    </Typography>
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function ValueBlock({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, wordBreak: 'break-word' }}>
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
