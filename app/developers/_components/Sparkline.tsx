import { Box } from '@mui/material';

interface SparklineProps {
  /** Values oldest → newest. */
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * A minimal bar sparkline for weekly commit activity. Pure SVG, no axes — it's
 * a glanceable trend, read alongside the numeric columns beside it.
 */
export default function Sparkline({
  values,
  width = 120,
  height = 28,
  color = '#2a78d6',
}: SparklineProps) {
  const max = Math.max(1, ...values);
  const n = values.length;
  const gap = 1;
  const barWidth = n > 0 ? (width - gap * (n - 1)) / n : width;

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Weekly commit activity over the last ${n} weeks`}
      sx={{ display: 'block' }}
      preserveAspectRatio="none"
    >
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(1.5, (v / max) * height) : 0;
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - h}
            width={barWidth}
            height={h}
            rx={barWidth > 3 ? 1 : 0}
            fill={color}
            opacity={v > 0 ? 0.85 : 0.15}
          />
        );
      })}
    </Box>
  );
}
