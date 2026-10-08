import { CircularProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from './AuthProvider';

export function ProtectedRoute() {
  const { status } = useAuth();
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

  return <Outlet />;
}

// Styled components
const LoadingShell = styled.div`
  min-height: 100vh;
  display: grid;
  place-items: center;
`;
