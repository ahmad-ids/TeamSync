import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
export interface AuthFeatureSlide {
  title: string;
  description: string;
}

interface AuthFeatureSliderProps {
  eyebrow: string;
  slides: readonly AuthFeatureSlide[];
  styles: Record<string, SxProps<Theme>>;
}

export function AuthFeatureSlider({ eyebrow, slides, styles }: AuthFeatureSliderProps) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      changeSlide((activeSlideIndex + 1) % slides.length);
    }, 5200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeSlideIndex, slides.length]);

  function changeSlide(nextIndex: number) {
    if (nextIndex === activeSlideIndex) {
      return;
    }

    setIsTransitioning(true);
    window.setTimeout(() => {
      setActiveSlideIndex(nextIndex);
      setIsTransitioning(false);
    }, 170);
  }

  const activeSlide = slides[activeSlideIndex];

  return (
    <Box sx={styles.featurePanel}>
      <Stack spacing={2.5}>
        <Typography sx={styles.featureEyebrow}>{eyebrow}</Typography>

        <Box sx={isTransitioning ? styles.featureFadeOut : styles.featureFadeIn}>
          <Typography sx={styles.featureHeading}>{activeSlide.title}</Typography>
          <Typography sx={styles.featureDescription}>{activeSlide.description}</Typography>
        </Box>

        <Stack direction="row" spacing={1.1} sx={styles.featureDots}>
          {slides.map((slide, index) => (
            <Box
              key={slide.title}
              component="button"
              onClick={() => changeSlide(index)}
              aria-label={`Show feature slide ${index + 1}`}
              sx={index === activeSlideIndex ? styles.featureDotActive : styles.featureDotInactive}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
