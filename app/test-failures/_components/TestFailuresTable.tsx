'use client';

import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Link,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import type { TestFailureReport, TestFailureRow } from '@/lib/github';

import { CLASS_META, classify, distinctBranches } from './classify';

interface TestFailuresTableProps {
  report: TestFailureReport;
}

type Order = 'asc' | 'desc';
type OrderBy =
  | 'name'
  | 'failed'
  | 'failureRate'
  | 'branches'
  | 'flaky'
  | 'firstFailureAt'
  | 'lastFailureAt';

interface Column {
  id: OrderBy;
  label: string;
  align?: 'right';
  tooltip?: string;
  /** Default direction when first clicked. */
  initial: Order;
}

const SORTABLE_COLUMNS: Column[] = [
  { id: 'name', label: 'Test', initial: 'asc' },
  { id: 'failed', label: 'Failed / ran', align: 'right', tooltip: 'Runs failed / runs the test ran in', initial: 'desc' },
  { id: 'failureRate', label: 'Fail rate', align: 'right', initial: 'desc' },
  { id: 'branches', label: 'Branches', align: 'right', tooltip: 'Distinct branches these failures came from', initial: 'desc' },
  { id: 'flaky', label: 'Classification', initial: 'desc' },
];

function sortValue(row: TestFailureRow, orderBy: OrderBy): string | number {
  switch (orderBy) {
    case 'name':
      return row.name.toLowerCase();
    case 'failed':
      return row.failed;
    case 'failureRate':
      return row.failureRate;
    case 'branches':
      return distinctBranches(row);
    case 'flaky':
      return CLASS_META[classify(row)].rank;
    case 'firstFailureAt':
      return failureSpan(row).first ?? '';
    case 'lastFailureAt':
      return row.lastFailureAt ?? '';
  }
}

