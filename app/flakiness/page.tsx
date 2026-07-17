import type { Metadata } from 'next';
import { Box, Container, Typography } from '@mui/material';

import { fetchFlakinessReport } from '@/lib/github';
import type { FlakinessReport, RunSource } from '@/lib/github';

import FlakinessDashboard from './_components/FlakinessDashboard';

export const metadata: Metadata = {
  title: 'Workflows — Pelican',
  description:
    'Health and runtime metrics for the GitHub Actions workflows in the PelicanPlatform/pelican repository — pass rates, average runtimes, and flakiness.',
};

const OWNER = 'PelicanPlatform';
const REPO = 'pelican';

// Number of recent runs sampled per source when the report is built.
const RUN_COUNT = 300;

const SOURCES: RunSource[] = ['all', 'branch', 'pull_request', 'external_pr'];

export default async function FlakinessPage() {
  const entries = await Promise.all(
    SOURCES.map(
      async (source) =>
        [
          source,
          await fetchFlakinessReport({
            owner: OWNER,
            repo: REPO,
            source,
            branch: 'main',
            runCount: RUN_COUNT,
          }),
        ] as const,
    ),
  );
  const reports = Object.fromEntries(entries) as Record<RunSource, FlakinessReport>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Workflows
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 760 }}>
          The GitHub Actions workflows in{' '}
          <strong>
            {OWNER}/{REPO}
          </strong>{' '}
          — how often their runs pass, how long they take, and how reliable they
          are. Workflows are ranked by flaky rate: a run that fails and then
          passes on retry, without any code change, is the clearest sign of an
          unreliable test or pipeline.
        </Typography>
        <FlakinessDashboard reports={reports} runCount={RUN_COUNT} />
      </Container>
    </Box>
  );
}
