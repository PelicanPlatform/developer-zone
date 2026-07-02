import type { MilestoneIssue } from '@/lib/github';

const DAY_MS = 86_400_000;

/** Per-assignee rollup for the milestone. */
export interface AssigneeStat {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  total: number;
  completed: number;
}

/** Per-label rollup for the milestone. */
export interface LabelStat {
  name: string;
  /** Hex color without the leading `#`. */
  color: string;
  count: number;
}

/** Aggregate breakdown of the issues attached to a milestone. */
export interface MilestoneStats {
  total: number;
  /** Closed and not marked "not planned". */
  completed: number;
  /** Still open. */
  inProgress: number;
  /** Closed as "not planned". */
  notPlanned: number;
  /** completed / total as a 0..100 percentage. */
  completionPercent: number;
  /** Median days from creation to completion across completed issues. */
  medianCycleDays: number | null;
  fastestCycleDays: number | null;
  slowestCycleDays: number | null;
  /** Assignees ranked by issue count (desc). */
  assignees: AssigneeStat[];
  /** Issues with no assignee. */
  unassigned: number;
  /** Labels ranked by frequency (desc). */
  labels: LabelStat[];
}

function isCompleted(issue: MilestoneIssue): boolean {
  return issue.state === 'closed' && issue.stateReason !== 'not_planned';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/** Compute the milestone breakdown. Pure — safe to run at build time. */
export function computeMilestoneStats(issues: MilestoneIssue[]): MilestoneStats {
  let completed = 0;
  let inProgress = 0;
  let notPlanned = 0;
  let unassigned = 0;

  const cycleDays: number[] = [];
  const assigneeMap = new Map<string, AssigneeStat>();
  const labelMap = new Map<string, LabelStat>();

  for (const issue of issues) {
    const done = isCompleted(issue);
    if (issue.state === 'open') inProgress += 1;
    else if (issue.stateReason === 'not_planned') notPlanned += 1;
    else completed += 1;

    if (done && issue.closedAt) {
      const days = Math.round(
        (new Date(issue.closedAt).getTime() - new Date(issue.createdAt).getTime()) /
          DAY_MS,
      );
      cycleDays.push(Math.max(0, days));
    }

    const assignees = issue.assignees ?? [];
    if (assignees.length === 0) unassigned += 1;
    for (const assignee of assignees) {
      const existing = assigneeMap.get(assignee.login);
      if (existing) {
        existing.total += 1;
        if (done) existing.completed += 1;
      } else {
        assigneeMap.set(assignee.login, {
          login: assignee.login,
          avatarUrl: assignee.avatarUrl,
          htmlUrl: assignee.htmlUrl,
          total: 1,
          completed: done ? 1 : 0,
        });
      }
    }

    for (const label of issue.labels ?? []) {
      const existing = labelMap.get(label.name);
      if (existing) existing.count += 1;
      else labelMap.set(label.name, { name: label.name, color: label.color, count: 1 });
    }
  }

  const total = issues.length;

  return {
    total,
    completed,
    inProgress,
    notPlanned,
    completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    medianCycleDays: median(cycleDays),
    fastestCycleDays: cycleDays.length ? Math.min(...cycleDays) : null,
    slowestCycleDays: cycleDays.length ? Math.max(...cycleDays) : null,
    assignees: [...assigneeMap.values()].sort((a, b) => b.total - a.total),
    unassigned,
    labels: [...labelMap.values()].sort((a, b) => b.count - a.count),
  };
}

/** Pick black or white text for readable contrast against a hex background. */
export function readableTextColor(hex: string): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '#000';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  // Perceived luminance (sRGB weights); threshold ~0.6 keeps mid tones dark.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000' : '#fff';
}
