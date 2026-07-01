import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material';

import type { WorkflowRunDetail } from '@/lib/github';

import AttemptNodes from './AttemptNodes';
import { formatDateTime, shortSha } from './format';

interface CommitListProps {
  runs: WorkflowRunDetail[];
}

interface CommitGroup {
  key: string;
  sha: string;
  message: string | null;
  timestamp: string;
  branch: string | null;
  author: string | null;
  runs: WorkflowRunDetail[];
}

/** Group runs by their head commit, preserving the incoming (commit-time) order. */
function groupByCommit(runs: WorkflowRunDetail[]): CommitGroup[] {
  const groups: CommitGroup[] = [];
  const index = new Map<string, CommitGroup>();

  for (const run of runs) {
    const sha = run.commit?.sha ?? run.headSha;
    let group = index.get(sha);
    if (!group) {
      group = {
        key: sha,
        sha,
        message: run.commit?.message ?? null,
        timestamp: run.commit?.timestamp ?? run.createdAt,
        branch: run.headBranch,
        author: run.commit?.author ?? null,
        runs: [],
      };
      index.set(sha, group);
      groups.push(group);
    }
    group.runs.push(run);
  }

  return groups;
}

export default function CommitList({ runs }: CommitListProps) {
  const groups = groupByCommit(runs);

  return (
    <Stack spacing={2}>
      {groups.map((group) => (
        <Card key={group.key} variant="outlined">
          <CardContent>
            {/* Commit header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={shortSha(group.sha)}
                size="small"
                sx={{ fontFamily: 'monospace', fontWeight: 600 }}
              />
              {group.message && (
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500 }}
                  noWrap
                  title={group.message}
                >
                  {group.message}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              committed {formatDateTime(group.timestamp)}
              {group.branch ? ` · ${group.branch}` : ''}
              {group.author ? ` · ${group.author}` : ''}
            </Typography>

            <Divider sx={{ my: 2 }} />

            {/* Runs for this commit */}
            <Stack spacing={2}>
              {group.runs.map((run) => (
                <Box key={run.id}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Run #{run.runNumber}
                    </Typography>
                    <Chip label={run.event} size="small" variant="outlined" />
                    {run.attempts.length > 1 && (
                      <Chip
                        label={`${run.attempts.length} tries`}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    )}
                    {run.external && (
                      <Chip label="fork" size="small" color="secondary" variant="outlined" />
                    )}
                    <Link
                      href={run.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'inline-flex', alignItems: 'center' }}
                      aria-label={`Open run #${run.runNumber} on GitHub`}
                    >
                      <OpenInNewIcon fontSize="small" />
                    </Link>
                    <Typography variant="caption" color="text.secondary">
                      ran {formatDateTime(run.createdAt)}
                    </Typography>
                  </Box>
                  <AttemptNodes attempts={run.attempts} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
