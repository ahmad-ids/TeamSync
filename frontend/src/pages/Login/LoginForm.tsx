import { useEffect, useRef, useState, type FormEvent } from 'react';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AxiosError } from 'axios';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthProvider';
import { canAccessPath, resolveHomePathByRole } from '../../app/auth/roleAccess';
import { ExternalAuthLoadingState } from '../../components/auth/ExternalAuthLoadingState';
import { isRetryableAuthStartupError, waitForAuthServiceReady } from '../../services/authService';
import { buildExternalAuthStartUrl } from '../../services/oauthUrls';
import { pageStyles, textFieldStyles } from './LoginPage.styles';

type AlertSeverity = 'error' | 'warning' | 'info' | 'success';
type AuthServiceStatus = 'checking' | 'ready' | 'unavailable';

interface ProblemDetailsPayload {
  detail?: string;
  title?: string;
}

interface LoginFormProps {
  fromPath: string;
  initialEmail?: string;
  initialFlashMessage?: string;
  initialFlashSeverity?: AlertSeverity;
}

export function LoginForm({
  fromPath,
  initialEmail,
  initialFlashMessage,
  initialFlashSeverity,
}: LoginFormProps) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState(() => initialEmail?.trim() ?? '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingExternalProvider, setPendingExternalProvider] = useState<'clickup' | null>(null);
  const [externalProviders, setExternalProviders] = useState<{ clickup: boolean | null }>({
    clickup: null,
  });
  const [authServiceStatus, setAuthServiceStatus] = useState<AuthServiceStatus>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSignupAction, setShowSignupAction] = useState(false);
  const redirectTimerRef = useRef<number | null>(null);
  const [flashMessage, setFlashMessage] = useState<{ severity: AlertSeverity; message: string } | null>(() =>
    initialFlashMessage
      ? {
        severity: initialFlashSeverity ?? 'info',
        message: initialFlashMessage,
      }
      : null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadExternalProviders() {
      try {
        const providers = await waitForAuthServiceReady();
        if (isMounted) {
          setExternalProviders(providers);
          setAuthServiceStatus('ready');
        }
      } catch {
        if (isMounted) {
          setExternalProviders({ clickup: null });
          setAuthServiceStatus('unavailable');
        }
      }
    }

    void loadExternalProviders();

    return () => {
      isMounted = false;
    };
  }, []);

  const emailError = email.trim().length === 0
    ? 'Email address is required.'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? 'Enter a valid email address.'
      : null;

  const passwordError = password.length === 0 ? 'Password is required.' : null;
  const isExternalAuthStarting = pendingExternalProvider !== null;
  const isAuthServiceChecking = authServiceStatus === 'checking';
  const isSubmitDisabled = isSubmitting || isExternalAuthStarting || isAuthServiceChecking;

  async function ensureAuthServiceIsReady() {
    if (authServiceStatus === 'ready') {
      return true;
    }

    setAuthServiceStatus('checking');

    try {
      const providers = await waitForAuthServiceReady({ timeoutMs: 10000, intervalMs: 500 });
      setExternalProviders(providers);
      setAuthServiceStatus('ready');
      return true;
    } catch (error) {
      setAuthServiceStatus('unavailable');

      if (error instanceof AxiosError) {
        const payload = error.response?.data as ProblemDetailsPayload | undefined;
        const backendMessage = payload?.detail?.trim() ?? payload?.title?.trim();

        setErrorMessage(
          backendMessage ?? 'Unable to reach the sign-in service right now.',
        );
      } else {
        setErrorMessage('Unable to reach the sign-in service right now.');
      }

      setShowSignupAction(false);
      return false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isExternalAuthStarting) {
      return;
    }

    if (emailError || passwordError) {
      setErrorMessage('Enter a valid email and password to continue.');
      setShowSignupAction(false);
      return;
    }

    setIsSubmitting(true);
    setFlashMessage(null);
    setErrorMessage(null);
    setShowSignupAction(false);

    try {
      const isReady = await ensureAuthServiceIsReady();
      if (!isReady) {
        return;
      }

      const authenticatedUser = await login(email.trim(), password, rememberMe);
      const roleBasedHome = resolveHomePathByRole(authenticatedUser.role);
      const destination = canAccessPath(authenticatedUser.role, fromPath) ? fromPath : roleBasedHome;
      navigate(destination, { replace: true });
    } catch (error) {
      if (error instanceof AxiosError) {
        const payload = error.response?.data as ProblemDetailsPayload | undefined;
        const backendMessage = payload?.detail?.trim() ?? payload?.title?.trim();

        if (error.response?.status === 404) {
          setErrorMessage(backendMessage ?? 'This account does not exist. Please sign up.');
          setShowSignupAction(true);
        } else if (error.response?.status === 401) {
          setErrorMessage(backendMessage ?? 'Incorrect email or password.');
        } else if (isRetryableAuthStartupError(error)) {
          setAuthServiceStatus('unavailable');
          setErrorMessage(backendMessage ?? 'Unable to reach the sign-in service right now.');
        } else {
          setErrorMessage(backendMessage ?? 'Unable to reach the sign-in service right now.');
        }
      } else {
        setErrorMessage('Unable to reach the sign-in service right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSocialSignIn() {
    if (isSubmitting || isExternalAuthStarting) {
      return;
    }

    if (externalProviders.clickup === false) {
      setErrorMessage('ClickUp sign-in is not configured right now.');
      setShowSignupAction(false);
      return;
    }

    setErrorMessage(null);
    setShowSignupAction(false);
    setPendingExternalProvider('clickup');

    try {
      const startUrl = buildExternalAuthStartUrl('clickup', 'login');
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.assign(startUrl);
      }, 160);
    } catch {
      setPendingExternalProvider(null);
      setErrorMessage('OAuth configuration is invalid. Please contact your administrator.');
    }
  }

  return (
    <Box sx={pageStyles.rightPane}>
      <Box sx={pageStyles.formCard}>
        <ExternalAuthLoadingState open={isExternalAuthStarting} provider={pendingExternalProvider} />
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', maxWidth: 390, mx: 'auto' }}>
          <Stack spacing={2.1}>
            <Box>
              <Typography sx={pageStyles.formTitle}>Welcome Back</Typography>
              <Typography sx={pageStyles.formSubtitle}>
                Resume your journey towards mastery.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                type="button"
                variant="contained"
                fullWidth
                startIcon={isExternalAuthStarting && pendingExternalProvider === 'clickup'
                  ? <CircularProgress size={18} thickness={4.5} color="inherit" />
                  : <TaskAltRoundedIcon sx={{ fontSize: 20 }} />}
                onClick={() => handleSocialSignIn()}
                sx={pageStyles.oauthButton}
                disabled={isExternalAuthStarting || externalProviders.clickup === false}
              >
                {pendingExternalProvider === 'clickup' ? 'Connecting...' : 'Continue with ClickUp'}
              </Button>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1.1} sx={{ mt: 0.3 }}>
              <Box sx={pageStyles.dividerLine} />
              <Typography sx={pageStyles.dividerText}>OR WITH EMAIL</Typography>
              <Box sx={pageStyles.dividerLine} />
            </Stack>

            {flashMessage ? (
              <Alert severity={flashMessage.severity} onClose={() => setFlashMessage(null)}>
                {flashMessage.message}
              </Alert>
            ) : null}
            {authServiceStatus === 'checking' ? (
              <Alert severity="info">
                Starting the sign-in service...
              </Alert>
            ) : null}
            {errorMessage ? (
              <Alert
                severity="error"
                action={showSignupAction ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => navigate('/signup', { state: { prefillEmail: email.trim() } })}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Sign up
                  </Button>
                ) : undefined}
              >
                {errorMessage}
              </Alert>
            ) : null}

            <Box sx={{ mt: 0.2 }}>
              <Typography component="label" htmlFor="login-email" sx={pageStyles.fieldLabel}>
                Email Address
              </Typography>
              <TextField
                id="login-email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={Boolean(emailError) && errorMessage !== null}
                helperText={errorMessage !== null ? emailError : undefined}
                disabled={isExternalAuthStarting}
                fullWidth
                sx={textFieldStyles}
              />
            </Box>

            <Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 0.6, sm: 0 },
                  mb: 0.75,
                }}
              >
                <Typography component="label" htmlFor="login-password" sx={pageStyles.fieldLabel}>
                  Password
                </Typography>
                <Link
                  component={RouterLink}
                  to="/forgot-password"
                  underline="hover"
                  sx={pageStyles.forgotLink}
                >
                  Forgot password?
                </Link>
              </Box>
              <TextField
                id="login-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                error={Boolean(passwordError) && errorMessage !== null}
                helperText={errorMessage !== null ? passwordError : undefined}
                disabled={isExternalAuthStarting}
                fullWidth
                sx={textFieldStyles}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((current) => !current)}
                        edge="end"
                        disabled={isExternalAuthStarting}
                      >
                        {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: -0.15 }}>
              <Checkbox
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isExternalAuthStarting}
                sx={{ color: '#b7c0d5', p: 0.5 }}
              />
              <Typography sx={pageStyles.rememberLabel}>
                Stay logged in for 30 days
              </Typography>
            </Stack>

            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitDisabled}
              sx={pageStyles.submitButton}
            >
              {isSubmitting || isAuthServiceChecking ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'LOG IN'}
            </Button>

            <Typography sx={pageStyles.signupPrompt}>
              Don&apos;t have an account?{' '}
              <Link
                component={RouterLink}
                to="/signup"
                underline="hover"
                sx={pageStyles.signupLink}
              >
                Sign Up
              </Link>
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
