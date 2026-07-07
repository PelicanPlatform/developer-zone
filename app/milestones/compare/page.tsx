import type { Metadata } from 'next';
import { Box, Container, Link, Stack, Typography } from '@mui/material';

import { getAllMilestoneTimelines } from '../milestones';
import { computeMilestoneComparison } from '../_components/comparison';
import MilestoneComparisonView from '../_components/MilestoneComparisonView';

export const metadata: Metadata = {
  title: 'Compare milestones — Pelican',
  description:
    'Aggregate comparison across every PelicanPlatform/pelican milestone — schedule variance, cycle time, scope, issue types, and contributors, side by side.',
};

export default async function MilestoneComparePage() {
  const timelines = await getAllMilestoneTimelines();
  const comparison = computeMilestoneComparison(timelines);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack spacing={4}>
          <Box sx={{ maxWidth: 820 }}>
            <Link href="/milestones" variant="body2">
              ← All milestones
            </Link>
            <Typography
              variant="overline"
              sx={{ color: 'primary.main', fontWeight: 600, letterSpacing: 1, display: 'block', mt: 1 }}
            >
              PelicanPlatform / pelican
            </Typography>
            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
              Compare milestones
            </Typography>
            <Typography variant="h6" component="p" color="text.secondary">
              Each milestone lined up against the ones before it, oldest to newest
              left-to-right — cycle time, scope, issue mix, and who was working — to
              see what moved with a late release.
            </Typography>
          </Box>

          {comparison.rows.length < 2 ? (
            <Typography color="text.secondary">
              At least two milestones are needed to compare. Add more milestones in
              GitHub and rebuild.
            </Typography>
          ) : (
            <MilestoneComparisonView comparison={comparison} />
          )}
        </Stack>
      </Container>
    </Box>
  );
}
