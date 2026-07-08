import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Container,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Commit, CalendarMonth } from '@mui/icons-material';

import Badges from '../_components/Badges';
import DeveloperBreakdown from '../_components/DeveloperBreakdown';
import StandingCard from '../_components/StandingCard';
import StatCard from '../_components/StatCard';
import WeeklyActivityChart from '../_components/WeeklyActivityChart';
import { formatCount, formatMonthYear, formatNet, formatWeekAgo } from '../_components/format';
import { OWNER, REPO, getDeveloper, getDeveloperReport } from '../developers';

// Static export: every developer page is pre-rendered, nothing on demand.
export const dynamicParams = false;

export async function generateStaticParams() {
  const report = await getDeveloperReport();
  return report.developers.map((d) => ({ login: d.login }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ login: string }>;
}): Promise<Metadata> {
  const { login } = await params;
  const decoded = decodeURIComponent(login);
  return {
    title: `${decoded} — Developers — Pelican`,
    description: `Productivity breakdown for ${decoded} on ${OWNER}/${REPO}: commits, pull requests, issues, and activity over time.`,
  };
}

export default async function DeveloperPage({
  params,
}: {
  params: Promise<{ login: string }>;
}) {
  const { login } = await params;
  const now = Date.now();

  const [dev, report] = await Promise.all([
    getDeveloper(decodeURIComponent(login)),
    getDeveloperReport(),
  ]);
  if (!dev) notFound();

  const tenure =
    dev.firstActiveWeek && dev.lastActiveWeek
      ? `${formatMonthYear(dev.firstActiveWeek)} – ${formatMonthYear(dev.lastActiveWeek)}`
      : '—';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack spacing={4}>
          {/* Header */}
          <Box>
            <Link href="/developers" variant="body2">
              ← All developers
            </Link>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mt: 1.5, flexWrap: 'wrap' }}
            >
              <Avatar src={dev.avatarUrl} alt="" sx={{ width: 72, height: 72 }} />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                  {dev.login}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Contributing to {OWNER}/{REPO} · {tenure} · last active{' '}
                  {formatWeekAgo(dev.lastActiveWeek, now)}
                </Typography>
                <Link href={dev.htmlUrl} target="_blank" rel="noopener noreferrer" variant="body2">
                  View profile on GitHub ↗
                </Link>
              </Box>
            </Box>

            <Box sx={{ mt: 2.5 }}>
              <Badges dev={dev} />
            </Box>
          </Box>

          {/* All-time highlights */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            <StatCard
              label="Total commits"
              value={formatCount(dev.commits)}
              helper={`${Math.round(dev.commitShare * 100)}% of all commits`}
              color="primary.main"
              help="All-time commits attributed to this author by GitHub."
            />
            <StatCard
              label="Net lines"
              value={
                <Box component="span" sx={{ color: dev.netLines >= 0 ? 'success.main' : 'error.main' }}>
                  {formatNet(dev.netLines)}
                </Box>
              }
              helper={`+${formatCount(dev.additions)} / −${formatCount(dev.deletions)}`}
              help="Lines added minus lines deleted across all commits."
            />
            <StatCard
              label="Current streak"
              value={`${dev.currentStreakWeeks} wk`}
              helper="consecutive active weeks"
              help="Consecutive most-recent weeks with at least one commit."
            />
            <StatCard
              label="Best week"
              value={formatCount(dev.bestWeekCommits)}
              helper={`over ${formatCount(dev.activeWeeks)} active weeks`}
              help="Most commits in a single week — a personal best."
            />
          </Box>

          {/* Range-scoped breakdown (Week / Month / Year tabs) */}
          <DeveloperBreakdown dev={dev} />

          {/* Activity chart */}
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CalendarMonth fontSize="small" color="primary" />
                <Typography variant="h6" component="h2">
                  Commit activity — last 52 weeks
                </Typography>
              </Box>
              <WeeklyActivityChart weeks={dev.recentWeeks} />
            </CardContent>
          </Card>

          {/* Contribution + goals */}
          <StandingCard dev={dev} medianCommits={report.medianCommits} />

          <Typography variant="caption" color="text.secondary">
            <Commit sx={{ fontSize: 13, verticalAlign: 'text-bottom', mr: 0.5 }} />
            Commit and line metrics come from GitHub&apos;s per-author statistics
            (weekly granularity); pull-request and issue metrics are aggregated
            from {OWNER}/{REPO} at build time.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
