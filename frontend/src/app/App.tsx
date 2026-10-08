import { CssBaseline, ThemeProvider } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { appTheme } from '../theme/theme';

export function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppShell>
        <Outlet />
      </AppShell>
    </ThemeProvider>
  );
}