/** First (oldest) and last (newest) failure timestamps for a test. */
function failureSpan(row: TestFailureRow): { first?: string; last?: string } {
  const fs = row.failures ?? [];
  if (fs.length === 0) return {};
  // `failures` is sorted newest-first by the data layer.
  return { last: fs[0].createdAt, first: fs[fs.length - 1].createdAt };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function rateColor(rate: number): string {
  if (rate >= 0.5) return 'error.main';
  if (rate >= 0.15) return 'warning.main';
  return 'text.primary';
}

function branchList(row: TestFailureRow) {
  const counts = new Map<string, number>();
  for (const f of row.failures ?? []) {
    const b = f.branch ?? '(unknown)';
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <Box>
      {entries.map(([branch, count]) => (
        <Typography key={branch} variant="caption" display="block">
          {branch}: {count}
        </Typography>
      ))}
    </Box>
  );
}

export default function TestFailuresTable({ report }: TestFailuresTableProps) {
  const [query, setQuery] = useState('');
  const [flakyOnly, setFlakyOnly] = useState(false);
  const [orderBy, setOrderBy] = useState<OrderBy>('flaky');
  const [order, setOrder] = useState<Order>('desc');

  const handleSort = (column: Column) => {
    if (orderBy === column.id) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(column.id);
      setOrder(column.initial);
    }
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = report.rows.filter((r) => {
      if (flakyOnly && classify(r) !== 'potentially-flaky') return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.classname.toLowerCase().includes(q)
      );
    });

    const dir = order === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, orderBy);
      const bv = sortValue(b, orderBy);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      // Stable tiebreak: most failures first, then test name.
      return b.failed - a.failed || a.name.localeCompare(b.name);
    });
  }, [report.rows, query, flakyOnly, orderBy, order]);

  return (
    <Stack spacing={3}>
      {report.downloadError && (
        <Alert severity="warning">
          <AlertTitle>Couldn’t download artifacts</AlertTitle>
          {report.downloadError}
          <Box sx={{ mt: 1 }}>
            Grant the build&apos;s <code>GITHUB_TOKEN</code> the{' '}
            <strong>actions</strong> scope (classic PAT: <code>repo</code> +{' '}
            <code>workflow</code>; fine-grained: <em>Actions → Read</em>), then
            rebuild. Test data below will be empty until then.
          </Box>
        </Alert>
      )}

      <SummaryCards report={report} />

      <WorkflowStats report={report} />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <TextField
          label="Filter tests"
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ width: { xs: '100%', sm: 320 } }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={flakyOnly}
              onChange={(e) => setFlakyOnly(e.target.checked)}
            />
          }
          label="Potentially flaky only"
        />
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Test failures">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 600 } }}>
              {SORTABLE_COLUMNS.map((col) => {
                const active = orderBy === col.id;
                const label = (
                  <TableSortLabel
                    active={active}
                    direction={active ? order : col.initial}
                    onClick={() => handleSort(col)}
                  >
                    {col.label}
                  </TableSortLabel>
                );
                return (
                  <TableCell key={col.id} align={col.align} sortDirection={active ? order : false}>
                    {col.tooltip ? <Tooltip title={col.tooltip}>{label}</Tooltip> : label}
                  </TableCell>
                );
              })}
              <TableCell sortDirection={orderBy === 'firstFailureAt' ? order : false}>
                <Tooltip title="Oldest → newest failure. Sorts by when the issue first appeared.">
                  <TableSortLabel
                    active={orderBy === 'firstFailureAt'}
                    direction={orderBy === 'firstFailureAt' ? order : 'desc'}
                    onClick={() =>
                      handleSort({ id: 'firstFailureAt', label: 'Time range', initial: 'desc' })
                    }
                  >
                    Time range
                  </TableSortLabel>
                </Tooltip>
              </TableCell>
              <TableCell align="right" sortDirection={orderBy === 'lastFailureAt' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'lastFailureAt'}
                  direction={orderBy === 'lastFailureAt' ? order : 'desc'}
                  onClick={() =>
                    handleSort({ id: 'lastFailureAt', label: 'Last failure', initial: 'desc' })
                  }
                >
                  Last failure
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TestRow key={`${row.classname} ${row.name}`} row={row} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      {report.rows.length === 0
                        ? 'No test failures found in the analyzed runs.'
                        : 'No tests match the current filter.'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function TestRow({ row }: { row: TestFailureRow }) {
  const branchCount = distinctBranches(row);
  const span = failureSpan(row);
  const cls = classify(row);
  const meta = CLASS_META[cls];
  return (
    <TableRow hover>
      <TableCell sx={{ maxWidth: 380 }}>
        <Link
          component={NextLink}
          href={`/test-failures/${row.id}/`}
          variant="body2"
          sx={{ fontWeight: 600, fontFamily: 'monospace' }}
        >
          {row.name}
        </Link>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ wordBreak: 'break-all' }}>
          {row.classname}
        </Typography>
      </TableCell>
      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
        <strong>{row.failed}</strong> / {row.seen}
      </TableCell>
      <TableCell align="right" sx={{ color: rateColor(row.failureRate), fontWeight: 600 }}>
        {pct(row.failureRate)}
      </TableCell>
      <TableCell align="right">
        <Tooltip title={branchList(row)}>
          <Box component="span" sx={{ fontWeight: branchCount > 1 ? 600 : 400 }}>
            {branchCount}
          </Box>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Chip
          label={meta.label}
          size="small"
          color={meta.color}
          variant={cls === 'potentially-flaky' ? 'filled' : 'outlined'}
        />
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {span.first ? (
          <Typography variant="body2">
            {span.first === span.last
              ? fmtDate(span.first)
              : `${fmtDate(span.first)} – ${fmtDate(span.last as string)}`}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        {row.lastFailureUrl && (
          <Tooltip
            title={
              row.lastFailureSha
                ? `${row.lastFailureSha.slice(0, 7)} · open run`
                : 'open run'
            }
          >
            <Link
              href={row.lastFailureUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'inline-flex', alignItems: 'center' }}
              aria-label="Open the most recent failing run on GitHub"
            >
              <OpenInNewIcon fontSize="small" />
            </Link>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}

function SummaryCards({ report }: { report: TestFailureReport }) {
  let potentiallyFlaky = 0;
  let branchSpecific = 0;
  let alwaysFails = 0;
  for (const row of report.rows) {
    const cls = classify(row);
    if (cls === 'potentially-flaky') potentiallyFlaky++;
    else if (cls === 'branch-specific') branchSpecific++;
    else alwaysFails++;
  }

  const stats = [
    {
      label: 'Runs analyzed',
      value: report.totalRunsParsed.toLocaleString(),
      helper: `of ${report.totalRunsAnalyzed.toLocaleString()} fetched`,
    },
    {
      label: 'Potentially flaky',
      value: potentiallyFlaky.toLocaleString(),
      helper: 'fail across multiple branches',
      color: 'warning.main',
    },
    {
      label: 'Branch-specific',
      value: branchSpecific.toLocaleString(),
      helper: 'fail on a single branch',
    },
    {
      label: 'Always-failing',
      value: alwaysFails.toLocaleString(),
      helper: 'failed every run',
      color: 'error.main',
    },
    {
      label: 'Failure occurrences',
      value: report.totalFailureOccurrences.toLocaleString(),
      helper: `${report.uniqueFailingTests.toLocaleString()} unique tests`,
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr 1fr',
          md: 'repeat(auto-fit, minmax(180px, 1fr))',
        },
        gap: 2,
      }}
    >
      {stats.map((s) => (
        <Card key={s.label} variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              {s.label}
            </Typography>
            <Typography variant="h4" component="p" sx={{ color: s.color ?? 'text.primary', fontWeight: 600 }}>
              {s.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {s.helper}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function WorkflowStats({ report }: { report: TestFailureReport }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {report.workflows.map((w) => (
        <Chip
          key={w.workflowId}
          variant="outlined"
          label={`${w.label}: ${w.runsParsed}/${w.runsAnalyzed} runs parsed`}
          color={w.runsParsed > 0 ? 'default' : 'warning'}
        />
      ))}
    </Box>
  );
}
