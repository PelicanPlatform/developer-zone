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
import { ArrowForward, Flag, Insights } from '@mui/icons-material';

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
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: 3,
            }}
          >
            {milestones.map((m) => (
              <Box
                key={m.number}
                sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}
              >
                <MilestoneCard milestone={m} />
              </Box>
            ))}

            {/* Second row: a full-width (12-column) button into the aggregate
                comparison view. */}
            {milestones.length > 1 && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <CompareCard />
              </Box>
            )}
          </Box>
        ) : (
          <Typography color="text.secondary">No milestones found.</Typography>
        )}
      </Container>
    </Box>
  );
}

function CompareCard() {
  return (
    <Card
      variant="outlined"
      sx={{
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '&:hover': { borderColor: 'primary.main', boxShadow: 3 },
      }}
    >
      <CardActionArea component={Link} href="/milestones/compare">
        <CardContent sx={{ py: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              flexDirection: { xs: 'column', sm: 'row' },
              textAlign: { xs: 'center', sm: 'left' },
            }}
          >
            <Insights sx={{ color: 'primary.main', fontSize: 44, flexShrink: 0 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" component="h2">
                Compare all milestones
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Schedule variance, cycle time, scope, issue types, and contributors
                across every milestone — to see what moved with a late release.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'primary.main',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <Typography variant="button">Open comparison</Typography>
              <ArrowForward fontSize="small" />
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
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
