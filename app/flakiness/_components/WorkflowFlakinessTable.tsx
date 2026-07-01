import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Chip,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import type { WorkflowFlakiness } from '@/lib/github';

import FlakyRateBar from './FlakyRateBar';

interface WorkflowFlakinessTableProps {
  workflows: WorkflowFlakiness[];
  /** Show a column counting runs from forks (external PRs). */
  showExternal?: boolean;
}

/** Sortable-by-flakiness table of per-workflow statistics. */
export default function WorkflowFlakinessTable({
  workflows,
  showExternal = false,
}: WorkflowFlakinessTableProps) {
  const columnCount = showExternal ? 9 : 8;
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Workflow flakiness">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 600 } }}>
            <TableCell>Workflow</TableCell>
            <TableCell align="right">Runs</TableCell>
            <TableCell align="right">Passed</TableCell>
            <TableCell align="right">Failed</TableCell>
            <Tooltip title="Runs that were retried (run attempt > 1)">
              <TableCell align="right">Re-runs</TableCell>
            </Tooltip>
            <Tooltip title="Runs that failed, then passed on re-run with no code change">
              <TableCell align="right">Recovered</TableCell>
            </Tooltip>
            {showExternal && (
              <Tooltip title="Runs originating from a forked repository (external PRs)">
                <TableCell align="right">External</TableCell>
              </Tooltip>
            )}
            <TableCell sx={{ minWidth: 180 }}>Flaky rate</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {workflows.map((w) => (
            <TableRow key={w.name} hover>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {w.name}
                </Typography>
              </TableCell>
              <TableCell align="right">{w.total}</TableCell>
              <TableCell align="right" sx={{ color: 'success.main' }}>
                {w.passed}
              </TableCell>
              <TableCell align="right" sx={{ color: w.failed ? 'error.main' : 'text.secondary' }}>
                {w.failed}
              </TableCell>
              <TableCell align="right">
                {w.reruns > 0 ? (
                  <Chip label={w.reruns} size="small" color="warning" variant="outlined" />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    0
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">{w.recovered}</TableCell>
              {showExternal && (
                <TableCell align="right">{w.external}</TableCell>
              )}
              <TableCell>
                <FlakyRateBar rate={w.flakyRate} />
              </TableCell>
              <TableCell align="right">
                <Tooltip title="View latest run on GitHub">
                  <Link
                    href={w.latestRunUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'inline-flex', alignItems: 'center' }}
                    aria-label={`View latest run for ${w.name} on GitHub`}
                  >
                    <OpenInNewIcon fontSize="small" />
                  </Link>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {workflows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnCount}>
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No completed runs found for this branch.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
