import { useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AxiosError } from 'axios';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { resetPassword } from '../../services/authService';

interface ProblemDetailsPayload {
  detail?: string;
  title?: string;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'error' | 'success'; message: string } | null>(() => {
    const error = searchParams.get('error')?.trim();
    return error ? { severity: 'error', message: error } : null;
  });

  const email = searchParams.get('email')?.trim() ?? '';
  const token = searchParams.get('token')?.trim() ?? '';

  const passwordError = useMemo(() => {
    if (password.length === 0) {
      return 'Password is required.';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }

    if (!/[A-Z]/.test(password)) {
      return 'Password must include an uppercase letter.';
    }

    if (!/[a-z]/.test(password)) {
      return 'Password must include a lowercase letter.';
    }

    if (!/\d/.test(password)) {
      return 'Password must include a number.';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must include a symbol.';
    }

    return null;
  }, [password]);

  const confirmPasswordError = confirmPassword.length === 0
    ? 'Please confirm your new password.'
    : password !== confirmPassword
      ? 'Passwords do not match.'
      : null;

  const hasValidLink = email.length > 0 && token.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasValidLink) {
      setFeedback({ severity: 'error', message: 'This password reset link is invalid.' });
      return;
    }

    if (passwordError || confirmPasswordError) {
      setFeedback({ severity: 'error', message: 'Enter and confirm a strong password to continue.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await resetPassword({
        email,
        token,
        password,
        confirmPassword,
      });

      navigate('/login', {
        replace: true,
        state: {
          prefillEmail: email,
          flashMessage: 'Your password has been reset. You can now sign in.',
          flashSeverity: 'success',
        },
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        const payload = error.response?.data as ProblemDetailsPayload | undefined;
        setFeedback({
          severity: 'error',
          message: payload?.detail?.trim() ?? payload?.title?.trim() ?? 'Unable to reset password right now.',
        });
      } else {
        setFeedback({ severity: 'error', message: 'Unable to reset password right now.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageRoot>
      <CardPaper elevation={0}>
        <Stack spacing={2.5}>
          <Box>
            <PageTitle>Reset Password</PageTitle>
            <PageSubtitle>
              Choose a new password for <strong>{email || 'your account'}</strong>.
            </PageSubtitle>
          </Box>

          {!hasValidLink ? (
            <Alert severity="error">This password reset link is invalid or incomplete.</Alert>
          ) : null}

          {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="New password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={Boolean(passwordError) && feedback?.severity === 'error'}
                helperText={feedback?.severity === 'error' ? passwordError : ' '}
                autoComplete="new-password"
                fullWidth
              />

              <TextField
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                error={Boolean(confirmPasswordError) && feedback?.severity === 'error'}
                helperText={feedback?.severity === 'error' ? confirmPasswordError : ' '}
                autoComplete="new-password"
                fullWidth
              />

              <SubmitButton
                type="submit"
                variant="contained"
                disabled={isSubmitting || !hasValidLink}
              >
                {isSubmitting ? <ButtonSpinner size={22} /> : 'Reset Password'}
              </SubmitButton>
            </Stack>
          </Box>

          <FooterText>
            Return to{' '}
            <FooterLink to="/login">
              login
            </FooterLink>
          </FooterText>
        </Stack>
      </CardPaper>
    </PageRoot>
  );
}

// Styled components
const PageRoot = styled(Box)`
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 32px 16px;
  background: linear-gradient(160deg, #f6f8ff 0%, #eef3ff 45%, #e5ebfb 100%);
`;

const CardPaper = styled(Paper)`
  width: 100%;
  max-width: 500px;
  padding: 24px;
  border-radius: 32px;
  border: 1px solid #d8e0f2;
  background-color: #ffffff;
  box-shadow: 0 28px 60px rgba(31, 51, 107, 0.12);

  @media (min-width: 600px) {
    padding: 32px;
  }
`;

const PageTitle = styled(Typography)`
  margin-bottom: 6px;
  font-size: 28px;
  font-weight: 800;
  color: #17305c;
`;

const PageSubtitle = styled(Typography)`
  color: #5f6f95;
  line-height: 1.6;
`;

const SubmitButton = styled(Button)`
  min-height: 48px;
  font-weight: 700;
  letter-spacing: 0.04em;
`;

const FooterText = styled(Typography)`
  text-align: center;
  color: #5f6f95;
`;

const FooterLink = styled(RouterLink)`
  font-weight: 700;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const ButtonSpinner = styled(CircularProgress)`
  color: #fff;
`;
