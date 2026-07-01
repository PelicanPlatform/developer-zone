'use client';

import { useState } from 'react';
import useSWR from 'swr';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';

import { fetchWorkflowTimeline } from '@/lib/github';

import CommitList from './CommitList';
import { LEGEND } from './conclusion';

interface WorkflowTimelineViewProps {
  owner: string;
  repo: string;
  workflowId: number;
  workflowName: string;
}

const RUN_COUNT_OPTIONS = [25, 50, 100];

export default function WorkflowTimelineView({
  owner,
  repo,
  workflowId,
  workflowName,
}: WorkflowTimelineViewProps) {
  const [runCount, setRunCount] = useState(50);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ['workflow-timeline', owner, repo, workflowId, runCount],
    () => fetchWorkflowTimeline({ owner, repo, workflowId, runCount }),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const retriedCount = data?.runs.filter((r) => r.attempts.length > 1).length ?? 0;

  return (
    <Stack spacing={3}>
      <Box>
        <Link href="/flakiness" variant="body2">
          ← Back to CI Flakiness
        </Link>
        <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
          {data?.workflowName ?? workflowName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          One card per commit, newest first. Each run shows one node per
          attempt — color indicates the outcome of that try.
        </Typography>
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {LEGEND.map((item) => (
            <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: item.color }}
              />
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ width: 160 }}>
            <InputLabel id="run-count-label">Runs to load</InputLabel>
            <Select
              labelId="run-count-label"
              label="Runs to load"
              value={runCount}
              onChange={(e) => setRunCount(Number(e.target.value))}
            >
              {RUN_COUNT_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>
                  Last {n} runs
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={isValidating ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => mutate()}
            disabled={isValidating}
          >
            Refresh
          </Button>
        </Box>
      </Stack>

      {error && (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load workflow runs.'}
        </Alert>
      )}

      {isLoading && !data ? (
        <Stack spacing={2}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={72} />
          ))}
        </Stack>
      ) : data ? (
        <>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`${data.runsAnalyzed} runs loaded`} size="small" />
            <Chip
              label={`${retriedCount} retried`}
              size="small"
              color={retriedCount > 0 ? 'warning' : 'default'}
            />
            <Chip
              label={`${data.totalRunsAvailable.toLocaleString()} total on GitHub`}
              size="small"
              variant="outlined"
            />
          </Box>
          {data.runs.length > 0 ? (
            <CommitList runs={data.runs} />
          ) : (
            <Typography color="text.secondary">No runs found for this workflow.</Typography>
          )}
        </>
      ) : null}
    </Stack>
  );
}
