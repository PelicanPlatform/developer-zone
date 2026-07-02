'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  IconButton,
  Link,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, CenterFocusStrong, Remove } from '@mui/icons-material';

import type { MilestoneIssue } from '@/lib/github';

interface MilestoneTimelineViewProps {
  issues: MilestoneIssue[];
  /** The milestone's due date (ISO), drawn as an "expected publish" marker. */
  dueOn: string | null;
}

const DAY_MS = 86_400_000;

// Layout constants (px).
const LABEL_WIDTH = 240;
const ROW_HEIGHT = 34;
const BAR_HEIGHT = 18;
const AXIS_HEIGHT = 34;

// Zoom bounds, in pixels per day.
const MIN_PX_PER_DAY = 0.4;
const MAX_PX_PER_DAY = 60;
const ZOOM_STEP = 1.6;
// The full range is fit into roughly this width when the view first loads.
const FIT_TARGET_WIDTH = 960;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Truncate an ISO timestamp to the start of its UTC day, in epoch ms. */
function startOfUTCDay(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** A resolved timeline segment: an issue positioned on the day axis. */
interface Segment {
  issue: MilestoneIssue;
  start: number;
  end: number;
}

/** Theme color token for a segment's bar, keyed on the issue's outcome. */
function barColor(issue: MilestoneIssue): string {
  if (issue.state === 'open') return 'warning.main';
  if (issue.stateReason === 'not_planned') return 'text.disabled';
  return 'success.main';
}

const LEGEND = [
  { label: 'Completed', color: 'success.main' },
  { label: 'In progress', color: 'warning.main' },
  { label: 'Not planned', color: 'text.disabled' },
];

interface Tick {
  ms: number;
  label: string;
}

/** Build axis ticks whose spacing adapts to the current zoom level. */
function buildTicks(start: number, end: number, pxPerDay: number): Tick[] {
  const ticks: Tick[] = [];

  if (pxPerDay >= 12) {
    // Daily granularity, thinned so labels keep ~64px of breathing room.
    const step = Math.max(1, Math.ceil(64 / pxPerDay));
    for (let ms = start; ms <= end; ms += step * DAY_MS) {
      const d = new Date(ms);
      ticks.push({ ms, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` });
    }
  } else {
    // Monthly granularity, anchored to the first of each month.
    let year = new Date(start).getUTCFullYear();
    let month = new Date(start).getUTCMonth();
    for (let ms = Date.UTC(year, month, 1); ms <= end; ) {
      const d = new Date(ms);
      ticks.push({
        ms,
        label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      });
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      ms = Date.UTC(year, month, 1);
    }
  }

  return ticks;
}

export default function MilestoneTimelineView({
  issues,
  dueOn,
}: MilestoneTimelineViewProps) {
  const dueMs = dueOn ? startOfUTCDay(dueOn) : null;

  // Open issues have no completion date, so their bar runs to "now". Resolve it
  // after mount to avoid a hydration mismatch between build time and view time;
  // until then, fall back to the latest known date in the data.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);

  const segments = useMemo<Segment[]>(() => {
    const dataMax = issues.reduce((max, issue) => {
      const end = issue.closedAt
        ? startOfUTCDay(issue.closedAt)
        : startOfUTCDay(issue.createdAt);
      return Math.max(max, end);
    }, 0);
    const openEnd = nowMs != null ? startOfUTCDay(new Date(nowMs).toISOString()) : dataMax;

    return issues.map((issue) => {
      const start = startOfUTCDay(issue.createdAt);
      const rawEnd = issue.closedAt ? startOfUTCDay(issue.closedAt) : openEnd;
      // Guarantee every segment spans at least one day so it stays visible.
      const end = Math.max(rawEnd, start + DAY_MS);
      return { issue, start, end };
    });
  }, [issues, nowMs]);

  const domain = useMemo(() => {
    if (segments.length === 0) return null;
    let start = Infinity;
    let end = -Infinity;
    for (const seg of segments) {
      if (seg.start < start) start = seg.start;
      if (seg.end > end) end = seg.end;
    }
    // Extend to the publish marker so it stays in view even when it falls
    // before the first issue or after the last one.
    if (dueMs != null) {
      if (dueMs < start) start = dueMs;
      if (dueMs > end) end = dueMs;
    }
    // Pad by a day on each side so edge bars aren't flush against the frame.
    return { start: start - DAY_MS, end: end + DAY_MS };
  }, [segments, dueMs]);

  const totalDays = domain ? (domain.end - domain.start) / DAY_MS : 0;

  const fitPxPerDay = useMemo(() => {
    if (totalDays <= 0) return MAX_PX_PER_DAY;
    const fit = FIT_TARGET_WIDTH / totalDays;
    return Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, fit));
  }, [totalDays]);

  const [pxPerDay, setPxPerDay] = useState(fitPxPerDay);

  const clampZoom = (value: number) =>
    Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, value));

  const trackWidth = totalDays * pxPerDay;
  const ticks = domain ? buildTicks(domain.start, domain.end, pxPerDay) : [];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" component="h2">
          Timeline
        </Typography>
        <Typography variant="body2" color="text.secondary">
          One row per issue, oldest first. Each bar runs from the day the issue
          was created to the day it was completed (open issues run to today).
          Drag the slider or use the buttons to zoom.
        </Typography>
      </Box>

      {segments.length === 0 || !domain ? (
        <Typography color="text.secondary">
          No issues are attached to this milestone yet.
        </Typography>
      ) : (
        <>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {LEGEND.map((item) => (
                <Box
                  key={item.label}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                >
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: 0.5,
                      bgcolor: item.color,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                </Box>
              ))}
              {dueMs != null && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 14,
                      height: 0,
                      borderTop: '2px dashed',
                      borderColor: 'error.main',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Expected publish
                  </Typography>
                </Box>
              )}
            </Box>

            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 260 }}
            >
              <Tooltip title="Zoom out">
                <IconButton
                  size="small"
                  onClick={() => setPxPerDay((p) => clampZoom(p / ZOOM_STEP))}
                  disabled={pxPerDay <= MIN_PX_PER_DAY}
                >
                  <Remove fontSize="small" />
                </IconButton>
              </Tooltip>
              <Slider
                size="small"
                aria-label="Timeline zoom"
                min={Math.log(MIN_PX_PER_DAY)}
                max={Math.log(MAX_PX_PER_DAY)}
                step={0.01}
                value={Math.log(pxPerDay)}
                onChange={(_, value) =>
                  setPxPerDay(clampZoom(Math.exp(value as number)))
                }
                sx={{ flexGrow: 1 }}
              />
              <Tooltip title="Zoom in">
                <IconButton
                  size="small"
                  onClick={() => setPxPerDay((p) => clampZoom(p * ZOOM_STEP))}
                  disabled={pxPerDay >= MAX_PX_PER_DAY}
                >
                  <Add fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fit to range">
                <IconButton size="small" onClick={() => setPxPerDay(fitPxPerDay)}>
                  <CenterFocusStrong fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>

          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              overflowX: 'auto',
              bgcolor: 'background.paper',
            }}
          >
            <Box
              sx={{ width: LABEL_WIDTH + trackWidth, minWidth: '100%', position: 'relative' }}
            >
              {/* Axis header */}
              <Box
                sx={{
                  display: 'flex',
                  height: AXIS_HEIGHT,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    width: LABEL_WIDTH,
                    flexShrink: 0,
                    bgcolor: 'background.paper',
                    borderRight: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" noWrap>
                    Issue
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative', width: trackWidth, flexShrink: 0 }}>
                  {ticks.map((tick) => (
                    <Box
                      key={tick.ms}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: ((tick.ms - domain.start) / DAY_MS) * pxPerDay,
                        display: 'flex',
                        alignItems: 'center',
                        pl: 0.5,
                        borderLeft: 1,
                        borderColor: 'divider',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {tick.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Rows */}
              <Box sx={{ position: 'relative' }}>
                {/* Gridlines behind every row */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: LABEL_WIDTH,
                    width: trackWidth,
                    zIndex: 0,
                  }}
                >
                  {ticks.map((tick) => (
                    <Box
                      key={tick.ms}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: ((tick.ms - domain.start) / DAY_MS) * pxPerDay,
                        borderLeft: 1,
                        borderColor: 'divider',
                        opacity: 0.5,
                      }}
                    />
                  ))}
                </Box>

                {segments.map((seg, index) => {
                  const left = ((seg.start - domain.start) / DAY_MS) * pxPerDay;
                  const width = Math.max(
                    3,
                    ((seg.end - seg.start) / DAY_MS) * pxPerDay,
                  );
                  const days = Math.round((seg.end - seg.start) / DAY_MS);

                  return (
                    <Box
                      key={seg.issue.number}
                      sx={{
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        height: ROW_HEIGHT,
                        bgcolor: index % 2 === 0 ? 'transparent' : 'action.hover',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          width: LABEL_WIDTH,
                          flexShrink: 0,
                          bgcolor:
                            index % 2 === 0 ? 'background.paper' : 'background.default',
                          borderRight: 1,
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          px: 1.5,
                          gap: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ flexShrink: 0 }}
                        >
                          #{seg.issue.number}
                        </Typography>
                        <Link
                          href={seg.issue.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="caption"
                          noWrap
                          sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {seg.issue.title}
                        </Link>
                      </Box>

                      <Box
                        sx={{ position: 'relative', width: trackWidth, flexShrink: 0 }}
                      >
                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="caption" component="div">
                                #{seg.issue.number} {seg.issue.title}
                              </Typography>
                              <Typography variant="caption" component="div">
                                Created {formatDate(seg.start)}
                              </Typography>
                              <Typography variant="caption" component="div">
                                {seg.issue.closedAt
                                  ? `Completed ${formatDate(startOfUTCDay(seg.issue.closedAt))}`
                                  : 'Still open'}
                              </Typography>
                              <Typography variant="caption" component="div">
                                {days} day{days === 1 ? '' : 's'}
                              </Typography>
                            </Box>
                          }
                          arrow
                        >
                          <Box
                            component={Link}
                            href={seg.issue.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              position: 'absolute',
                              top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                              left,
                              width,
                              height: BAR_HEIGHT,
                              bgcolor: barColor(seg.issue),
                              borderRadius: 0.75,
                              display: 'block',
                              opacity: 0.9,
                              transition: 'opacity 0.15s',
                              '&:hover': { opacity: 1 },
                            }}
                          />
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {/* Expected publish marker, spanning the axis and every row */}
              {dueMs != null && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: LABEL_WIDTH + ((dueMs - domain.start) / DAY_MS) * pxPerDay,
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      borderLeft: '2px dashed',
                      borderColor: 'error.main',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.75,
                      bgcolor: 'error.main',
                      color: 'error.contrastText',
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Publish · {formatDate(dueMs)}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </>
      )}
    </Stack>
  );
}
