import { CircularProgress } from '@mui/material';
import { Navigate, Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from './AuthProvider';
import { resolveHomePathByRole } from './roleAccess';

export function PublicOnlyRoute() {
  const { status, user, session } = useAuth();

  if (status === 'loading') {
    return (
      <LoadingShell>
        <CircularProgress color="primary" />
      </LoadingShell>
    );
  }

  if (status === 'authenticated') {
    const destination = resolveHomePathByRole(user?.role ?? session?.role);
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}

// Styled components
const LoadingShell = styled.div`
  min-height: 100vh;
  display: grid;
  place-items: center;
`;
