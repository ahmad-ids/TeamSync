import { alpha, createTheme } from '@mui/material/styles';

const primaryBlue = '#2563eb';
const primaryText = '#172033';
const secondaryText = '#5f6b85';
const appBorder = '#dbe4f0';
const primaryFontFamily = '"Plus Jakarta Sans", sans-serif';
const secondaryFontFamily = '"Cabin Condensed", sans-serif';
const smoothTransition = '180ms ease';

export const appColors = {
  light: {
    primary: {
      main: primaryBlue,
      dark: '#1d4ed8',
      light: '#dbeafe',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#64748b',
    },
    success: {
      main: '#1f9d68',
      light: '#e8f7ef',
    },
    warning: {
      main: '#d28a00',
      light: '#fff6db',
    },
    error: {
      main: '#d14343',
      light: '#ffe9e7',
    },
    background: {
      default: '#f4f7fb',
      paper: '#ffffff',
      accent: '#f7faff',
      subtle: '#f6f8fb',
      muted: '#eef3fb',
    },
    text: {
      primary: primaryText,
      secondary: secondaryText,
      muted: '#64748b',
    },
    border: {
      default: appBorder,
      soft: '#d9e1eb',
      hover: '#d6dee8',
      focus: '#d4dde8',
      info: '#d9e6ff',
      infoAlt: '#d8e4fb',
      accent: '#cfe0ff',
    },
    shadow: {
      paper: '0 8px 24px rgba(15, 23, 42, 0.05)',
      input: '0 10px 24px rgba(15, 23, 42, 0.08)',
      button: '0 10px 22px rgba(37, 99, 235, 0.18)',
      buttonHover: '0 12px 24px rgba(37, 99, 235, 0.2)',
    },
    button: {
      detail: {
        base: '#0e3a9f',
        hover: '#1a4bb8',
        active: '#0b2f80',
      },
      primary: {
        base: primaryBlue,
        hover: '#3474f4',
        active: '#1d4ed8',
        focusRing: '0 0 0 3px rgba(37, 99, 235, 0.16)',
      },
    },
    avatar: {
      memberBg: '#e3edff',
      memberIcon: '#2c5ec7',
    },
    surface: {
      drawer: 'linear-gradient(180deg, rgba(248,251,255,0.97) 0%, rgba(244,248,253,0.94) 100%)',
      appBar: 'rgba(255, 255, 255, 0.74)',
      shellGlow: 'radial-gradient(circle at 14% 12%, rgba(37, 99, 235, 0.08), transparent 24%), radial-gradient(circle at 88% 10%, rgba(56, 189, 248, 0.06), transparent 20%)',
      pageGradient: 'radial-gradient(circle at 18% 10%, rgba(59, 130, 246, 0.06), transparent 24%), linear-gradient(180deg, #f4f8ff 0%, #ffffff 100%)',
    },
  },
} as const;

export const workloadMetricColors = {
  totalTeam: '#2563eb',
  totalTasks: '#1d4ed8',
  effortHours: '#426ab8',
} as const;

export const workloadStateColors = {
  healthy: '#1f9d68',
  healthyBorder: '#cfe9dc',
  info: '#1d4ed8',
  infoBorder: '#d9e6ff',
  danger: '#dc2626',
  dangerBorder: '#ffd8d3',
} as const;

export function getWorkloadWeightMetricColors(capacityPercentage: number) {
  const isHealthy = capacityPercentage <= 100;
  return {
    accent: isHealthy ? workloadStateColors.healthy : workloadStateColors.danger,
    borderColor: isHealthy ? workloadStateColors.healthyBorder : workloadStateColors.dangerBorder,
  };
}

export function getOverloadedMetricColors(overloadedCount: number) {
  const isHealthy = overloadedCount === 0;
  return {
    accent: isHealthy ? workloadStateColors.healthy : workloadStateColors.danger,
    borderColor: isHealthy ? workloadStateColors.healthyBorder : workloadStateColors.dangerBorder,
  };
}

