import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

import type { MonthlyReport, MonthlyReportRow } from '@/lib/github';

interface ReportingTableProps {
  report: MonthlyReport;
}

/** A right-aligned header cell with an info tooltip describing the metric. */
function MetricHead({ title, help }: { title: string; help: string }) {
  return (
    <TableCell align="right" sx={{ verticalAlign: 'bottom' }}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Tooltip title={help} arrow>
          <InfoOutlined sx={{ fontSize: 15, color: 'text.disabled' }} />
        </Tooltip>
      </Box>
    </TableCell>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return (
    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
      {children}
    </TableCell>
  );
}

function Dash() {
  return (
    <Typography component="span" color="text.disabled">
      —
    </Typography>
  );
}

function UntouchedCell({ row }: { row: MonthlyReportRow }) {
  if (row.untouchedPercent == null) {
    return (
      <Num>
        <Tooltip title="Not available for this month" arrow>
          <span>
            <Dash />
          </span>
        </Tooltip>
      </Num>
    );
  }
  return (
    <Num>
      <Typography variant="body2" component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {row.untouchedPercent}%
      </Typography>
      {row.untouchedCount != null && (
        <Typography variant="caption" color="text.secondary" display="block">
          {row.untouchedCount} of {row.openAtMonthEnd} open
        </Typography>
      )}
    </Num>
  );
}

export default function ReportingTable({ report }: ReportingTableProps) {
  return (
    <TableContainer>
      <Table size="small" aria-label="Monthly report">
        <TableHead>
          <TableRow>
            <TableCell sx={{ verticalAlign: 'bottom' }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Month
              </Typography>
            </TableCell>
            <MetricHead
              title="Enhancements delivered (trailing 3 mo)"
              help={`Issues labelled "${report.enhancementLabel}" completed (closed, not "not planned") in this month and the two before it.`}
            />
            <MetricHead
              title="Max % open tickets untouched 3 mo"
              help="Of the tickets open at month-end, the share with no timeline activity (comment, label, reference, close/reopen, commit) in the prior 3 months. Reconstructed from each issue's event timeline."
            />
            <MetricHead
              title="% code covered by tests"
              help="Coverage % parsed from the newest CI coverage artifact in each month. Older months are blank once their artifacts pass GitHub's retention window."
            />
            <MetricHead
              title={`"${report.facilitationLabel}" closed (trailing 3 mo)`}
              help={`Issues labelled "${report.facilitationLabel}" closed in this month and the two before it.`}
            />
          </TableRow>
        </TableHead>
        <TableBody>
          {report.months.map((row) => (
            <TableRow key={row.month} hover>
              <TableCell>{row.label}</TableCell>
              <Num>{row.enhancementsTrailing3mo}</Num>
              <UntouchedCell row={row} />
              <Num>{row.coveragePercent != null ? `${row.coveragePercent}%` : <Dash />}</Num>
              <Num>{row.facilitationClosedTrailing3mo}</Num>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
