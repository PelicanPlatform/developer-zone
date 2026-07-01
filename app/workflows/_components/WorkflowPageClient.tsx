'use client';

import { useSearchParams } from 'next/navigation';
import { Alert, Link } from '@mui/material';

import WorkflowTimelineView from './WorkflowTimelineView';

interface WorkflowPageClientProps {
  owner: string;
  repo: string;
}

export default function WorkflowPageClient({ owner, repo }: WorkflowPageClientProps) {
  const params = useSearchParams();
  const idRaw = params.get('id');
  const name = params.get('name') ?? '';
  const workflowId = idRaw ? Number(idRaw) : NaN;

  if (!idRaw || Number.isNaN(workflowId)) {
    return (
      <Alert severity="warning">
        No workflow selected.{' '}
        <Link href="/flakiness">Pick one from the CI Flakiness dashboard.</Link>
      </Alert>
    );
  }

  return (
    <WorkflowTimelineView
      owner={owner}
      repo={repo}
      workflowId={workflowId}
      workflowName={name}
    />
  );
}
