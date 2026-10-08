import { useEffect, useRef, useState, type FormEvent } from 'react';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { AxiosError } from 'axios';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthProvider';
import { AuthHeader } from '../../components/auth/AuthHeader';
import { resolveHomePathByRole } from '../../app/auth/roleAccess';
import { ExternalAuthLoadingState } from '../../components/auth/ExternalAuthLoadingState';
import { AuthFeatureSlider } from '../../components/auth/AuthFeatureSlider';
import { signupFeatureSlides } from '../../components/auth/authFeatureSlides';
import { register, waitForAuthServiceReady } from '../../services/authService';
import { buildExternalAuthStartUrl } from '../../services/oauthUrls';

interface ProblemDetailsPayload {
  detail?: string;
  title?: string;
  errors?: Record<string, string[]>;
}

type FeedbackSeverity = 'error' | 'success' | 'info';

interface SignupLocationState {
  prefillEmail?: string;
  flashMessage?: string;
  flashSeverity?: FeedbackSeverity;
}

export function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const locationState = (location.state as SignupLocationState | null) ?? null;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(() => locationState?.prefillEmail?.trim() ?? '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingExternalProvider, setPendingExternalProvider] = useState<'clickup' | null>(null);
  const [externalProviders, setExternalProviders] = useState<{ clickup: boolean | null }>({
    clickup: null,
  });
  const [feedback, setFeedback] = useState<{ severity: FeedbackSeverity; message: string } | null>(() =>
    locationState?.flashMessage
      ? {
        severity: locationState.flashSeverity ?? 'info',
        message: locationState.flashMessage,
      }
      : null);
  const [showLoginAction, setShowLoginAction] = useState(false);
  const redirectTimerRef = useRef<number | null>(null);

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
        }
      } catch {
        if (isMounted) {
          setExternalProviders({ clickup: null });
        }
      }
    }

    void loadExternalProviders();

    return () => {
      isMounted = false;
    };
  }, []);

  const fullNameError = fullName.trim().length === 0
    ? 'Full name is required.'
    : fullName.trim().length < 2
      ? 'Enter your full name.'
      : null;

  const emailError = email.trim().length === 0
    ? 'Email address is required.'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? 'Enter a valid email address.'
      : null;

  const passwordError = password.length === 0
    ? 'Password is required.'
    : password.length < 8
      ? 'Password must be at least 8 characters.'
      : !/[A-Z]/.test(password)
        ? 'Password must include an uppercase letter.'
        : !/[a-z]/.test(password)
          ? 'Password must include a lowercase letter.'
          : !/\d/.test(password)
            ? 'Password must include a number.'
            : null;
  const isExternalAuthStarting = pendingExternalProvider !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isExternalAuthStarting) {
      return;
    }

    const normalizedEmail = email.trim();

    if (fullNameError || emailError || passwordError) {
      setFeedback({ severity: 'error', message: 'Provide a valid full name, email, and password to continue.' });
      setShowLoginAction(false);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setShowLoginAction(false);

    try {
      try {
        await register({
          fullName: fullName.trim(),
          email: normalizedEmail,
          password,
        });
      } catch (error) {
        if (error instanceof AxiosError) {
          const payload = error.response?.data as ProblemDetailsPayload | undefined;
          const firstFieldError = payload?.errors
            ? Object.values(payload.errors).flat().find((entry) => entry.trim().length > 0)
            : null;
          const statusCode = error.response?.status;
          const fallbackMessage = 'Unable to create account right now.';
          const resolvedMessage = firstFieldError
            ?? payload?.detail?.trim()
            ?? payload?.title?.trim()
            ?? fallbackMessage;
          const normalizedFailureText = [firstFieldError, payload?.detail, payload?.title]
            .filter((entry): entry is string => Boolean(entry))
            .join(' ')
            .toLowerCase();
          const isDuplicateEmail =
            statusCode === 409
            || normalizedFailureText.includes('already exists')
            || normalizedFailureText.includes('duplicate');

          if (isDuplicateEmail) {
            setFeedback({
              severity: 'info',
              message: 'This account already exists. Please log in.',
            });
            setShowLoginAction(true);
            return;
          }

          setFeedback({ severity: 'error', message: resolvedMessage });
          setShowLoginAction(false);
          return;
        }

        setFeedback({ severity: 'error', message: 'Unable to create account right now.' });
        setShowLoginAction(false);
        return;
      }

      try {
        const authenticatedUser = await login(normalizedEmail, password, true);
        navigate(resolveHomePathByRole(authenticatedUser.role), { replace: true });
      } catch {
        setFeedback({
          severity: 'info',
          message: 'Account created successfully. Automatic sign-in failed, please log in.',
        });
        setShowLoginAction(true);
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
      setFeedback({
        severity: 'info',
        message: 'ClickUp sign-in is not configured right now.',
      });
      setShowLoginAction(false);
      return;
    }

    setFeedback(null);
    setShowLoginAction(false);
    setPendingExternalProvider('clickup');

    try {
      const startUrl = buildExternalAuthStartUrl('clickup', 'signup');
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.assign(startUrl);
      }, 160);
    } catch {
      setPendingExternalProvider(null);
      setFeedback({
        severity: 'error',
        message: 'OAuth configuration is invalid. Please contact your administrator.',
      });
    }
  }

  return (
    <Box sx={pageStyles.root}>
      <AuthHeader />

      <Box component="main" sx={pageStyles.main}>
        <Box sx={pageStyles.contentGrid}>
          <Box sx={pageStyles.leftPane}>
            <Box
              sx={{
                alignSelf: 'flex-start',
                borderRadius: 999,
                px: 1.9,
                py: 0.7,
                bgcolor: '#dde6ff',
                color: '#3a63cc',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
              }}
            >
              State of Flow
            </Box>

            <Typography sx={pageStyles.heroTitle}>
              Start your journey
              <br />
              to{' '}
              <Box component="span" sx={pageStyles.heroTitleAccent}>
                absolute
                <br />
                clarity.
              </Box>
            </Typography>

            <AuthFeatureSlider
              eyebrow="Begin With Clarity"
              slides={signupFeatureSlides}
              styles={pageStyles}
            />
          </Box>

          <Box sx={pageStyles.rightPane}>
            <Paper elevation={0} sx={{ ...pageStyles.signupCard, position: 'relative', overflow: 'hidden' }}>
              <ExternalAuthLoadingState open={isExternalAuthStarting} provider={pendingExternalProvider} />
              <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                <Stack spacing={2.1}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={pageStyles.formTitle}>Join the Flow</Typography>
                    <Typography sx={pageStyles.formSubtitle}>
                      Unlock your creative potential today.
                    </Typography>
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                    <Button
                      type="button"
                      variant="contained"
                      fullWidth
                      startIcon={isExternalAuthStarting && pendingExternalProvider === 'clickup'
                        ? <CircularProgress size={18} thickness={4.5} color="inherit" />
                        : <TaskAltRoundedIcon sx={{ fontSize: 19 }} />}
                      onClick={() => handleSocialSignIn()}
                      sx={pageStyles.oauthButton}
                      disabled={isExternalAuthStarting || externalProviders.clickup === false}
                    >
                      {pendingExternalProvider === 'clickup' ? 'Connecting...' : 'Continue with ClickUp'}
                    </Button>
                  </Stack>

                  <Stack direction="row" alignItems="center" spacing={1.05} sx={{ mt: 0.25 }}>
                    <Box sx={pageStyles.dividerLine} />
                    <Typography sx={pageStyles.dividerText}>OR REGISTER WITH EMAIL</Typography>
                    <Box sx={pageStyles.dividerLine} />
                  </Stack>

                  {feedback ? (
                    <Alert
                      severity={feedback.severity}
                      action={showLoginAction ? (
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => {
                            navigate('/login', {
                              state: {
                                prefillEmail: email.trim(),
                                flashMessage: 'This account already exists. Please log in.',
                                flashSeverity: 'info',
                              },
                            });
                          }}
                          sx={{ fontWeight: 700, textTransform: 'none' }}
                        >
                          Log in
                        </Button>
                      ) : undefined}
                    >
                      {feedback.message}
                    </Alert>
                  ) : null}

                  <Box sx={{ mt: 0.15 }}>
                    <Typography component="label" htmlFor="signup-full-name" sx={pageStyles.fieldLabel}>
                      Full Name
                    </Typography>
                    <TextField
                      id="signup-full-name"
                      placeholder="Johnathan Doe"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      error={Boolean(fullNameError) && feedback?.severity === 'error'}
                      helperText={feedback?.severity === 'error' ? fullNameError : undefined}
                      disabled={isExternalAuthStarting}
                      fullWidth
                      sx={textFieldStyles}
                    />
                  </Box>

                  <Box>
                    <Typography component="label" htmlFor="signup-email" sx={pageStyles.fieldLabel}>
                      Email Address
                    </Typography>
                    <TextField
                      id="signup-email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      error={Boolean(emailError) && feedback?.severity === 'error'}
                      helperText={feedback?.severity === 'error' ? emailError : undefined}
                      disabled={isExternalAuthStarting}
                      fullWidth
                      sx={textFieldStyles}
                    />
                  </Box>

                  <Box>
                    <Typography component="label" htmlFor="signup-password" sx={pageStyles.fieldLabel}>
                      Password
                    </Typography>
                    <TextField
                      id="signup-password"
                      placeholder="Create a secure password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      error={Boolean(passwordError) && feedback?.severity === 'error'}
                      helperText={feedback?.severity === 'error' ? passwordError : undefined}
                      disabled={isExternalAuthStarting}
                      fullWidth
                      sx={textFieldStyles}
                    />
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting || isExternalAuthStarting}
                    sx={pageStyles.submitButton}
                  >
                    {isSubmitting ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'CREATE ACCOUNT'}
                  </Button>

                  <Typography sx={pageStyles.loginPrompt}>
                    Already have an account?{' '}
                    <Link component={RouterLink} to="/login" underline="hover" sx={pageStyles.loginLink}>
                      Log In
                    </Link>
                  </Typography>
                </Stack>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

