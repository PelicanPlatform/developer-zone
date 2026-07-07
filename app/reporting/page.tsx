import type { Metadata } from 'next';
import { Box, Container, Link, Stack, Typography } from '@mui/material';

import ReportingTable from './_components/ReportingTable';
import { MONTHS, OWNER, REPO, getMonthlyReport } from './report';

export const metadata: Metadata = {
  title: 'Reporting — Pelican',
  description:
    'Monthly engineering report for PelicanPlatform/pelican: enhancements delivered, stale open tickets, test coverage, and facilitation work closed.',
};

export default async function ReportingPage() {
  const report = await getMonthlyReport();

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
              Reporting
            </Typography>
            <Typography variant="h6" component="p" color="text.secondary">
              Monthly delivery and health metrics, one row per month over the last{' '}
              {MONTHS} months. Built from the {OWNER}/{REPO} issues and CI at build
              time.
            </Typography>
          </Box>

          <ReportingTable report={report} />

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
            “Trailing 3 months” counts the named month plus the two before it.
            Enhancements and facilitation are matched by issue label; the
            untouched-% is reconstructed from each issue’s{' '}
            <Link
              href={`https://github.com/${OWNER}/${REPO}/issues`}
              target="_blank"
              rel="noopener noreferrer"
            >
              event timeline
            </Link>
            . Coverage is read from the latest CI coverage artifact per month.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
