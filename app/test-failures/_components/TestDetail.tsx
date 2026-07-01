import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Typography,
} from '@mui/material';

import type { FailingRun, TestFailureRow } from '@/lib/github';

import { CLASS_META, classify } from './classify';

interface TestDetailProps {
  row: TestFailureRow;
  owner: string;
  repo: string;
}

interface CommitGroup {
  sha: string;
  branch: string | null;
  createdAt: string;
  message?: string;
  runs: FailingRun[];
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Trim GitHub's verbose workflow names to the distinguishing part (OS). */
function shortLabel(label: string): string {
  const m = label.match(/\(([^)]+)\)/);
  return m ? m[1] : label;
}

function groupByCommit(failures: FailingRun[]): CommitGroup[] {
  const map = new Map<string, CommitGroup>();
  for (const f of failures) {
    let g = map.get(f.sha);
    if (!g) {
      g = { sha: f.sha, branch: f.branch, createdAt: f.createdAt, message: f.message, runs: [] };
      map.set(f.sha, g);
    }
    g.runs.push(f);
    if (f.createdAt > g.createdAt) g.createdAt = f.createdAt;
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default function TestDetail({ row, owner, repo }: TestDetailProps) {
  const commits = groupByCommit(row.failures);
  const meta = CLASS_META[classify(row)];

  // Branch analysis — the key question: are all failures on one branch?
  const branchCounts = new Map<string, number>();
  for (const f of row.failures) {
    const b = f.branch ?? '(unknown)';
    branchCounts.set(b, (branchCounts.get(b) ?? 0) + 1);
  }
  const branches = [...branchCounts.entries()].sort((a, b) => b[1] - a[1]);
  const singleBranch = branches.length === 1;

  return (
    <Stack spacing={3}>
      <Box>
        <Link href="/test-failures" variant="body2">
          ← Back to Test Failures
        </Link>
        <Typography
          variant="h5"
          component="h1"
          sx={{ mt: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}
        >
          {row.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
          {row.classname}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label={`Failed ${row.failed} of ${row.seen} runs (${(row.failureRate * 100).toFixed(1)}%)`}
          color={meta.color}
        />
        <Chip label={meta.label} variant="outlined" color={meta.color} />
        {row.byWorkflow
          .filter((w) => w.failed > 0)
          .map((w) => (
            <Chip
              key={w.workflowId}
              size="small"
              variant="outlined"
              label={`${shortLabel(w.label)}: ${w.failed}/${w.seen}`}
            />
          ))}
      </Box>

      {/* Branch analysis */}
      {row.failures.length > 0 && (
        <Alert severity={singleBranch ? 'warning' : 'info'}>
          <AlertTitle>
            {singleBranch
              ? 'All failures on a single branch'
              : `Failures span ${branches.length} branches`}
          </AlertTitle>
          {singleBranch ? (
            <>
              Every failure of this test happened on{' '}
              <code>{branches[0][0]}</code>. That points to a change on that
              branch rather than a general flake — likely worth checking with
              whoever owns it.
            </>
          ) : (
            <>
              This test has failed across multiple branches, which is more
              consistent with a genuinely flaky or environment-sensitive test
              than a single bad change.
            </>
          )}
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {branches.map(([branch, count]) => (
              <Chip
                key={branch}
                size="small"
                label={`${branch}: ${count}`}
                sx={{ fontFamily: 'monospace' }}
              />
            ))}
          </Box>
        </Alert>
      )}

      <Box>
        <Typography variant="h6" component="h2" gutterBottom>
          Commits that failed this test ({commits.length})
        </Typography>
        <Stack spacing={2}>
          {commits.map((c) => (
            <Card key={c.sha} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Link
                    href={`https://github.com/${owner}/${repo}/commit/${c.sha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                  >
                    {c.sha.slice(0, 7)}
                  </Link>
                  {c.branch && (
                    <Chip label={c.branch} size="small" sx={{ fontFamily: 'monospace' }} />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {fmt(c.createdAt)}
                  </Typography>
                </Box>
                {c.message && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {c.message}
                  </Typography>
                )}
                <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {c.runs.map((r) => (
                    <Link
                      key={r.url}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ textDecoration: 'none' }}
                    >
                      <Chip
                        size="small"
                        variant="outlined"
                        color="error"
                        icon={<OpenInNewIcon />}
                        clickable
                        label={`${shortLabel(r.workflowLabel)} · run #${r.runNumber}`}
                      />
                    </Link>
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
