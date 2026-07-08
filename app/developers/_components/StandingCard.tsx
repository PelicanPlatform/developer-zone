import { Box, Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material';
import { TrendingUp } from '@mui/icons-material';

import type { DeveloperStats } from '@/lib/github';

import { formatCount } from './format';

interface StandingCardProps {
  dev: DeveloperStats;
  /** Median commit count across contributors — a team baseline. */
  medianCommits: number;
}

const MILESTONES = [50, 100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000];

/** The next round-number commit milestone above `commits`. */
function nextMilestone(commits: number): number {
  return MILESTONES.find((x) => x > commits) ?? Math.ceil((commits + 1) / 50_000) * 50_000;
}

function Row({ children }: { children: React.ReactNode }) {
  return <Box sx={{ mt: 2 }}>{children}</Box>;
}

/**
 * The "your contribution, and what's next" card — frames a developer's output
 * against the whole repository and a reachable goal, without any competitive
 * ranking against individual peers.
 */
export default function StandingCard({ dev, medianCommits }: StandingCardProps) {
  const milestone = nextMilestone(dev.commits);
  const toGo = Math.max(0, milestone - dev.commits);
  const vsMedian = medianCommits > 0 ? dev.commits / medianCommits : null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TrendingUp fontSize="small" color="primary" />
          <Typography variant="h6" component="h2">
            Your contribution
          </Typography>
        </Box>

        {/* Share of all commits */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Share of all commits
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {(dev.commitShare * 100).toFixed(dev.commitShare < 0.1 ? 1 : 0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, dev.commitShare * 100)}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary">
            {formatCount(dev.commits)} commits to the repository
          </Typography>
        </Box>

        {/* Next milestone (the aspirational goal) */}
        <Row>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Next milestone: <strong>{formatCount(milestone)}</strong> commits
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {formatCount(toGo)} to go
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (dev.commits / milestone) * 100)}
            color="success"
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Row>

        {/* Team baseline */}
        {vsMedian != null && (
          <Row>
            <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
              <Typography variant="body2" color="text.secondary">
                Team median is {formatCount(medianCommits)} commits — you&apos;re at
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {vsMedian >= 1 ? `${vsMedian.toFixed(1)}×` : `${Math.round(vsMedian * 100)}%`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                of it.
              </Typography>
            </Stack>
          </Row>
        )}
      </CardContent>
    </Card>
  );
}
