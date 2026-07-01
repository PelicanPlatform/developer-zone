'use client';

import { useState } from 'react';
import useSWR from 'swr';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { fetchFlakinessReport, type RunSource } from '@/lib/github';

import SummaryCards from './SummaryCards';
import WorkflowFlakinessTable from './WorkflowFlakinessTable';

interface FlakinessDashboardProps {
  owner: string;
  repo: string;
  defaultBranch?: string;
}

const RUN_COUNT_OPTIONS = [100, 200, 300, 500];

const SOURCE_OPTIONS: { value: RunSource; label: string }[] = [
  { value: 'all', label: 'All runs' },
  { value: 'branch', label: 'Default branch' },
  { value: 'pull_request', label: 'Pull requests' },
  { value: 'external_pr', label: 'External PRs (forks)' },
];

export default function FlakinessDashboard({
  owner,
  repo,
  defaultBranch = 'main',
}: FlakinessDashboardProps) {
  const [source, setSource] = useState<RunSource>('all');
  const [branch, setBranch] = useState(defaultBranch);
  // `branchInput` is the live text field; `branch` is what we actually query.
  const [branchInput, setBranchInput] = useState(defaultBranch);
  const [runCount, setRunCount] = useState(200);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ['flakiness', owner, repo, source, branch, runCount],
    () => fetchFlakinessReport({ owner, repo, source, branch, runCount }),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const applyBranch = () => {
    const next = branchInput.trim();
    if (next && next !== branch) setBranch(next);
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'flex-end' } }}
      >
        <FormControl size="small" sx={{ width: { xs: '100%', sm: 200 } }}>
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
        <TextField
          label="Branch"
          size="small"
          value={branchInput}
          disabled={source !== 'branch'}
          onChange={(e) => setBranchInput(e.target.value)}
          onBlur={applyBranch}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyBranch();
          }}
          sx={{ width: { xs: '100%', sm: 200 } }}
          helperText={source !== 'branch' ? 'Used with “Default branch”' : ' '}
        />
        <FormControl size="small" sx={{ width: { xs: '100%', sm: 200 } }}>
          <InputLabel id="run-count-label">Runs to analyze</InputLabel>
          <Select
            labelId="run-count-label"
            label="Runs to analyze"
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
          startIcon={
            isValidating ? <CircularProgress size={16} /> : <RefreshIcon />
          }
          onClick={() => mutate()}
          disabled={isValidating}
        >
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load workflow runs.'}
        </Alert>
      )}

      {isLoading && !data ? (
        <LoadingState />
      ) : data ? (
        <>
          <SummaryCards report={data} />
          <Box>
            <Typography variant="h6" component="h2" gutterBottom>
              Workflows by flakiness
            </Typography>
            <WorkflowFlakinessTable
              workflows={data.workflows}
              showExternal={source !== 'branch'}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Data fetched live from the{' '}
            <Link
              href={`https://github.com/${owner}/${repo}/actions`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {owner}/{repo}
            </Link>{' '}
            GitHub Actions API. Flakiness is derived from re-run attempts
            (run_attempt &gt; 1) on completed runs. External PR runs come from
            forked repositories.
          </Typography>
        </>
      ) : null}
    </Stack>
  );
}

function LoadingState() {
  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={104} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={360} />
    </Stack>
  );
}
