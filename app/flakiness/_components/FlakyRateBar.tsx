import { Box, LinearProgress, Typography } from '@mui/material';

import { formatPercent, getSeverity } from './severity';

interface FlakyRateBarProps {
  rate: number;
}

/** A labelled progress bar that visualizes a workflow's flaky rate. */
export default function FlakyRateBar({ rate }: FlakyRateBarProps) {
  const severity = getSeverity(rate);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
      <LinearProgress
        variant="determinate"
        // Cap the visual fill at 100% while keeping small rates visible.
        value={Math.min(100, rate * 100)}
        sx={{
          flexGrow: 1,
          height: 8,
          borderRadius: 4,
          backgroundColor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            backgroundColor: severity.color,
          },
        }}
      />
      <Typography
        variant="body2"
        sx={{ minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      >
        {formatPercent(rate)}
      </Typography>
    </Box>
  );
}
