import {
  Avatar,
  Box,
  Card,
  CardContent,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

import type { MilestoneIssue } from '@/lib/github';

import { computeMilestoneStats, readableTextColor } from './stats';
import type { AssigneeStat, LabelStat } from './stats';

interface MilestoneSummaryProps {
  issues: MilestoneIssue[];
}

// How many entries to show before collapsing the rest into a "+N more" note.
const MAX_ASSIGNEES = 8;
const MAX_LABELS = 14;

export default function MilestoneSummary({ issues }: MilestoneSummaryProps) {
  if (issues.length === 0) return null;

  const stats = computeMilestoneStats(issues);

  return (
    <Stack spacing={2}>
      {/* Headline metrics */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: 2,
        }}
      >
        <StatTile label="Issues" value={stats.total} />
        <StatTile
          label="Completed"
          value={`${stats.completionPercent}%`}
          hint={`${stats.completed} of ${stats.total}`}
        />
        <StatTile label="In progress" value={stats.inProgress} />
        <StatTile
          label="Median time to close"
          value={stats.medianCycleDays != null ? `${stats.medianCycleDays}d` : '—'}
          hint={
            stats.fastestCycleDays != null
              ? `${stats.fastestCycleDays}–${stats.slowestCycleDays}d range`
              : undefined
          }
        />
        <StatTile label="Contributors" value={stats.assignees.length} />
      </Box>

      {/* Progress bar */}
      <ProgressBar
        completed={stats.completed}
        inProgress={stats.inProgress}
        notPlanned={stats.notPlanned}
        total={stats.total}
      />

      {/* Assignees + labels */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}
      >
        <AssigneesCard assignees={stats.assignees} unassigned={stats.unassigned} />
        <LabelsCard labels={stats.labels} />
      </Box>
    </Stack>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="h5" component="div" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.disabled" display="block">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressBar({
  completed,
  inProgress,
  notPlanned,
  total,
}: {
  completed: number;
  inProgress: number;
  notPlanned: number;
  total: number;
}) {
  const segments = [
    { count: completed, color: 'success.main', label: 'Completed' },
    { count: inProgress, color: 'warning.main', label: 'In progress' },
    { count: notPlanned, color: 'text.disabled', label: 'Not planned' },
  ].filter((s) => s.count > 0);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          height: 12,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'action.hover',
        }}
      >
        {segments.map((s) => (
          <Box
            key={s.label}
            sx={{ width: `${(s.count / total) * 100}%`, bgcolor: s.color }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
        {segments.map((s) => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: s.color }} />
            <Typography variant="caption" color="text.secondary">
              {s.label} ({s.count})
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function AssigneesCard({
  assignees,
  unassigned,
}: {
  assignees: AssigneeStat[];
  unassigned: number;
}) {
  const shown = assignees.slice(0, MAX_ASSIGNEES);
  const hidden = assignees.length - shown.length;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          Assignees
        </Typography>
        {assignees.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No issues are assigned.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {shown.map((a) => (
              <Box key={a.login} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar src={a.avatarUrl} alt={a.login} sx={{ width: 24, height: 24 }} />
                <Link
                  href={a.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                  sx={{ flexShrink: 0 }}
                >
                  {a.login}
                </Link>
                <Box
                  sx={{
                    flexGrow: 1,
                    height: 6,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    overflow: 'hidden',
                    mx: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: `${(a.completed / a.total) * 100}%`,
                      height: '100%',
                      bgcolor: 'success.main',
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {a.completed}/{a.total}
                </Typography>
              </Box>
            ))}
            {hidden > 0 && (
              <Typography variant="caption" color="text.disabled">
                +{hidden} more
              </Typography>
            )}
            {unassigned > 0 && (
              <Typography variant="caption" color="text.secondary">
                {unassigned} unassigned
              </Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function LabelsCard({ labels }: { labels: LabelStat[] }) {
  const shown = labels.slice(0, MAX_LABELS);
  const hidden = labels.length - shown.length;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          Labels
        </Typography>
        {labels.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No labels applied.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {shown.map((label) => (
              <Tooltip key={label.name} title={`${label.count} issue${label.count === 1 ? '' : 's'}`}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: `#${label.color}`,
                    color: readableTextColor(label.color),
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {label.name}
                  <Box component="span" sx={{ opacity: 0.75 }}>
                    {label.count}
                  </Box>
                </Box>
              </Tooltip>
            ))}
            {hidden > 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center' }}>
                +{hidden} more
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
