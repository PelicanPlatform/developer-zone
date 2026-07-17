'use client';

import { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';

import type { FlakinessReport, RunSource } from '@/lib/github';

import SummaryCards from './SummaryCards';
import WorkflowFlakinessTable from './WorkflowFlakinessTable';

interface FlakinessDashboardProps {
  reports: Record<RunSource, FlakinessReport>;
  /** Number of runs sampled per source when the reports were built. */
  runCount: number;
}

const SOURCE_OPTIONS: { value: RunSource; label: string }[] = [
  { value: 'all', label: 'All runs' },
  { value: 'branch', label: 'Default branch' },
  { value: 'pull_request', label: 'Pull requests' },
  { value: 'external_pr', label: 'External PRs (forks)' },
];

export default function FlakinessDashboard({
  reports,
  runCount,
}: FlakinessDashboardProps) {
  const [source, setSource] = useState<RunSource>('all');
  const report = reports[source];
  const owner = report.owner;
  const repo = report.repo;

  return (
    <Stack spacing={3}>
      <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 } }}>
        <InputLabel id="source-label">Source</InputLabel>
        <Select
          labelId="source-label"
          label="Source"
          value={source}
          onChange={(e) => setSource(e.target.value as RunSource)}
        >
          {SOURCE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <SummaryCards report={report} />

      <Box>
        <Typography variant="h6" component="h2" gutterBottom>
          Per-workflow breakdown
        </Typography>
        <WorkflowFlakinessTable
          workflows={report.workflows}
          showExternal={source !== 'branch'}
        />
      </Box>

      <Typography variant="caption" color="text.secondary">
        Collected at build time from the{' '}
        <Link
          href={`https://github.com/${owner}/${repo}/actions`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {owner}/{repo}
        </Link>{' '}
        GitHub Actions API (up to {runCount.toLocaleString()} runs per source).
        Flaky rate is derived from re-run attempts (run_attempt &gt; 1) on
        completed runs; runtimes cover completed runs only; external PR runs
        come from forked repositories.
      </Typography>
    </Stack>
  );
}
