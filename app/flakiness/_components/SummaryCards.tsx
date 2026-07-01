import { Box, Card, CardContent, Typography } from '@mui/material';

import type { FlakinessReport } from '@/lib/github';

import { formatPercent } from './severity';

interface SummaryCardsProps {
  report: FlakinessReport;
}

interface Stat {
  label: string;
  value: string;
  helper?: string;
  color?: string;
}

/** Top-level summary metrics for a flakiness report. */
export default function SummaryCards({ report }: SummaryCardsProps) {
  const flakyWorkflows = report.workflows.filter((w) => w.reruns > 0).length;
  const totalRecovered = report.workflows.reduce((sum, w) => sum + w.recovered, 0);
  const scope = report.source === 'branch' ? `on ${report.branch}` : 'available';

  const stats: Stat[] = [
    {
      label: 'Runs analyzed',
      value: report.runsAnalyzed.toLocaleString(),
      helper: `of ${report.totalRunsAvailable.toLocaleString()} ${scope}`,
    },
    {
      label: 'Overall flaky rate',
      value: formatPercent(report.flakyRate),
      helper: `${report.totalReruns.toLocaleString()} runs needed a re-run`,
      color: 'warning.main',
    },
    {
      label: 'Flaky workflows',
      value: flakyWorkflows.toLocaleString(),
      helper: `of ${report.workflows.length.toLocaleString()} workflows`,
    },
    {
      label: 'Recovered runs',
      value: totalRecovered.toLocaleString(),
      helper: 'failed, then passed on re-run',
      color: 'success.main',
    },
  ];

  if (report.source !== 'branch') {
    stats.push({
      label: 'External PR runs',
      value: report.externalRuns.toLocaleString(),
      helper: 'triggered from forks',
    });
  }

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
      {stats.map((stat) => (
        <Card key={stat.label} variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              {stat.label}
            </Typography>
            <Typography
              variant="h4"
              component="p"
              sx={{ color: stat.color ?? 'text.primary', fontWeight: 600 }}
            >
              {stat.value}
            </Typography>
            {stat.helper && (
              <Typography variant="caption" color="text.secondary">
                {stat.helper}
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
