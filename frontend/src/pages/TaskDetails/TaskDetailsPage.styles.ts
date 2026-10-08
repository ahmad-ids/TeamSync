import { alpha } from '@mui/material/styles';
import { appColors } from '../../theme/theme';

export const statusColors: Record<string, { bg: string; color: string }> = {
  New: { bg: '#eef4ff', color: '#3b66b0' },
  InProgress: { bg: '#e8f1ff', color: '#3f6dbc' },
  Blocked: { bg: '#fff1f0', color: '#d14343' },
  Done: { bg: '#e8f7ee', color: '#2d8a57' },
};

export const priorityColors: Record<string, { bg: string; color: string }> = {
  Low: { bg: '#edf8f1', color: '#2f8b57' },
  Medium: { bg: '#f6f0db', color: '#8f6a00' },
  High: { bg: '#fff0f0', color: '#d94b4b' },
  Critical: { bg: '#ffe5e5', color: '#b42318' },
};

export const cardSurfaceSx = {
  p: { xs: 2.25, md: 3 },
  borderRadius: 3.5,
  border: `1px solid ${alpha(appColors.light.border.default, 0.95)}`,
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.05)',
  backgroundImage: 'none',
};

export const headerSurfaceSx = {
  ...cardSurfaceSx,
  bgcolor: alpha('#ffffff', 0.92),
  backdropFilter: 'blur(14px)',
};

export const mutedSidebarSx = {
  ...cardSurfaceSx,
  bgcolor: alpha(appColors.light.primary.main, 0.04),
  borderColor: alpha(appColors.light.primary.main, 0.16),
};

export const pageShellSx = {
  width: '100%',
  maxWidth: 1500,
  mx: 'auto',
};
