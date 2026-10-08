import { alpha } from '@mui/material/styles';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { Paper, Stack, Typography } from '@mui/material';
import styled from 'styled-components';
import { appColors } from '../../theme/theme';

export function PreviewBlocks({ percentage, fillColor }: { percentage: number; fillColor: string }) {
  const activeCount = Math.max(0, Math.min(5, Math.ceil(percentage / 20)));

  return (
    <BlocksGrid>
      {Array.from({ length: 5 }, (_, index) => (
        <PreviewBlock
          key={index}
          $active={index < activeCount}
          $fillColor={fillColor}
        />
      ))}
    </BlocksGrid>
  );
}

export function SectionCard(props: { title: string; children: React.ReactNode }) {
  return (
    <CardPaper>
      <Stack spacing={2.1}>
        <CardTitle>{props.title}</CardTitle>
        {props.children}
      </Stack>
    </CardPaper>
  );
}

export function MetricRow(props: { label: string; value: string }) {
  return (
    <MetricRowStack direction="row" justifyContent="space-between" alignItems="center">
      <MetricLabel>
        {props.label}
      </MetricLabel>
      <MetricValue>{props.value}</MetricValue>
    </MetricRowStack>
  );
}

export function Guideline({ text }: { text: string }) {
  return (
    <GuidelineStack direction="row" spacing={1.2} alignItems="flex-start">
      <GuidelineIcon />
      <GuidelineText>{text}</GuidelineText>
    </GuidelineStack>
  );
}

// Styled components
const BlocksGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7.2px;
`;

const PreviewBlock = styled.div<{ $active: boolean; $fillColor: string }>`
  height: 28px;
  border-radius: 9.6px;
  background-color: ${({ $active, $fillColor }) => ($active ? $fillColor : 'rgba(255,255,255,0.18)')};
  border: 1px solid rgba(255,255,255,0.08);
`;

const CardPaper = styled(Paper)`
  padding: 18px;
  border-radius: 24px;
  border: 1px solid ${alpha(appColors.light.border.soft, 0.9)};
  background-color: ${appColors.light.background.paper};
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);

  @media (min-width: 900px) {
    padding: 24px;
  }
`;

const CardTitle = styled(Typography)`
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${appColors.light.text.primary};
`;

const MetricRowStack = styled(Stack)`
  width: 100%;
`;

const MetricLabel = styled(Typography)`
  color: ${appColors.light.text.secondary};
  font-size: 13px;
  font-weight: 600;
`;

const MetricValue = styled(Typography)`
  font-size: 14.5px;
  font-weight: 700;
  color: ${appColors.light.text.primary};
`;

const GuidelineStack = styled(Stack)`
  width: 100%;
`;

const GuidelineIcon = styled(PersonRoundedIcon)`
  color: #0f4a86;
  font-size: 16px;
  margin-top: 1.6px;
`;

const GuidelineText = styled(Typography)`
  color: #54657f;
  font-size: 13px;
  line-height: 1.6;
`;
