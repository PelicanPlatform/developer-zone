import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Box, Chip, Container, Link, Stack, Typography } from '@mui/material';

import type { MilestoneTimeline } from '@/lib/github';

import { getMilestones, getMilestoneTimeline } from '../milestones';
import MilestoneSummary from '../_components/MilestoneSummary';
import MilestoneTimelineView from '../_components/MilestoneTimelineView';

// Static export: every milestone page is pre-rendered, nothing on demand.
export const dynamicParams = false;

export async function generateStaticParams() {
  const milestones = await getMilestones();
  return milestones.map((m) => ({ milestoneId: String(m.number) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ milestoneId: string }>;
}): Promise<Metadata> {
  const { milestoneId } = await params;
  return {
    title: `Milestone ${milestoneId} — Pelican`,
    description:
      'Zoomable timeline of every issue attached to this PelicanPlatform/pelican milestone.',
  };
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function MilestonePage({
  params,
}: {
  params: Promise<{ milestoneId: string }>;
}) {
  const { milestoneId } = await params;
  const number = Number(milestoneId);

  let timeline: MilestoneTimeline;
  try {
    timeline = await getMilestoneTimeline(number);
  } catch {
    notFound();
  }

  const { milestone, issues } = timeline;
  const due = formatDate(milestone.due_on);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack spacing={4}>
          <Box>
            <Link href="/milestones" variant="body2">
              ← All milestones
            </Link>
            <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
              {milestone.title}
            </Typography>
            {milestone.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
                {milestone.description}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 1.5 }}>
              <Chip
                label={milestone.state === 'open' ? 'Open milestone' : 'Closed milestone'}
                size="small"
                color={milestone.state === 'open' ? 'primary' : 'default'}
              />
              {due && <Chip label={`Due ${due}`} size="small" variant="outlined" />}
              <Link
                href={milestone.html_url}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                sx={{ ml: 'auto' }}
              >
                View on GitHub ↗
              </Link>
            </Box>
          </Box>

          <MilestoneSummary issues={issues} />

          <MilestoneTimelineView issues={issues} dueOn={milestone.due_on} />
        </Stack>
      </Container>
    </Box>
  );
}
