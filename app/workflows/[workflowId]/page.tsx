import type { Metadata } from 'next';
import { Box, Container } from '@mui/material';

import { fetchWorkflowTimeline, fetchWorkflows } from '@/lib/github';
import type { WorkflowTimeline } from '@/lib/github';

import WorkflowTimelineView from '../_components/WorkflowTimelineView';

const OWNER = 'PelicanPlatform';
const REPO = 'pelican';

// Recent runs baked per workflow; the view slices this down interactively.
const RUN_COUNT = 100;

// Static export: every workflow page is pre-rendered, nothing on demand.
export const dynamicParams = false;

export async function generateStaticParams() {
  const workflows = await fetchWorkflows(OWNER, REPO);
  return workflows.map((w) => ({ workflowId: String(w.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}): Promise<Metadata> {
  const { workflowId } = await params;
  return {
    title: `Workflow ${workflowId} — Pelican`,
    description:
      'Per-workflow run history showing every attempt and commit for PelicanPlatform/pelican.',
  };
}

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await params;
  const id = Number(workflowId);

  let timeline: WorkflowTimeline;
  try {
    timeline = await fetchWorkflowTimeline({
      owner: OWNER,
      repo: REPO,
      workflowId: id,
      runCount: RUN_COUNT,
    });
  } catch {
    // Never fail the whole build over one workflow (e.g. a dynamic/agent
    // workflow with no conventional runs) — render an empty timeline.
    timeline = {
      owner: OWNER,
      repo: REPO,
      workflowId: id,
      workflowName: `Workflow ${id}`,
      runsAnalyzed: 0,
      totalRunsAvailable: 0,
      runs: [],
    };
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <WorkflowTimelineView timeline={timeline} />
      </Container>
    </Box>
  );
}
