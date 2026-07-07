'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import { SEQUENTIAL_COLOR } from './comparison';
import type { MilestoneComparison, SeriesDef } from './comparison';
import StackedColumnChart from './StackedColumnChart';
import type { ColumnDatum } from './StackedColumnChart';
import ComparisonTable from './ComparisonTable';

interface MilestoneComparisonViewProps {
  comparison: MilestoneComparison;
}

// Outcome states reuse the status palette (meaning, not identity) — matching the
// per-milestone summary's Completed / In progress / Not planned colors.
const SCOPE_SERIES: SeriesDef[] = [
  { key: 'completed', label: 'Completed', color: '#0ca30c' },
  { key: 'inProgress', label: 'In progress', color: '#fab219' },
  { key: 'notPlanned', label: 'Not planned', color: '#898781' },
];

const CYCLE_SERIES: SeriesDef[] = [
  { key: 'median', label: 'Median days to close', color: SEQUENTIAL_COLOR },
];

type ShareMode = 'count' | 'share';

function compactDue(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  const month = d.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
  return `${month} ’${String(d.getUTCFullYear()).slice(2)}`;
}

export default function MilestoneComparisonView({
  comparison,
}: MilestoneComparisonViewProps) {
  const [typeMode, setTypeMode] = useState<ShareMode>('count');
  const [contribMode, setContribMode] = useState<ShareMode>('count');

  const { rows } = comparison;

  const columns: ColumnDatum[] = rows.map((r) => ({
    key: r.number,
    label: r.title,
    sublabel: compactDue(r.dueOn),
    href: `/milestones/${r.number}`,
    values: {}, // per-chart values are supplied below
  }));

  const withValues = (pick: (i: number) => Record<string, number>): ColumnDatum[] =>
    columns.map((c, i) => ({ ...c, values: pick(i) }));

  return (
    <Stack spacing={4}>
      <ChartCard
        title="Cycle time"
        subtitle="Median days from an issue being opened to being closed, per milestone. A rising trend means work took longer to clear."
      >
        <StackedColumnChart
          columns={withValues((i) => ({ median: rows[i].medianCycleDays ?? 0 }))}
          series={CYCLE_SERIES}
          unit="days"
        />
      </ChartCard>

      <ChartCard
        title="Scope & outcome"
        subtitle="Issues per milestone, split by how they ended. Growing bars mean growing scope; a rising “not planned” slice means work was dropped."
      >
        <StackedColumnChart
          columns={withValues((i) => ({
            completed: rows[i].completed,
            inProgress: rows[i].inProgress,
            notPlanned: rows[i].notPlanned,
          }))}
          series={SCOPE_SERIES}
          unit="issues"
        />
      </ChartCard>

      <ChartCard
        title="Issue types"
        subtitle="Label mix per milestone (an issue contributes one segment per label it carries). A shift toward bug-type labels can foreshadow a slip."
        action={<ModeToggle value={typeMode} onChange={setTypeMode} />}
      >
        <StackedColumnChart
          columns={withValues((i) => rows[i].labelCounts)}
          series={comparison.labelSeries}
          mode={typeMode}
          unit="issues"
        />
      </ChartCard>

      <ChartCard
        title="Contributors"
        subtitle="Assignments per milestone by contributor. Watch for work concentrating on fewer people, or a shrinking roster, around a late release."
        action={<ModeToggle value={contribMode} onChange={setContribMode} />}
      >
        <StackedColumnChart
          columns={withValues((i) => rows[i].contributorCounts)}
          series={comparison.contributorSeries}
          mode={contribMode}
          unit="issues"
        />
      </ChartCard>

      <ChartCard
        title="All metrics"
        subtitle="Every value above in one sortable-by-eye table — the color-free view."
      >
        <ComparisonTable rows={rows} />
      </ChartCard>
    </Stack>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            mb: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ maxWidth: 640 }}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: ShareMode;
  onChange: (mode: ShareMode) => void;
}) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_, next) => next && onChange(next)}
      aria-label="Chart value mode"
    >
      <ToggleButton value="count">Counts</ToggleButton>
      <ToggleButton value="share">Share</ToggleButton>
    </ToggleButtonGroup>
  );
}

