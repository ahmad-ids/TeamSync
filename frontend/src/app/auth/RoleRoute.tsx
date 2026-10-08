import type { PropsWithChildren } from 'react';
import { CircularProgress } from '@mui/material';
import { Navigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from './AuthProvider';
import { normalizeRole, resolveHomePathByRole } from './roleAccess';

interface RoleRouteProps extends PropsWithChildren {
  allowedRoles: ReadonlyArray<'TeamLeader' | 'Member'>;
}

export function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { status, user, session } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <LoadingShell>
        <CircularProgress color="primary" />
      </LoadingShell>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const role = normalizeRole(user?.role ?? session?.role);
  if (!allowedRoles.includes(role)) {
    return <Navigate to={resolveHomePathByRole(role)} replace />;
  }

  return <>{children}</>;
}

// Styled components
const LoadingShell = styled.div`
  min-height: 100vh;
  display: grid;
  place-items: center;
`;
