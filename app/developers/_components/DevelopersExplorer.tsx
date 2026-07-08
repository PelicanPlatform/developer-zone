'use client';

import { useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Link,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { InfoOutlined, Groups, Commit, MergeType, EmojiEvents } from '@mui/icons-material';

import type { DeveloperReport, DeveloperStats, DeveloperTimeRange } from '@/lib/github';

import Sparkline from './Sparkline';
import StatCard from './StatCard';
import { TIME_RANGES, formatCount, formatNet, formatWeekAgo, rangeWindowLabel } from './format';

interface DevelopersExplorerProps {
  report: DeveloperReport;
  /** Build-time clock (ms) for the "last active" column. */
  now: number;
}

function MetricHead({ title, help }: { title: string; help?: string }) {
  return (
    <TableCell align="right" sx={{ verticalAlign: 'bottom' }}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {help && (
          <Tooltip title={help} arrow>
            <InfoOutlined sx={{ fontSize: 15, color: 'text.disabled' }} />
          </Tooltip>
        )}
      </Box>
    </TableCell>
  );
}

function Num({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <TableCell
      align="right"
      sx={{ fontVariantNumeric: 'tabular-nums', color: dim ? 'text.disabled' : 'text.primary' }}
    >
      {children}
    </TableCell>
  );
}

export default function DevelopersExplorer({ report, now }: DevelopersExplorerProps) {
  const [range, setRange] = useState<DeveloperTimeRange>('year');
  const windowLabel = rangeWindowLabel(range);

  // Rows sorted by the selected range's commit count (all-time commits break ties).
  const rows = useMemo(() => {
    return [...report.developers].sort(
      (a, b) =>
        b.ranges[range].commits - a.ranges[range].commits ||
        b.commits - a.commits ||
        a.login.localeCompare(b.login),
    );
  }, [report.developers, range]);

  const summary = useMemo(() => {
    let commits = 0;
    let prsMerged = 0;
    let active = 0;
    let top: DeveloperStats | null = null;
    for (const d of report.developers) {
      const m = d.ranges[range];
      commits += m.commits;
      prsMerged += m.prsMerged;
      if (m.commits > 0) active += 1;
      if (!top || m.commits > top.ranges[range].commits) top = d;
    }
    return { commits, prsMerged, active, top };
  }, [report.developers, range]);

  return (
    <Box>
      <Tabs
        value={range}
        onChange={(_, v) => setRange(v as DeveloperTimeRange)}
        sx={{ mb: 3, minHeight: 40 }}
        aria-label="Time range"
      >
        {TIME_RANGES.map((r) => (
          <Tab key={r.key} value={r.key} label={r.label} sx={{ minHeight: 40 }} />
        ))}
      </Tabs>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          label="Active contributors"
          value={formatCount(summary.active)}
          helper={`committed in the ${windowLabel}`}
          icon={<Groups fontSize="small" />}
        />
        <StatCard
          label="Commits"
          value={formatCount(summary.commits)}
          helper={windowLabel}
          icon={<Commit fontSize="small" />}
        />
        <StatCard
          label="PRs merged"
          value={formatCount(summary.prsMerged)}
          helper={windowLabel}
          icon={<MergeType fontSize="small" />}
        />
        <StatCard
          label="Most active"
          value={summary.top && summary.top.ranges[range].commits > 0 ? summary.top.login : '—'}
          helper={
            summary.top && summary.top.ranges[range].commits > 0
              ? `${formatCount(summary.top.ranges[range].commits)} commits`
              : `no commits in the ${windowLabel}`
          }
          color="primary.main"
          icon={<EmojiEvents fontSize="small" />}
        />
      </Box>

      <TableContainer>
        <Table size="small" aria-label="Developers">
          <TableHead>
            <TableRow>
              <TableCell sx={{ verticalAlign: 'bottom' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Developer
                </Typography>
              </TableCell>
              <MetricHead title="Commits" help={`Commits in the ${windowLabel}.`} />
              <MetricHead title="Net lines" help={`Lines added minus deleted in the ${windowLabel}.`} />
              <MetricHead title="PRs merged" help={`Pull requests merged in the ${windowLabel}.`} />
              <MetricHead title="Issues closed" help={`Issues resolved in the ${windowLabel}.`} />
              <MetricHead title="Last active" help="Most recent week with a commit (all-time)." />
              <TableCell align="right" sx={{ verticalAlign: 'bottom' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  52-week activity
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => {
              const m = d.ranges[range];
              return (
                <TableRow key={d.login} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar
                        src={d.avatarUrl}
                        alt=""
                        sx={{ width: 28, height: 28 }}
                        slotProps={{ img: { loading: 'lazy' } }}
                      />
                      <Link
                        href={`/developers/${encodeURIComponent(d.login)}`}
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                      >
                        {d.login}
                      </Link>
                    </Box>
                  </TableCell>
                  <Num dim={m.commits === 0}>{formatCount(m.commits)}</Num>
                  <Num dim={m.netLines === 0}>
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        color:
                          m.netLines > 0
                            ? 'success.main'
                            : m.netLines < 0
                              ? 'error.main'
                              : 'text.disabled',
                      }}
                    >
                      {formatNet(m.netLines)}
                    </Typography>
                  </Num>
                  <Num dim={m.prsMerged === 0}>{formatCount(m.prsMerged)}</Num>
                  <Num dim={m.issuesClosed === 0}>{formatCount(m.issuesClosed)}</Num>
                  <Num dim>{formatWeekAgo(d.lastActiveWeek, now)}</Num>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Sparkline values={d.recentWeeks.map((w) => w.commits)} />
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
