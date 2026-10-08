import { alpha } from '@mui/material/styles';
import { Backdrop, Box, CircularProgress, Fade, Stack, Typography } from '@mui/material';
import styled from 'styled-components';

interface ExternalAuthLoadingStateProps {
  open: boolean;
  provider: 'clickup' | null;
}

export function ExternalAuthLoadingState({ open, provider }: ExternalAuthLoadingStateProps) {
  const providerLabel = 'ClickUp';

  return (
    <LoadingBackdrop open={open}>
      <Fade in={open} timeout={180}>
        <ContentCard spacing={1.4} alignItems="center">
          <ProviderBadge>{providerLabel}</ProviderBadge>
          <LoaderCircle size={26} thickness={4.2} />
          <Stack spacing={0.35} alignItems="center">
            <HeadingTypography>
              Redirecting to {providerLabel}
            </HeadingTypography>
            <BodyTypography>
              Preparing a secure sign-in session and opening the provider window.
            </BodyTypography>
          </Stack>
        </ContentCard>
      </Fade>
    </LoadingBackdrop>
  );
}

// Styled components
const LoadingBackdrop = styled(Backdrop)`
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  background-color: ${alpha('#f8fbff', 0.88)};
  backdrop-filter: blur(6px);
`;

const ContentCard = styled(Stack)`
  width: min(300px, calc(100% - 32px));
  padding: 18px 18px 16px;
  text-align: center;
  border-radius: 18px;
  border: 1px solid ${alpha('#d7e4f8', 0.9)};
  background: ${alpha('#ffffff', 0.94)};
  box-shadow: 0 10px 28px rgba(31, 78, 155, 0.08);
`;

const HeadingTypography = styled(Typography)`
  color: #24315a;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.01em;
`;

const BodyTypography = styled(Typography)`
  color: #66738f;
  font-size: 12.5px;
  line-height: 1.5;
  max-width: 240px;
`;

const ProviderBadge = styled(Typography)`
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 999px;
  color: #2d5cc4;
  background: ${alpha('#dbeafe', 0.9)};
  border: 1px solid ${alpha('#93c5fd', 0.35)};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const LoaderCircle = styled(CircularProgress)`
  color: #2563eb;
`;
