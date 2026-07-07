import { Box, Link, Stack, Tooltip, Typography } from '@mui/material';

import type { SeriesDef } from './comparison';

/** One column: a milestone (or any category) with a value per series key. */
export interface ColumnDatum {
  key: string | number;
  label: string;
  /** Small line under the axis label (e.g. a date). */
  sublabel?: string;
  values: Record<string, number>;
  href?: string;
}

interface StackedColumnChartProps {
  columns: ColumnDatum[];
  series: SeriesDef[];
  /** `count` stacks raw values; `share` normalizes each column to 100%. */
  mode?: 'count' | 'share';
  /** Unit noun for tooltips, e.g. "issues". */
  unit?: string;
  /** Height of the plot band in px (excludes axis + labels). */
  plotHeight?: number;
}

const COLUMN_WIDTH = 56;
const BAR_WIDTH = 26; // ≤ the 24–28px cap; leftover band is air.
const SEGMENT_GAP = 2; // surface gap between stacked fills.
const AXIS = '#c3c2b7';
const GRID = '#e1e0d9';

/** Round a max value up to a clean axis bound and derive ~4 gridline ticks. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}

/**
 * A grouped set of stacked columns, one per milestone. Doubles as a plain
 * single-series column chart (magnitude) when `series` has one entry — the
 * legend is dropped and each cap is directly labelled.
 */
export default function StackedColumnChart({
  columns,
  series,
  mode = 'count',
  unit = '',
  plotHeight = 220,
}: StackedColumnChartProps) {
  const totals = columns.map((c) =>
    series.reduce((sum, s) => sum + (c.values[s.key] ?? 0), 0),
  );
  const dataMax = Math.max(0, ...totals);
  const share = mode === 'share';
  const ticks = share ? [0, 25, 50, 75, 100] : niceTicks(dataMax);
  const axisMax = ticks[ticks.length - 1] || 1;
  const multiSeries = series.length > 1;

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  return (
    <Box>
      {multiSeries && <Legend series={series} />}

      <Box sx={{ display: 'flex' }}>
        {/* Y axis */}
        <Box
          sx={{
            position: 'relative',
            width: 36,
            height: plotHeight,
            flexShrink: 0,
            mr: 0.5,
          }}
        >
          {ticks.map((t) => (
            <Typography
              key={t}
              variant="caption"
              color="text.secondary"
              sx={{
                position: 'absolute',
                right: 4,
                bottom: `${(t / axisMax) * 100}%`,
                transform: 'translateY(50%)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {share ? `${t}%` : t}
            </Typography>
          ))}
        </Box>

        {/* Plot + columns (scrolls horizontally when milestones overflow) */}
        <Box sx={{ overflowX: 'auto', flexGrow: 1, pb: 0.5 }}>
          <Box sx={{ minWidth: columns.length * COLUMN_WIDTH }}>
            <Box sx={{ position: 'relative', height: plotHeight }}>
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

              {/* Columns */}
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
                {columns.map((col, i) => {
                  const total = totals[i];
                  const denom = share ? total : axisMax;
                  return (
                    <Box
                      key={col.key}
                      sx={{
                        width: COLUMN_WIDTH,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        position: 'relative',
                      }}
                    >
                      {/* Cap label: total in count mode (skip the noisy 100% in share mode) */}
                      {!share && total > 0 && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            position: 'absolute',
                            bottom: `${(total / denom) * 100}%`,
                            mb: 0.25,
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1,
                          }}
                        >
                          {fmt(total)}
                        </Typography>
                      )}

                      <Box
                        sx={{
                          width: BAR_WIDTH,
                          height: denom > 0 ? `${(total / denom) * 100}%` : 0,
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {series.map((s) => {
                          const v = col.values[s.key] ?? 0;
                          if (v <= 0) return null;
                          const segShare = total > 0 ? v / total : 0;
                          const pct = share
                            ? Math.round(segShare * 100)
                            : null;
                          return (
                            <Tooltip
                              key={s.key}
                              arrow
                              title={
                                <Box>
                                  <Typography variant="caption" component="div">
                                    {col.label}
                                  </Typography>
                                  <Typography variant="caption" component="div">
                                    {s.label}: {fmt(v)}
                                    {unit ? ` ${unit}` : ''}
                                    {total > 0 &&
                                      ` (${Math.round(segShare * 100)}%)`}
                                  </Typography>
                                </Box>
                              }
                            >
                              <Box
                                sx={{
                                  flexGrow: segShare,
                                  flexBasis: 0,
                                  minHeight: 2,
                                  bgcolor: s.color,
                                  // Rounded data-end only on the top-most fill.
                                  '&:first-of-type': {
                                    borderTopLeftRadius: 4,
                                    borderTopRightRadius: 4,
                                  },
                                  // 2px surface gap between touching fills.
                                  '&:not(:first-of-type)': {
                                    borderTop: `${SEGMENT_GAP}px solid`,
                                    borderColor: 'background.paper',
                                  },
                                }}
                                aria-label={
                                  share
                                    ? `${s.label}: ${pct}%`
                                    : `${s.label}: ${fmt(v)} ${unit}`
                                }
                              />
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* X axis labels */}
            <Box sx={{ display: 'flex', mt: 0.5 }}>
              {columns.map((col) => (
                <Box
                  key={col.key}
                  sx={{
                    width: COLUMN_WIDTH,
                    px: 0.25,
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Tooltip title={col.label} arrow>
                    {col.href ? (
                      <Link
                        href={col.href}
                        variant="caption"
                        noWrap
                        sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {col.label}
                      </Link>
                    ) : (
                      <Typography
                        variant="caption"
                        color="text.primary"
                        noWrap
                        sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {col.label}
                      </Typography>
                    )}
                  </Tooltip>
                  {col.sublabel && (
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      noWrap
                      sx={{ display: 'block', fontSize: 10 }}
                    >
                      {col.sublabel}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** Swatch + label legend; identity never rides color alone. */
function Legend({ series }: { series: SeriesDef[] }) {
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      sx={{ gap: 1.5, mb: 1.5 }}
      component="ul"
      role="list"
    >
      {series.map((s) => (
        <Box
          key={s.key}
          component="li"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, listStyle: 'none' }}
        >
          <Box
            sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: s.color, flexShrink: 0 }}
          />
          <Typography variant="caption" color="text.secondary">
            {s.label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
