import type { Milestone, MilestoneIssue, MilestoneTimeline } from '@/lib/github';

import { computeMilestoneStats } from './stats';

const DAY_MS = 86_400_000;

/**
 * Validated categorical palette (light surface), assigned in fixed slot order.
 * See the dataviz skill: worst adjacent CVD ΔE 24.2 on white, well clear of the
 * ≥12 target. The contrast WARN on a few slots is relieved by the legend and the
 * always-present comparison table.
 */
export const CATEGORICAL_COLORS = [
  '#2a78d6', // blue
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
  '#e87ba4', // magenta
] as const;

/** Neutral gray for the folded "Other" tail — never a categorical hue. */
export const OTHER_COLOR = '#898781';
export const OTHER_KEY = '__other__';

/** Diverging poles for the schedule-variance chart (blue ↔ red, CVD-safe). */
export const EARLY_COLOR = '#2a78d6';
export const LATE_COLOR = '#d03b3b';

/** Sequential hue for single-series magnitude charts (cycle time). */
export const SEQUENTIAL_COLOR = '#2a78d6';

// How many distinct classes to show before folding the rest into "Other".
const TOP_LABELS = 7;
const TOP_CONTRIBUTORS = 7;

/** One color-carrying class in a stacked chart. */
export interface SeriesDef {
  /** Stable identity key (label name / assignee login, or OTHER_KEY). */
  key: string;
  label: string;
  color: string;
}

/** A milestone reduced to the metrics the comparison charts and table need. */
export interface MilestoneComparisonRow {
  number: number;
  title: string;
  state: 'open' | 'closed';
  htmlUrl: string;
  dueOn: string | null;
  /** milestone.closed_at, or the latest completed-issue date, or null if open. */
  effectiveEnd: string | null;
  /** Days late (+) / early (−) of effectiveEnd vs dueOn; null if not derivable. */
  daysLate: number | null;
  total: number;
  completed: number;
  inProgress: number;
  notPlanned: number;
  completionPercent: number;
  medianCycleDays: number | null;
  slowestCycleDays: number | null;
  contributors: number;
  /** Issues created after the due date — scope added past the deadline. */
  addedAfterDue: number;
  /** Label-occurrence counts keyed by SeriesDef.key (top labels + Other). */
  labelCounts: Record<string, number>;
  /** Assignment counts keyed by SeriesDef.key (top contributors + Other). */
  contributorCounts: Record<string, number>;
}

/** The full cross-milestone comparison, ready to render. */
export interface MilestoneComparison {
  /** Milestones oldest → newest, so each reads against the ones before it. */
  rows: MilestoneComparisonRow[];
  labelSeries: SeriesDef[];
  contributorSeries: SeriesDef[];
  milestonesCompared: number;
  /** Milestones that finished after their due date. */
  shippedLate: number;
  /** Milestones with a derivable schedule variance (a denominator for late/early). */
  withVariance: number;
  /** Median slip across the late milestones, in days. */
  medianDaysLateAmongLate: number | null;
  /** The single largest slip, for the KPI row. */
  worstSlip: { title: string; daysLate: number } | null;
}

