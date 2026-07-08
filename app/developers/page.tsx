import type { Metadata } from 'next';
import { Box, Container, Stack, Typography } from '@mui/material';

import DevelopersExplorer from './_components/DevelopersExplorer';
import { OWNER, REPO, getDeveloperReport } from './developers';

export const metadata: Metadata = {
  title: 'Developers — Pelican',
  description:
    'Per-developer productivity breakdown for PelicanPlatform/pelican: commits, pull requests, issues, and activity over time.',
};

export default async function DevelopersPage() {
  const now = Date.now();
  const report = await getDeveloperReport();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack spacing={4}>
          <Box sx={{ maxWidth: 820 }}>
            <Typography
              variant="overline"
              sx={{ color: 'primary.main', fontWeight: 600, letterSpacing: 1 }}
            >
              {OWNER} / {REPO}
            </Typography>
            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
              Developers
            </Typography>
            <Typography variant="h6" component="p" color="text.secondary">
              Every contributor&apos;s commits, pull requests, issues, and a year
              of activity at a glance. Switch the time range, then pick a developer
              to see their full breakdown.
            </Typography>
          </Box>

          {report.developers.length > 0 ? (
            <DevelopersExplorer report={report} now={now} />
          ) : (
            <Typography color="text.secondary">No contributors found.</Typography>
          )}

          {report.notes.length > 0 && (
            <Box>
              {report.notes.map((note) => (
                <Typography key={note} variant="caption" color="text.secondary" display="block">
                  • {note}
                </Typography>
              ))}
            </Box>
          )}

          <Typography variant="caption" color="text.secondary">
            Commit counts and line churn come from GitHub&apos;s per-author
            statistics (weekly granularity); pull-request and issue metrics are
            aggregated from the {OWNER}/{REPO} issues at build time. Bot accounts
            are excluded.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
