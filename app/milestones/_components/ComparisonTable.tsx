import {
  Box,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import { EARLY_COLOR, LATE_COLOR } from './comparison';
import type { MilestoneComparisonRow } from './comparison';

interface ComparisonTableProps {
  rows: MilestoneComparisonRow[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function Slip({ days }: { days: number | null }) {
  if (days == null) {
    return (
      <Typography variant="body2" color="text.disabled" component="span">
        —
      </Typography>
    );
  }
  if (days === 0) {
    return (
      <Typography variant="body2" color="text.secondary" component="span">
        on time
      </Typography>
    );
  }
  const late = days > 0;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: late ? LATE_COLOR : EARLY_COLOR }} />
      <Typography
        variant="body2"
        component="span"
        sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}
      >
        {late ? '+' : '−'}
        {Math.abs(days)}d {late ? 'late' : 'early'}
      </Typography>
    </Box>
  );
}

/**
 * The full comparison as a table — the WCAG-clean twin of the charts. Every
 * value plotted above is reachable here without relying on color.
 */
export default function ComparisonTable({ rows }: ComparisonTableProps) {
  const num = { fontVariantNumeric: 'tabular-nums' } as const;

  return (
    <TableContainer>
      <Table size="small" aria-label="Milestone comparison">
        <TableHead>
          <TableRow>
            <TableCell>Milestone</TableCell>
            <TableCell>Due</TableCell>
            <TableCell>Finished</TableCell>
            <TableCell>Schedule</TableCell>
            <TableCell align="right">Issues</TableCell>
            <TableCell align="right">Completed</TableCell>
            <TableCell align="right">Median cycle</TableCell>
            <TableCell align="right">Slowest</TableCell>
            <TableCell align="right">Contributors</TableCell>
            <TableCell align="right">Added after due</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.number} hover>
              <TableCell>
                <Link href={`/milestones/${r.number}`} variant="body2">
                  {r.title}
                </Link>
              </TableCell>
              <TableCell>{fmtDate(r.dueOn)}</TableCell>
              <TableCell>{fmtDate(r.effectiveEnd)}</TableCell>
              <TableCell>
                <Slip days={r.daysLate} />
              </TableCell>
              <TableCell align="right" sx={num}>
                {r.total}
              </TableCell>
              <TableCell align="right" sx={num}>
                {r.completionPercent}%
              </TableCell>
              <TableCell align="right" sx={num}>
                {r.medianCycleDays != null ? `${r.medianCycleDays}d` : '—'}
              </TableCell>
              <TableCell align="right" sx={num}>
                {r.slowestCycleDays != null ? `${r.slowestCycleDays}d` : '—'}
              </TableCell>
              <TableCell align="right" sx={num}>
                {r.contributors}
              </TableCell>
              <TableCell align="right" sx={num}>
                {r.dueOn ? r.addedAfterDue : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