export function getTeamMemberCardLoadColors(capacityPercentage: number) {
  const isOverloaded = capacityPercentage > 100;
  const isNearCapacity = capacityPercentage >= 85 && capacityPercentage <= 100;
  const overloadAmount = Math.round(Math.max(capacityPercentage - 100, 0));

  let accent: string = workloadStateColors.info;
  let borderColor: string = workloadStateColors.infoBorder;
  let summaryText = 'Within safe range';

  if (isNearCapacity) {
    accent = appColors.light.warning.main;
    borderColor = '#f3dd9f';
    summaryText = 'Near capacity';
  }

  if (isOverloaded) {
    accent = workloadStateColors.danger;
    borderColor = workloadStateColors.dangerBorder;
    summaryText = `Overloaded by ${overloadAmount}%`;
  }

  return {
    accent,
    trackColor: '#e8eef6',
    borderColor,
    summaryText,
    usageText: `Workload usage: ${capacityPercentage}% of standard capacity`,
    barLabel: 'Capacity level',
  };
}

export const publicTheme = createTheme({
  typography: {
    fontFamily: primaryFontFamily,
    h1: {
      fontFamily: secondaryFontFamily,
    },
    h2: {
      fontFamily: secondaryFontFamily,
    },
    h3: {
      fontFamily: secondaryFontFamily,
    },
    h4: {
      fontFamily: secondaryFontFamily,
    },
    h5: {
      fontFamily: secondaryFontFamily,
    },
    h6: {
      fontFamily: secondaryFontFamily,
    },
    body2: {
      fontFamily: secondaryFontFamily,
    },
    caption: {
      fontFamily: secondaryFontFamily,
    },
  },
});

const lightPalette = appColors.light;

