import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Box, Container, Skeleton } from '@mui/material';

import WorkflowPageClient from './_components/WorkflowPageClient';

export const metadata: Metadata = {
  title: 'Workflow timeline — Pelican',
  description:
    'Per-workflow run history for PelicanPlatform/pelican, showing every attempt and commit on a timeline.',
};

const OWNER = 'PelicanPlatform';
const REPO = 'pelican';

export default function WorkflowPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Suspense fallback={<Skeleton variant="rounded" height={400} />}>
          <WorkflowPageClient owner={OWNER} repo={REPO} />
        </Suspense>
      </Container>
    </Box>
  );
}
