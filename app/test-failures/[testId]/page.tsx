import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Box, Container } from '@mui/material';

import TestDetail from '../_components/TestDetail';
import { OWNER, REPO, getTestFailureReport } from '../report';

export const dynamicParams = false;

export async function generateStaticParams() {
  const report = await getTestFailureReport();
  return report.rows.map((r) => ({ testId: r.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ testId: string }>;
}): Promise<Metadata> {
  const { testId } = await params;
  const report = await getTestFailureReport();
  const row = report.rows.find((r) => r.id === testId);
  return {
    title: row ? `${row.name} — Test Failures` : 'Test Failures',
    description: row
      ? `Failure history for ${row.classname} ${row.name}.`
      : undefined,
  };
}

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const report = await getTestFailureReport();
  const row = report.rows.find((r) => r.id === testId);
  if (!row) notFound();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <TestDetail row={row} owner={OWNER} repo={REPO} />
      </Container>
    </Box>
  );
}