export const appTheme = createTheme({
  palette: {
    ...lightPalette,
    divider: lightPalette.border.default,
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: primaryFontFamily,
    h1: {
      fontFamily: secondaryFontFamily,
      fontWeight: 700,
      fontSize: '2.875rem',
      lineHeight: 1.05,
      letterSpacing: '-0.04em',
      color: lightPalette.text.primary,
    },
    h2: {
      fontFamily: secondaryFontFamily,
      fontWeight: 700,
      fontSize: '2.25rem',
      lineHeight: 1.08,
      letterSpacing: '-0.03em',
      color: lightPalette.text.primary,
    },
    h3: {
      fontFamily: secondaryFontFamily,
      fontWeight: 700,
      fontSize: '1.875rem',
      lineHeight: 1.12,
      letterSpacing: '-0.025em',
      color: lightPalette.text.primary,
    },
    h4: {
      fontFamily: secondaryFontFamily,
      fontWeight: 700,
      fontSize: '1.5rem',
      lineHeight: 1.18,
      letterSpacing: '-0.02em',
      color: lightPalette.text.primary,
    },
    h5: {
      fontFamily: secondaryFontFamily,
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
      color: lightPalette.text.primary,
    },
    h6: {
      fontFamily: secondaryFontFamily,
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.35,
      color: lightPalette.text.primary,
    },
    subtitle1: {
      fontFamily: secondaryFontFamily,
      fontWeight: 600,
      color: lightPalette.text.primary,
    },
    subtitle2: {
      fontFamily: secondaryFontFamily,
      fontWeight: 500,
      color: lightPalette.text.secondary,
      letterSpacing: '0.01em',
    },
    body1: {
      fontFamily: primaryFontFamily,
      fontWeight: 400,
      lineHeight: 1.7,
      color: lightPalette.text.primary,
    },
    body2: {
      fontFamily: secondaryFontFamily,
      fontWeight: 500,
      lineHeight: 1.6,
      color: lightPalette.text.secondary,
    },
    button: {
      fontFamily: primaryFontFamily,
      fontWeight: 500,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
    caption: {
      fontFamily: secondaryFontFamily,
      fontWeight: 500,
      lineHeight: 1.45,
      color: lightPalette.text.secondary,
    },
    overline: {
      fontFamily: secondaryFontFamily,
      fontWeight: 600,
      letterSpacing: '0.08em',
      color: lightPalette.text.secondary,
      textTransform: 'uppercase',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: primaryFontFamily,
          backgroundColor: lightPalette.background.default,
          color: lightPalette.text.primary,
          backgroundImage: lightPalette.surface.pageGradient,
          backgroundAttachment: 'fixed',
        },
        '#root': {
          minHeight: '100vh',
          fontFamily: primaryFontFamily,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${lightPalette.border.default}`,
          boxShadow: lightPalette.shadow.paper,
          backgroundColor: lightPalette.background.paper,
          transition: `background-color ${smoothTransition}, border-color ${smoothTransition}, box-shadow ${smoothTransition}, transform ${smoothTransition}`,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          fontFamily: primaryFontFamily,
          borderRadius: 11,
          paddingInline: 18,
          minHeight: 42,
          transition: 'background-color 180ms ease, box-shadow 180ms ease, color 180ms ease, transform 180ms ease',
        },
        containedPrimary: {
          boxShadow: lightPalette.shadow.button,
          backgroundColor: lightPalette.button.primary.base,
          '&:hover': {
            backgroundColor: lightPalette.button.primary.hover,
            boxShadow: lightPalette.shadow.buttonHover,
          },
          '&.Mui-focusVisible': {
            backgroundColor: lightPalette.button.primary.base,
            boxShadow: lightPalette.button.primary.focusRing,
          },
          '&:active': {
            backgroundColor: lightPalette.button.primary.active,
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: lightPalette.border.default,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 500,
          minHeight: 28,
          fontSize: '0.8125rem',
          transition: `background-color ${smoothTransition}, border-color ${smoothTransition}, color ${smoothTransition}, box-shadow ${smoothTransition}, transform ${smoothTransition}`,
        },
        sizeSmall: {
          height: 24,
        },
        label: {
          paddingInline: 9,
        },
        labelSmall: {
          paddingInline: 8,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: lightPalette.background.subtle,
          transition: `border-color ${smoothTransition}, box-shadow ${smoothTransition}, background-color ${smoothTransition}, transform ${smoothTransition}`,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: lightPalette.border.soft,
            transition: `border-color ${smoothTransition}`,
          },
          '&:hover': {
            backgroundColor: lightPalette.background.accent,
            boxShadow: lightPalette.shadow.input,
            transform: 'translateY(-1px)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: lightPalette.border.hover,
          },
          '&.Mui-focused': {
            backgroundColor: lightPalette.background.paper,
            boxShadow: lightPalette.shadow.input,
            transform: 'translateY(-1px)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: lightPalette.border.focus,
          },
        },
        input: {
          fontFamily: primaryFontFamily,
          fontWeight: 500,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: primaryFontFamily,
          fontWeight: 500,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: primaryFontFamily,
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 42,
          color: lightPalette.text.secondary,
          transition: `background-color ${smoothTransition}, color ${smoothTransition}, box-shadow ${smoothTransition}, transform ${smoothTransition}`,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          fontFamily: primaryFontFamily,
          borderRadius: 11,
          textTransform: 'none',
          fontWeight: 500,
          borderColor: lightPalette.border.default,
          transition: `background-color ${smoothTransition}, border-color ${smoothTransition}, color ${smoothTransition}, box-shadow ${smoothTransition}, transform ${smoothTransition}`,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: `background-color ${smoothTransition}, border-color ${smoothTransition}, color ${smoothTransition}, box-shadow ${smoothTransition}, transform ${smoothTransition}`,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          transition: `background-color ${smoothTransition}, color ${smoothTransition}, transform ${smoothTransition}`,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          color: lightPalette.text.secondary,
          borderBottom: `1px solid ${lightPalette.border.default}`,
        },
        body: {
          borderBottom: `1px solid ${alpha(lightPalette.border.default, 0.9)}`,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});
