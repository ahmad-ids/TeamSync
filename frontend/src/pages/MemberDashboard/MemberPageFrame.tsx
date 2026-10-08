import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Box,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { appColors } from '../../theme/theme';
import type { WorkloadPeriod } from '../../types/domain';

const periodOptions: { value: WorkloadPeriod; label: string }[] = [
  { value: 'thisWeek', label: 'This Week' },
  { value: 'nextWeek', label: 'Next Week' },
  { value: 'custom', label: 'Custom Range' },
];

const sharedCardRadius = '18px';

const controlFieldSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 46,
    borderRadius: sharedCardRadius,
    backgroundColor: appColors.light.background.subtle,
    '&:hover': {
      bgcolor: appColors.light.background.accent,
    },
  },
} as const;

interface MemberPageFrameProps {
  title: string;
  description: string;
  showPeriodSelector?: boolean;
  period?: WorkloadPeriod;
  onPeriodChange?: (period: WorkloadPeriod) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomStartDateChange?: (value: string) => void;
  onCustomEndDateChange?: (value: string) => void;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  infoMessage?: string | null;
  warningMessage?: string | null;
  children: React.ReactNode;
}

export function MemberPageFrame({
  title,
  description,
  showPeriodSelector = true,
  period,
  onPeriodChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  searchValue,
  searchPlaceholder = 'Search...',
  onSearchChange,
  infoMessage,
  warningMessage,
  children,
}: MemberPageFrameProps) {
  return (
    <Stack spacing={3.5}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', xl: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'stretch', xl: 'flex-start' }}>
          <Stack spacing={1.1} sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: 'text.primary', fontSize: 28, lineHeight: 1.08, fontWeight: 700, letterSpacing: '-0.03em' }}>
              {title}
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 760, fontSize: 14, lineHeight: 1.7 }}>
              {description}
            </Typography>
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="flex-end"
            sx={{ width: { xs: '100%', xl: 'auto' }, flexShrink: 0 }}
          >
            {onSearchChange ? (
              <TextField
                placeholder={searchPlaceholder}
                value={searchValue ?? ''}
                onChange={(event) => onSearchChange(event.target.value)}
                sx={{ ...controlFieldSx, width: { xs: '100%', sm: 320 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon sx={{ color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
            ) : null}

            {showPeriodSelector && period && onPeriodChange ? (
              <Paper
                sx={{
                  p: 0.5,
                  borderRadius: sharedCardRadius,
                  bgcolor: appColors.light.background.muted,
                  boxShadow: 'none',
                  overflow: 'hidden',
                  width: 'fit-content',
                }}
              >
                <ToggleButtonGroup
                  size="small"
                  value={period}
                  exclusive
                  onChange={(_, value: WorkloadPeriod | null) => value && onPeriodChange(value)}
                  sx={{
                    '& .MuiToggleButtonGroup-grouped': {
                      margin: 0,
                      border: 'none',
                      borderRadius: 0,
                    },
                    '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
                      borderLeft: `1px solid ${appColors.light.border.default}`,
                    },
                    '& .MuiToggleButtonGroup-firstButton': {
                      borderTopLeftRadius: '14px',
                      borderBottomLeftRadius: '14px',
                    },
                    '& .MuiToggleButtonGroup-lastButton': {
                      borderTopRightRadius: '14px',
                      borderBottomRightRadius: '14px',
                    },
                  }}
                >
                  {periodOptions.map((option) => (
                    <ToggleButton
                      key={option.value}
                      value={option.value}
                      sx={{
                        minHeight: 42,
                        px: 2.25,
                        color: 'text.secondary',
                        fontWeight: 500,
                        textTransform: 'none',
                        '&.Mui-selected': {
                          bgcolor: appColors.light.background.paper,
                          color: 'text.primary',
                          boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                        },
                      }}
                    >
                      {option.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Paper>
            ) : null}
          </Stack>
        </Stack>
      </Stack>

      {showPeriodSelector && period === 'custom' && onCustomStartDateChange && onCustomEndDateChange ? (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Start Date"
            type="date"
            value={customStartDate ?? ''}
            onChange={(event) => onCustomStartDateChange(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ ...controlFieldSx, width: { xs: '100%', md: 220 } }}
          />
          <TextField
            label="End Date"
            type="date"
            value={customEndDate ?? ''}
            onChange={(event) => onCustomEndDateChange(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ ...controlFieldSx, width: { xs: '100%', md: 220 } }}
          />
        </Stack>
      ) : null}

      {warningMessage ? <Alert severity="warning">{warningMessage}</Alert> : null}
      {infoMessage ? <Alert severity="info">{infoMessage}</Alert> : null}

      {children}
    </Stack>
  );
}