const pageStyles: Record<string, SxProps<Theme>> = {
  root: {
    minHeight: '100dvh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    bgcolor: '#edf2ff',
    backgroundImage:
      'radial-gradient(circle at 16% 18%, rgba(61, 112, 223, 0.18), transparent 28%), radial-gradient(circle at 84% 16%, rgba(255, 255, 255, 0.74), transparent 22%), linear-gradient(135deg, #eff4ff 0%, #e7eefc 44%, #f8faff 100%)',
    backgroundSize: '100% 100%, 100% 100%, 100% 100%',
    backgroundPosition: 'center',
  },
  main: {
    flex: 1,
    minHeight: 'auto',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'stretch',
  },
  contentGrid: {
    width: '100%',
    flex: 1,
    maxWidth: 1680,
    mx: 'auto',
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.12fr) minmax(360px, 0.88fr)' },
    alignItems: { xs: 'start', xl: 'stretch' },
  },
  leftPane: {
    order: { xs: 2, xl: 1 },
    minHeight: 'auto',
    p: { xs: 2.5, sm: 3, md: 4, xl: 5.5 },
    bgcolor: 'rgba(246, 249, 255, 0.72)',
    backgroundImage:
      'radial-gradient(circle at 18% 24%, rgba(89, 130, 230, 0.12), transparent 26%), linear-gradient(180deg, rgba(255, 255, 255, 0.54) 0%, rgba(245, 248, 255, 0.78) 100%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  heroTitle: {
    mt: { xs: 2.25, sm: 3.1, md: 4.6 },
    color: '#252f5a',
    fontSize: { xs: 31, sm: 40, md: 54, lg: 66 / 1.08, xl: 76 / 1.1 },
    lineHeight: 1.02,
    fontWeight: 700,
    letterSpacing: '-0.026em',
    fontFamily: '"Poppins", Inter, "Segoe UI", sans-serif',
    textWrap: 'balance',
  },
  heroTitleAccent: {
    color: '#1b5ad6',
    fontStyle: 'italic',
    fontWeight: 700,
  },
  featurePanel: {
    mt: { xs: 3, sm: 4, md: 4.5 },
    width: '100%',
    maxWidth: 560,
    p: { xs: 2.9, md: 3.3 },
    borderRadius: 2.2,
    boxShadow: '0 14px 30px rgba(53, 76, 130, 0.08)',
    border: '1px solid #e8ecf7',
    bgcolor: '#ffffff',
  },
  featureEyebrow: {
    color: '#2f60d0',
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  featureHeading: {
    color: '#2a355f',
    fontSize: { xs: 24, md: 28 },
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  featureDescription: {
    mt: 1.05,
    color: '#677695',
    fontSize: { xs: 14.25, md: 15.25 },
    lineHeight: 1.65,
    maxWidth: '100%',
  },
  featureFadeIn: {
    opacity: 1,
    transform: 'translateY(0px)',
    transition: 'opacity 220ms ease, transform 220ms ease',
  },
  featureFadeOut: {
    opacity: 0,
    transform: 'translateY(5px)',
    transition: 'opacity 170ms ease, transform 170ms ease',
  },
  featureDots: {
    alignItems: 'center',
  },
  featureDotActive: {
    width: 24,
    height: 8,
    borderRadius: 999,
    border: 'none',
    p: 0,
    bgcolor: '#1f5ad3',
    cursor: 'pointer',
    transition: 'all 220ms ease',
  },
  featureDotInactive: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    border: 'none',
    p: 0,
    bgcolor: '#d3d9eb',
    cursor: 'pointer',
    transition: 'all 220ms ease',
    '&:hover': {
      bgcolor: '#aab6d8',
    },
  },
  rightPane: {
    order: { xs: 1, xl: 2 },
    p: { xs: 2.5, sm: 3, md: 4, xl: 5.5 },
    minHeight: 'auto',
    display: 'flex',
    alignItems: { xs: 'stretch', md: 'center' },
    justifyContent: 'center',
    overflow: 'visible',
    background:
      'linear-gradient(180deg, rgba(255, 255, 255, 0.76) 0%, rgba(250, 252, 255, 0.96) 100%)',
  },
  signupCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 3.2,
    border: '1px solid rgba(225, 232, 248, 0.92)',
    boxShadow: '0 24px 54px rgba(40, 61, 112, 0.10)',
    bgcolor: 'rgba(255, 255, 255, 0.92)',
    mx: 'auto',
    px: { xs: 2.2, sm: 2.7, md: 4.2 },
    py: { xs: 2.5, sm: 3, md: 3.5 },
    backdropFilter: 'blur(8px)',
  },
  formTitle: {
    color: '#252f5a',
    fontFamily: '"Poppins", Inter, "Segoe UI", sans-serif',
    fontSize: { xs: 28, sm: 32, md: 51 / 1.45 },
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    textWrap: 'balance',
  },
  formSubtitle: {
    mt: 0.55,
    color: '#7380a0',
    fontSize: { xs: 14, md: 16.5 },
    lineHeight: 1.5,
  },
  oauthButton: {
    borderColor: '#dfe4f2',
    color: '#33456d',
    bgcolor: '#fff',
    borderRadius: 2,
    textTransform: 'none',
    fontWeight: 600,
    fontSize: 13.5,
    py: 0.95,
    minHeight: 42,
    '&:hover': {
      borderColor: '#c9d2eb',
      bgcolor: '#f9fbff',
    },
  },
  dividerLine: {
    flex: 1,
    height: 1,
    bgcolor: '#e6eaf4',
  },
  dividerText: {
    color: '#9aa4ba',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    whiteSpace: 'nowrap',
  },
  fieldLabel: {
    color: '#606d87',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    mb: 0.62,
    display: 'block',
  },
  submitButton: {
    mt: 0.35,
    minHeight: 48,
    borderRadius: 2.3,
    background: 'linear-gradient(90deg, #0d4ec5 0%, #5f8ef2 100%)',
    boxShadow: '0 8px 22px rgba(46, 95, 205, 0.34)',
    fontFamily: '"Poppins", Inter, "Segoe UI", sans-serif',
    fontSize: 12.5,
    letterSpacing: '0.12em',
    fontWeight: 700,
    '&:hover': {
      background: 'linear-gradient(90deg, #0a45b3 0%, #507fdd 100%)',
    },
  },
  loginPrompt: {
    textAlign: 'center',
    color: '#7a859f',
    fontSize: 13.5,
    mt: 0.3,
  },
  loginLink: {
    color: '#2d5ac7',
    fontWeight: 600,
  },
} as const;

const textFieldStyles = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1,
    bgcolor: '#eef0fb',
    minHeight: 46,
    fontSize: 13.5,
    '& input': {
      px: { xs: 1.15, sm: 1.45 },
      py: 1.2,
    },
    '& fieldset': {
      borderColor: 'transparent',
    },
    '&:hover fieldset': {
      borderColor: '#c7d3f1',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#5a79d3',
    },
  },
  '& .MuiFormHelperText-root': {
    minHeight: 0,
    mt: 0.35,
  },
} as const;
