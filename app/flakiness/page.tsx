import type { Metadata } from 'next';
import { Box, Container, Typography } from '@mui/material';

import FlakinessDashboard from './_components/FlakinessDashboard';

export const metadata: Metadata = {
  title: 'CI Flakiness — Pelican',
  description:
    'Visualizes flaky GitHub Actions workflows in the PelicanPlatform/pelican repository, ranked by how often runs need a re-run.',
};

const OWNER = 'PelicanPlatform';
const REPO = 'pelican';

export default function FlakinessPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          CI Flakiness
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 760 }}>
          Workflows in{' '}
          <strong>
            {OWNER}/{REPO}
          </strong>{' '}
          ranked by how often their runs need a re-run. A run that fails and then
          passes on retry — without any code change — is the clearest sign of a
          flaky test or pipeline. Higher flaky rates mean more developer time
          lost to retries.
        </Typography>
        <FlakinessDashboard owner={OWNER} repo={REPO} />
      </Container>
    </Box>
  );
}
