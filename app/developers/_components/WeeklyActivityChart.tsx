import { Box, Tooltip, Typography } from '@mui/material';

import type { DeveloperWeek } from '@/lib/github';

interface WeeklyActivityChartProps {
  weeks: DeveloperWeek[];
  color?: string;
  height?: number;
}

const AXIS = '#c3c2b7';
const GRID = '#e1e0d9';

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= max / 4) ?? 10 * pow;
  return Math.ceil(max / step) * step;
}

/**
 * A 52-column bar chart of weekly commit activity. Each bar is a week; hovering
 * reveals the exact commits and churn. First-of-month bars carry a tick label
 * so the year reads left-to-right without crowding.
 */
export default function WeeklyActivityChart({
  weeks,
  color = '#2a78d6',
  height = 160,
}: WeeklyActivityChartProps) {
  const max = Math.max(0, ...weeks.map((w) => w.commits));
  const axisMax = niceMax(max);
  const ticks = [0, axisMax / 2, axisMax];

  // Label a bar when it's the first week of a new month — a short "Jun", or
  // "Jan '25" at a year boundary so the timeline stays readable but compact.
  const monthLabelFor = (i: number): string | null => {
    const w = weeks[i];
    const month = w.weekStart.slice(0, 7);
    const isNewMonth = i === 0 || weeks[i - 1].weekStart.slice(0, 7) !== month;
    if (!isNewMonth) return null;
    const d = new Date(`${w.weekStart}T00:00:00Z`);
    const abbr = d.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
    return d.getUTCMonth() === 0
      ? `${abbr} '${String(d.getUTCFullYear()).slice(2)}`
      : abbr;
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Y axis */}
      <Box sx={{ position: 'relative', width: 24, height, flexShrink: 0, mr: 0.5 }}>
        {ticks.map((t) => (
          <Typography
            key={t}
            variant="caption"
            color="text.secondary"
            sx={{
              position: 'absolute',
              right: 2,
              bottom: `${(t / axisMax) * 100}%`,
              transform: 'translateY(50%)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              fontSize: 10,
            }}
          >
            {Math.round(t)}
          </Typography>
        ))}
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ position: 'relative', height }}>
          {/* Gridlines */}
          {ticks.map((t) => (
            <Box
              key={t}
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${(t / axisMax) * 100}%`,
                borderTop: '1px solid',
                borderColor: t === 0 ? AXIS : GRID,
              }}
            />
          ))}

          {/* Bars */}
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
            {weeks.map((w) => {
              const h = w.commits > 0 ? Math.max(2, (w.commits / axisMax) * height) : 0;
              return (
                <Tooltip
                  key={w.weekStart}
                  arrow
                  title={
                    <Box>
                      <Typography variant="caption" component="div">
                        Week of{' '}
                        {new Date(`${w.weekStart}T00:00:00Z`).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </Typography>
                      <Typography variant="caption" component="div">
                        {w.commits} commit{w.commits === 1 ? '' : 's'}
                      </Typography>
                      {(w.additions > 0 || w.deletions > 0) && (
                        <Typography variant="caption" component="div">
                          +{w.additions.toLocaleString()} / −{w.deletions.toLocaleString()} lines
                        </Typography>
                      )}
                    </Box>
                  }
                >
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      height: h,
                      bgcolor: color,
                      opacity: w.commits > 0 ? 0.85 : 0,
                      borderRadius: '2px 2px 0 0',
                      transition: 'opacity 0.15s',
                      '&:hover': { opacity: 1 },
                    }}
                    aria-label={`${w.weekStart}: ${w.commits} commits`}
                  />
                </Tooltip>
              );
            })}
          </Box>
        </Box>

        {/* Month tick labels */}
        <Box sx={{ display: 'flex', gap: '2px', mt: 0.5 }}>
          {weeks.map((w, i) => {
            const label = monthLabelFor(i);
            return (
              <Box key={w.weekStart} sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
                {label && (
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{
                      position: 'absolute',
                      left: 0,
                      fontSize: 9,
                      whiteSpace: 'nowrap',
                      transform: 'translateX(-2px)',
                    }}
                  >
                    {label}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
