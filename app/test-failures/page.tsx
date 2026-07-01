import type { Metadata } from 'next';
import { Box, Container, Link, Typography } from '@mui/material';

import TestFailuresTable from './_components/TestFailuresTable';
import { OWNER, REPO, RUN_COUNT, getTestFailureReport } from './report';

export const metadata: Metadata = {
  title: 'Test Failures — Pelican',
  description:
    'Cross-run JUnit test-failure breakdown for the Pelican test workflows, surfacing flaky tests.',
};

export default async function TestFailuresPage() {
  const report = await getTestFailureReport();

  const coverage =
    report.coverageStart && report.coverageEnd
      ? ` Runs span ${new Date(report.coverageStart).toLocaleDateString()}–${new Date(report.coverageEnd).toLocaleDateString()}.`
      : '';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth={false} sx={{ py: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Test Failures
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 820 }}>
          Failed tests from the JUnit artifacts of the macOS, Windows, and Linux
          test workflows in{' '}
          <strong>
            {OWNER}/{REPO}
          </strong>{' '}
          (last {RUN_COUNT} runs each). A test that fails in some runs but passes
          in others is flagged <strong>flaky</strong>; one that fails every run
          is a genuine break.{coverage} Collected at build time.{' '}
          <Link
            href="https://github.com/PelicanPlatform/pelican/actions"
            target="_blank"
            rel="noopener noreferrer"
          >
            View workflows on GitHub
          </Link>
          .
        </Typography>
        <TestFailuresTable report={report} />
      </Container>
    </Box>
  );
}
