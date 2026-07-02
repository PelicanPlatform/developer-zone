import type { Metadata } from 'next';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  LinearProgress,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Flag } from '@mui/icons-material';

import type { Milestone } from '@/lib/github';

import { getMilestones } from './milestones';

export const metadata: Metadata = {
  title: 'Milestones — Pelican',
  description:
    'Delivery timelines for each PelicanPlatform/pelican milestone, one segment per issue.',
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function MilestonesPage() {
  const milestones = await getMilestones();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ maxWidth: 760, mb: 5 }}>
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontWeight: 600, letterSpacing: 1 }}
          >
            PelicanPlatform / pelican
          </Typography>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
            Milestones
          </Typography>
          <Typography variant="h6" component="p" color="text.secondary">
            Pick a milestone to see a zoomable timeline of every issue attached
            to it — each segment runs from the day the issue was created to the
            day it was completed.
          </Typography>
        </Box>

        {milestones.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                md: 'repeat(3, 1fr)',
              },
              gap: 3,
            }}
          >
            {milestones.map((m) => (
              <MilestoneCard key={m.number} milestone={m} />
            ))}
          </Box>
        ) : (
          <Typography color="text.secondary">No milestones found.</Typography>
        )}
      </Container>
    </Box>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const total = milestone.open_issues + milestone.closed_issues;
  const percent = total > 0 ? Math.round((milestone.closed_issues / total) * 100) : 0;
  const due = formatDate(milestone.due_on);
  const isOpen = milestone.state === 'open';

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '&:hover': { borderColor: 'primary.main', boxShadow: 3 },
      }}
    >
      <CardActionArea
        component={Link}
        href={`/milestones/${milestone.number}`}
        sx={{ height: '100%' }}
      >
        <CardContent sx={{ height: '100%' }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Flag sx={{ color: isOpen ? 'primary.main' : 'text.disabled' }} />
              <Chip
                label={isOpen ? 'Open' : 'Closed'}
                size="small"
                color={isOpen ? 'primary' : 'default'}
                variant={isOpen ? 'filled' : 'outlined'}
              />
            </Box>
            <Typography variant="h6" component="h2">
              {milestone.title}
            </Typography>
            {due && (
              <Typography variant="body2" color="text.secondary">
                Due {due}
              </Typography>
            )}
            <Box sx={{ mt: 'auto' }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {milestone.closed_issues} / {total} closed
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {percent}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={percent}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
