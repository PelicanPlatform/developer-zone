'use client';

import { useState } from 'react';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';

import type { WorkflowTimeline } from '@/lib/github';

import CommitList from './CommitList';
import { LEGEND } from './conclusion';

interface WorkflowTimelineViewProps {
  timeline: WorkflowTimeline;
}

const RUN_COUNT_OPTIONS = [25, 50, 100];

export default function WorkflowTimelineView({
  timeline,
}: WorkflowTimelineViewProps) {
  const [runCount, setRunCount] = useState(50);

  const runs = timeline.runs.slice(0, runCount);
  const retriedCount = runs.filter((r) => r.attempts.length > 1).length;

  return (
    <Stack spacing={3}>
      <Box>
        <Link href="/flakiness" variant="body2">
          ← Back to CI Flakiness
        </Link>
        <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
          {timeline.workflowName}
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
        <FormControl size="small" sx={{ width: 160 }}>
          <InputLabel id="run-count-label">Runs to show</InputLabel>
          <Select
            labelId="run-count-label"
            label="Runs to show"
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
      </Stack>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={`${runs.length} runs shown`} size="small" />
        <Chip
          label={`${retriedCount} retried`}
          size="small"
          color={retriedCount > 0 ? 'warning' : 'default'}
        />
        <Chip
          label={`${timeline.totalRunsAvailable.toLocaleString()} total on GitHub`}
          size="small"
          variant="outlined"
        />
      </Box>

      {runs.length > 0 ? (
        <CommitList runs={runs} />
      ) : (
        <Typography color="text.secondary">No runs found for this workflow.</Typography>
      )}
    </Stack>
  );
}
