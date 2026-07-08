'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Divider,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { MergeType, BugReport } from '@mui/icons-material';

import type { DeveloperStats, DeveloperTimeRange } from '@/lib/github';

import StatCard from './StatCard';
import {
  TIME_RANGES,
  formatCount,
  formatDays,
  formatNet,
  formatRate,
  rangeWindowLabel,
} from './format';

function Fact({
  label,
  value,
  help,
}: {
  label: string;
  value: React.ReactNode;
  help?: string;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
        {help && (
          <Typography variant="caption" color="text.disabled" display="block">
            {help}
          </Typography>
        )}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );
}

function BreakdownCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        </Box>
        <Divider sx={{ mb: 0.5 }} />
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * The range-dependent slice of a developer's page: a Week/Month/Year tab bar
 * that drives the headline KPIs and the pull-request / issue breakdowns.
 */
export default function DeveloperBreakdown({ dev }: { dev: DeveloperStats }) {
  const [range, setRange] = useState<DeveloperTimeRange>('year');
  const m = dev.ranges[range];
  const windowLabel = rangeWindowLabel(range);

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
        }}
      >
        <StatCard
          label="Commits"
          value={formatCount(m.commits)}
          helper={windowLabel}
          color="primary.main"
        />
        <StatCard
          label="Net lines"
          value={
            <Box component="span" sx={{ color: m.netLines >= 0 ? 'success.main' : 'error.main' }}>
              {formatNet(m.netLines)}
            </Box>
          }
          helper={`+${formatCount(m.additions)} / −${formatCount(m.deletions)}`}
        />
        <StatCard
          label="PRs merged"
          value={formatCount(m.prsMerged)}
          helper={
            m.prsOpened > 0
              ? `${formatRate(m.prMergeRate)} of ${formatCount(m.prsOpened)} opened`
              : `no PRs in the ${windowLabel}`
          }
        />
        <StatCard
          label="Issues resolved"
          value={formatCount(m.issuesClosed)}
          helper={`${formatCount(m.issuesOpened)} opened`}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mt: 2,
        }}
      >
        <BreakdownCard title="Pull requests" icon={<MergeType />}>
          <Fact label={`Opened (${windowLabel})`} value={formatCount(m.prsOpened)} />
          <Fact label={`Merged (${windowLabel})`} value={formatCount(m.prsMerged)} />
          <Fact label="Merge rate" value={formatRate(m.prMergeRate)} />
          <Fact
            label="Median time to merge"
            value={formatDays(dev.medianDaysToMerge)}
            help="open → merge, all-time"
          />
        </BreakdownCard>

        <BreakdownCard title="Issues" icon={<BugReport />}>
          <Fact label={`Opened (${windowLabel})`} value={formatCount(m.issuesOpened)} />
          <Fact label={`Resolved (${windowLabel})`} value={formatCount(m.issuesClosed)} />
          <Fact label="Assigned" value={formatCount(dev.issuesAssigned)} help="all-time" />
          <Fact
            label="Assigned & closed"
            value={formatCount(dev.issuesAssignedCompleted)}
            help="all-time"
          />
        </BreakdownCard>
      </Box>
    </Box>
  );
}
