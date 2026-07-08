import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import {
  MilitaryTech,
  Bolt,
  Whatshot,
  LocalFireDepartment,
  MergeType,
  TaskAlt,
  Commit,
} from '@mui/icons-material';

import type { DeveloperStats } from '@/lib/github';

interface Badge {
  label: string;
  help: string;
  earned: boolean;
  icon: React.ReactNode;
  /** Progress toward earning it, 0..1 — used to surface the closest next goal. */
  progress: number;
}

/** Build the badge set for a developer, both earned and still-to-earn. */
function buildBadges(dev: DeveloperStats): Badge[] {
  return [
    {
      label: 'Century',
      help: '100+ commits.',
      earned: dev.commits >= 100,
      progress: dev.commits / 100,
      icon: <Commit fontSize="small" />,
    },
    {
      label: '1k Club',
      help: '1,000+ commits.',
      earned: dev.commits >= 1000,
      progress: dev.commits / 1000,
      icon: <MilitaryTech fontSize="small" />,
    },
    {
      label: 'On a Roll',
      help: 'Committed 4+ weeks in a row.',
      earned: dev.currentStreakWeeks >= 4,
      progress: dev.currentStreakWeeks / 4,
      icon: <Whatshot fontSize="small" />,
    },
    {
      label: 'Marathoner',
      help: 'Active in 52+ distinct weeks.',
      earned: dev.activeWeeks >= 52,
      progress: dev.activeWeeks / 52,
      icon: <LocalFireDepartment fontSize="small" />,
    },
    {
      label: 'Ship It ×10',
      help: '10+ pull requests merged.',
      earned: dev.prsMerged >= 10,
      progress: dev.prsMerged / 10,
      icon: <MergeType fontSize="small" />,
    },
    {
      label: 'Ship It ×50',
      help: '50+ pull requests merged.',
      earned: dev.prsMerged >= 50,
      progress: dev.prsMerged / 50,
      icon: <Bolt fontSize="small" />,
    },
    {
      label: 'Closer',
      help: '10+ issues resolved.',
      earned: dev.issuesCompleted >= 10,
      progress: dev.issuesCompleted / 10,
      icon: <TaskAlt fontSize="small" />,
    },
  ];
}

export default function Badges({ dev }: { dev: DeveloperStats }) {
  const badges = buildBadges(dev);
  const earned = badges.filter((b) => b.earned);
  // The two nearest unearned badges become "aspire for more" targets.
  const next = badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 2);

  return (
    <Box>
      <Stack direction="row" flexWrap="wrap" sx={{ gap: 1 }}>
        {earned.map((b) => (
          <Tooltip key={b.label} title={b.help} arrow>
            <Chip
              icon={b.icon as React.ReactElement}
              label={b.label}
              size="small"
              color="primary"
              sx={{ fontWeight: 600 }}
            />
          </Tooltip>
        ))}
        {earned.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No badges yet — the goals below are within reach.
          </Typography>
        )}
      </Stack>

      {next.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Next up
          </Typography>
          <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, mt: 0.5 }}>
            {next.map((b) => (
              <Tooltip key={b.label} title={b.help} arrow>
                <Chip
                  icon={b.icon as React.ReactElement}
                  label={`${b.label} · ${Math.round(b.progress * 100)}%`}
                  size="small"
                  variant="outlined"
                  sx={{ color: 'text.secondary' }}
                />
              </Tooltip>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
