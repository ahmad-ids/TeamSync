import { useState, type FormEvent } from 'react';
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
import { Link as RouterLink } from 'react-router-dom';
import styled from 'styled-components';
import { requestPasswordReset } from '../../services/authService';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'error' | 'success'; message: string } | null>(null);

  const emailError = email.trim().length === 0
    ? 'Email address is required.'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? 'Enter a valid email address.'
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (emailError) {
      setFeedback({ severity: 'error', message: 'Enter a valid email address to continue.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await requestPasswordReset({ email: email.trim() });
      setFeedback({
        severity: 'success',
        message: 'If an account matches that email, a password reset link will be sent shortly.',
      });
    } catch {
      setFeedback({
        severity: 'success',
        message: 'If an account matches that email, a password reset link will be sent shortly.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageRoot>
      <CardPaper elevation={0}>
        <Stack spacing={2.5}>
          <Box>
            <PageTitle>Forgot Password</PageTitle>
            <PageSubtitle>
              Enter your email address and we&apos;ll send you a secure reset link.
            </PageSubtitle>
          </Box>

          {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={Boolean(emailError) && feedback?.severity === 'error'}
                helperText={feedback?.severity === 'error' ? emailError : ' '}
                autoComplete="email"
                fullWidth
              />

              <SubmitButton type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? <ButtonSpinner size={22} /> : 'Send Reset Link'}
              </SubmitButton>
            </Stack>
          </Box>

          <FooterText>
            Remembered your password?{' '}
            <FooterLink to="/login">
              Back to login
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
  max-width: 460px;
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
