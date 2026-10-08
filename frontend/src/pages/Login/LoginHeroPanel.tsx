import { Box, Stack, Typography } from '@mui/material';
import { AuthFeatureSlider } from '../../components/auth/AuthFeatureSlider';
import { loginFeatureSlides } from '../../components/auth/authFeatureSlides';
import { pageStyles } from './LoginPage.styles';

export function LoginHeroPanel() {
  return (
    <Box sx={pageStyles.leftPane}>
      <Stack spacing={{ xs: 2.5, md: 3.25 }} sx={{ width: '100%', maxWidth: 540 }}>
        <Box sx={pageStyles.pill}>State of Flow</Box>

        <Typography sx={pageStyles.leftTitle}>
          Transform your <Box component="span" className="authHeroChaos">chaos</Box>
          <br />
          into clear velocity.
        </Typography>

        <Box sx={{ mt: { xs: 1, sm: 2, md: 4, xl: 6 } }}>
          <AuthFeatureSlider
            eyebrow="Stay In Motion"
            slides={loginFeatureSlides}
            styles={pageStyles}
          />
        </Box>
      </Stack>
    </Box>
  );
}
