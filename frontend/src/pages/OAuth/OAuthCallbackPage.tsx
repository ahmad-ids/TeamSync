import { useEffect } from 'react';
import { CircularProgress, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../app/auth/AuthProvider';
import { resolveHomePathByRole } from '../../app/auth/roleAccess';
import type { AuthUser } from '../../types/auth';

const pendingOAuthExchangeByTicket = new Map<string, Promise<AuthUser>>();
const oauthCallbackProbeTimeoutMs = 1200;
const oauthCallbackProbeIntervalMs = 50;

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { completeOAuthSignIn } = useAuth();

  useEffect(() => {
    let isActive = true;

    async function completeSignIn() {
      const searchParams = await waitForOAuthCallbackParams();
      const error = searchParams.get('error')?.trim();
      const ticket = searchParams.get('ticket')?.trim();
      const clickupSetupTicket = searchParams.get('clickupSetupTicket')?.trim();
      const providerCode = searchParams.get('code')?.trim();
      const providerState = searchParams.get('state')?.trim();

      if (error) {
        navigate('/login', {
          replace: true,
          state: {
            flashMessage: error,
            flashSeverity: 'error',
          },
        });
        return;
      }

      if (providerCode || providerState) {
        navigate('/login', {
          replace: true,
          state: {
            flashMessage: 'External sign-in callback is misconfigured. The provider must return to the backend callback first.',
            flashSeverity: 'error',
          },
        });
        return;
      }

      if (!ticket) {
        navigate('/login', {
          replace: true,
          state: {
            flashMessage: 'External sign-in did not return a valid ticket. Please try again.',
            flashSeverity: 'error',
          },
        });
        return;
      }

      try {
        const authenticatedUser = await getOrStartOAuthExchange(ticket, () =>
          completeOAuthSignIn(ticket, true),
        );

        if (!isActive) {
          return;
        }

        if (clickupSetupTicket) {
          navigate(`/integrations/clickup/select?ticket=${encodeURIComponent(clickupSetupTicket)}`, { replace: true });
          return;
        }

        navigate(resolveHomePathByRole(authenticatedUser.role), { replace: true });
      } catch {
        if (isActive) {
          navigate('/login', {
            replace: true,
            state: {
              flashMessage: 'Unable to complete external sign-in right now. Please try again.',
              flashSeverity: 'error',
            },
          });
        }
      }
    }

    void completeSignIn();

    return () => {
      isActive = false;
    };
  }, [completeOAuthSignIn, navigate]);

  return (
    <PageShell>
      <Stack spacing={2} alignItems="center">
        <CircularProgress color="primary" />
        <StatusText variant="body1">
          Completing secure sign-in...
        </StatusText>
      </Stack>
    </PageShell>
  );
}

async function waitForOAuthCallbackParams() {
  const deadline = Date.now() + oauthCallbackProbeTimeoutMs;

  while (true) {
    const searchParams = new URLSearchParams(window.location.search);
    const hasStableParams =
      Boolean(searchParams.get('ticket')?.trim())
      || Boolean(searchParams.get('error')?.trim())
      || Boolean(searchParams.get('code')?.trim())
      || Boolean(searchParams.get('state')?.trim());

    if (hasStableParams || Date.now() >= deadline) {
      return searchParams;
    }

    await pause(oauthCallbackProbeIntervalMs);
  }
}

function getOrStartOAuthExchange(ticket: string, createExchange: () => Promise<AuthUser>) {
  const cachedExchange = pendingOAuthExchangeByTicket.get(ticket);
  if (cachedExchange) {
    return cachedExchange;
  }

  const exchangePromise = createExchange().finally(() => {
    window.setTimeout(() => {
      pendingOAuthExchangeByTicket.delete(ticket);
    }, 0);
  });

  pendingOAuthExchangeByTicket.set(ticket, exchangePromise);
  return exchangePromise;
}

function pause(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

// Styled components
const PageShell = styled.div`
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding-inline: 16px;
`;

const StatusText = styled(Typography)`
  color: #4f5f85;
  font-weight: 500;
`;
