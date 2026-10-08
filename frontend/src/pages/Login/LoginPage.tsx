import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { AuthHeader } from '../../components/auth/AuthHeader';
import { LoginForm } from './LoginForm';
import { LoginHeroPanel } from './LoginHeroPanel';
import { pageStyles } from './LoginPage.styles';

interface LoginLocationState {
  from?: { pathname?: string };
  prefillEmail?: string;
  flashMessage?: string;
  flashSeverity?: 'error' | 'warning' | 'info' | 'success';
}

export function LoginPage() {
  const location = useLocation();
  const locationState = (location.state as LoginLocationState | null) ?? null;

  return (
    <Box sx={pageStyles.root}>
      <AuthHeader />

      <Box component="main" sx={pageStyles.main}>
        <Box sx={pageStyles.grid}>
          <LoginHeroPanel />
          <LoginForm
            fromPath={locationState?.from?.pathname ?? '/'}
            initialEmail={locationState?.prefillEmail}
            initialFlashMessage={locationState?.flashMessage}
            initialFlashSeverity={locationState?.flashSeverity}
          />
        </Box>
      </Box>
    </Box>
  );
}
