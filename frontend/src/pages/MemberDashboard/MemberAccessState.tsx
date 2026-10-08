import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../app/auth/AuthProvider';
import { appColors } from '../../theme/theme';

interface MemberAccessStateProps {
  message: string;
}

export function MemberAccessState({ message }: MemberAccessStateProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleSwitchAccount() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <PageShell>
      <CardPaper>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <IconBox>
              <LockOutlinedIcon />
            </IconBox>
            <Stack spacing={0.3}>
              <TitleText>
                Member access required
              </TitleText>
              <SubtitleText>
                The signed-in account cannot open the Member workspace.
              </SubtitleText>
            </Stack>
          </Stack>

          <InfoAlert severity="info">
            {message}
          </InfoAlert>

          <BodyText>
            If this account should have member access, ask your Team Leader or administrator to assign the correct role and team membership.
          </BodyText>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button variant="contained" onClick={handleSwitchAccount} startIcon={<LogoutRoundedIcon />}>
              Switch account
            </Button>
          </Stack>
        </Stack>
      </CardPaper>
    </PageShell>
  );
}

// Styled components
const PageShell = styled.div`
  min-height: 56vh;
  display: grid;
  place-items: center;
`;

const CardPaper = styled(Paper)`
  width: 100%;
  max-width: 720px;
  padding: 24px;
  border-radius: 22px;
  border: 1px solid #dbe4f3;
  background: linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(245,249,255,0.98) 100%);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);

  @media (min-width: 900px) {
    padding: 32px;
  }
`;

const IconBox = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background-color: #eef4ff;
  color: #2563eb;
`;

const TitleText = styled(Typography)`
  font-size: 26px;
  line-height: 1.15;
  font-weight: 700;
  color: ${appColors.light.text.primary};
`;

const SubtitleText = styled(Typography)`
  color: ${appColors.light.text.secondary};
`;

const InfoAlert = styled(Alert)`
  border-radius: 20px;
`;

const BodyText = styled(Typography)`
  color: ${appColors.light.text.secondary};
  line-height: 1.75;
`;
