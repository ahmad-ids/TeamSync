import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthProvider';
import { resolveHomePathByRole } from '../../app/auth/roleAccess';
import { connectClickUpWorkspace, getClickUpWorkspaces } from '../../services/clickupIntegrationService';
import type { ClickUpWorkspace } from '../../services/authService';

export function ClickUpWorkspaceSelectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const ticket = searchParams.get('ticket')?.trim() ?? '';

  const [workspaces, setWorkspaces] = useState<ClickUpWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!ticket) {
        setError('The workspace selection ticket is missing or expired.');
        setIsLoading(false);
        return;
      }

      try {
        const items = await getClickUpWorkspaces(ticket);
        if (!isMounted) {
          return;
        }

        setWorkspaces(items);
        setSelectedWorkspaceId(items[0]?.workspaceId ?? '');
      } catch {
        if (isMounted) {
          setError('The workspace selection ticket is invalid or expired.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [ticket]);

  async function handleConnect() {
    if (!selectedWorkspaceId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await connectClickUpWorkspace(ticket, selectedWorkspaceId);
      navigate(resolveHomePathByRole(user?.role), { replace: true });
    } catch {
      setError('Unable to connect the selected ClickUp workspace.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, py: 4 }}>
      <Paper sx={{ width: '100%', maxWidth: 760, p: { xs: 3, sm: 4 }, borderRadius: 4 }}>
        <Stack spacing={3}>
          <Stack spacing={0.75}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Select your ClickUp workspace
            </Typography>
            <Typography color="text.secondary">
              Choose the workspace you want to connect to your team.
            </Typography>
          </Stack>

          {error ? <Alert severity="error">{error}</Alert> : null}

          {isLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
            </Stack>
          ) : (
            <RadioGroup
              value={selectedWorkspaceId}
              onChange={(event) => setSelectedWorkspaceId(event.target.value)}
            >
              <Stack spacing={1.5}>
                {workspaces.map((workspace) => (
                  <Paper
                    key={workspace.workspaceId}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      borderColor: selectedWorkspaceId === workspace.workspaceId ? 'primary.main' : 'divider',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedWorkspaceId(workspace.workspaceId)}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Radio value={workspace.workspaceId} />
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>{workspace.workspaceName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Workspace ID: {workspace.workspaceId}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </RadioGroup>
          )}

          <Button
            variant="contained"
            disabled={!selectedWorkspaceId || isLoading || isSubmitting}
            onClick={() => void handleConnect()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {isSubmitting ? 'Connecting...' : 'Connect Workspace'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