function startOfUTCDay(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/** The chronological anchor used to order milestones: due date, else creation. */
function orderKey(m: Milestone): number {
  return startOfUTCDay(m.due_on ?? m.created_at);
}

/**
 * When a milestone actually wrapped up. Prefer GitHub's own `closed_at`; fall
 * back to the latest completed-issue date for a milestone that is effectively
 * done but not formally closed. Open milestones return null (still in flight).
 */
function effectiveEnd(milestone: Milestone, issues: MilestoneIssue[]): string | null {
  if (milestone.closed_at) return milestone.closed_at;
  if (milestone.state === 'open') return null;
  let latest: string | null = null;
  for (const issue of issues) {
    if (issue.state === 'closed' && issue.stateReason !== 'not_planned' && issue.closedAt) {
      if (!latest || issue.closedAt > latest) latest = issue.closedAt;
    }
  }
  return latest;
}

/**
 * Reduce every milestone-with-issues to the comparison model. Pure and
 * build-time safe — the "now"-relative bits (open milestones) are deliberately
 * left as null so nothing here depends on the wall clock.
 */
export function computeMilestoneComparison(
  timelines: MilestoneTimeline[],
): MilestoneComparison {
  const ordered = [...timelines].sort(
    (a, b) => orderKey(a.milestone) - orderKey(b.milestone),
  );

  // Global rankings decide which classes get a color slot vs. fold into "Other".
  const labelTotals = new Map<string, number>();
  const contributorTotals = new Map<string, number>();
  for (const { issues } of ordered) {
    const stats = computeMilestoneStats(issues);
    for (const label of stats.labels) {
      labelTotals.set(label.name, (labelTotals.get(label.name) ?? 0) + label.count);
    }
    for (const a of stats.assignees) {
      contributorTotals.set(a.login, (contributorTotals.get(a.login) ?? 0) + a.total);
    }
  }

  const topLabels = rankTop(labelTotals, TOP_LABELS);
  const topContributors = rankTop(contributorTotals, TOP_CONTRIBUTORS);

  const rows: MilestoneComparisonRow[] = ordered.map(({ milestone, issues }) => {
    const stats = computeMilestoneStats(issues);
    const end = effectiveEnd(milestone, issues);
    const dueOn = milestone.due_on;

    const daysLate =
      dueOn && end
        ? Math.round((startOfUTCDay(end) - startOfUTCDay(dueOn)) / DAY_MS)
        : null;

    const addedAfterDue = dueOn
      ? issues.filter((i) => startOfUTCDay(i.createdAt) > startOfUTCDay(dueOn)).length
      : 0;

    return {
      number: milestone.number,
      title: milestone.title,
      state: milestone.state,
      htmlUrl: milestone.html_url,
      dueOn,
      effectiveEnd: end,
      daysLate,
      total: stats.total,
      completed: stats.completed,
      inProgress: stats.inProgress,
      notPlanned: stats.notPlanned,
      completionPercent: stats.completionPercent,
      medianCycleDays: stats.medianCycleDays,
      slowestCycleDays: stats.slowestCycleDays,
      contributors: stats.assignees.length,
      addedAfterDue,
      labelCounts: bucketCounts(
        new Map(stats.labels.map((l) => [l.name, l.count])),
        topLabels,
      ),
      contributorCounts: bucketCounts(
        new Map(stats.assignees.map((a) => [a.login, a.total])),
        topContributors,
      ),
    };
  });

  const anyOther = (rows: MilestoneComparisonRow[], pick: (r: MilestoneComparisonRow) => Record<string, number>) =>
    rows.some((r) => (pick(r)[OTHER_KEY] ?? 0) > 0);

  const labelSeries = buildSeries(topLabels, anyOther(rows, (r) => r.labelCounts));
  const contributorSeries = buildSeries(
    topContributors,
    anyOther(rows, (r) => r.contributorCounts),
  );

  const lateDays = rows
    .map((r) => r.daysLate)
    .filter((d): d is number => d != null && d > 0);
  const withVariance = rows.filter((r) => r.daysLate != null).length;
  const worst = rows
    .filter((r) => r.daysLate != null)
    .reduce<MilestoneComparisonRow | null>(
      (acc, r) => (acc == null || (r.daysLate ?? 0) > (acc.daysLate ?? 0) ? r : acc),
      null,
    );

  return {
    rows,
    labelSeries,
    contributorSeries,
    milestonesCompared: rows.length,
    shippedLate: lateDays.length,
    withVariance,
    medianDaysLateAmongLate: median(lateDays),
    worstSlip:
      worst && worst.daysLate != null && worst.daysLate > 0
        ? { title: worst.title, daysLate: worst.daysLate }
        : null,
  };
}

/** Names ranked by total desc, kept to the top `n`. Ties broken by name. */
function rankTop(totals: Map<string, number>, n: number): string[] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([name]) => name);
}

/**
 * Reduce a milestone's per-class counts to just the top keys plus an "Other"
 * bucket holding everything else, so every row stacks over the same series.
 */
function bucketCounts(counts: Map<string, number>, top: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  let other = 0;
  const topSet = new Set(top);
  for (const [name, count] of counts) {
    if (topSet.has(name)) out[name] = count;
    else other += count;
  }
  if (other > 0) out[OTHER_KEY] = other;
  return out;
}

/** Turn ranked keys into colored series defs, appending "Other" if used. */
function buildSeries(top: string[], hasOther: boolean): SeriesDef[] {
  const series: SeriesDef[] = top.map((key, i) => ({
    key,
    label: key,
    color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length],
  }));
  if (hasOther) series.push({ key: OTHER_KEY, label: 'Other', color: OTHER_COLOR });
  return series;
}
