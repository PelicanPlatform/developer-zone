/** GitHub Actions domain types used by the flakiness visualizations. */

export type RunConclusion =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required'
  | 'neutral'
  | 'stale'
  | 'startup_failure'
  | null;

/** Minimal repository reference embedded in a workflow run. */
export interface RunRepositoryRef {
  full_name: string;
}

/** The head commit embedded in a workflow run. */
export interface RunHeadCommit {
  id: string;
  message: string;
  timestamp: string;
  author: { name?: string; email?: string } | null;
}

/** A single workflow run as returned by the GitHub Actions REST API. */
export interface WorkflowRun {
  id: number;
  name: string;
  run_number: number;
  head_branch: string | null;
  head_sha: string;
  event: string;
  status: string | null;
  conclusion: RunConclusion;
  run_attempt: number;
  workflow_id: number;
  html_url: string;
  created_at: string;
  /** Last update time — for a completed run, when it finished. */
  updated_at: string;
  /** Start time of the latest attempt (resets on re-run). */
  run_started_at: string;
  head_commit: RunHeadCommit | null;
  /** The base repository the run belongs to. */
  repository: RunRepositoryRef | null;
  /** The head repository. Differs from `repository` for runs from forks. */
  head_repository: RunRepositoryRef | null;
}

/**
 * Which runs to include in a report.
 * - `all`: every completed run (default branch pushes, PRs, forks, …)
 * - `branch`: completed runs on a single branch (e.g. `main`)
 * - `pull_request`: all `pull_request` runs (same-repo and fork PRs)
 * - `external_pr`: `pull_request` runs originating from forks only
 */
export type RunSource = 'all' | 'branch' | 'pull_request' | 'external_pr';

/** Flakiness statistics aggregated for a single workflow. */
export interface WorkflowFlakiness {
  name: string;
  workflowId: number;
  /** Link to the most recent run for this workflow. */
  latestRunUrl: string;
  total: number;
  passed: number;
  failed: number;
  /** cancelled / skipped / timed out / etc. */
  other: number;
  /** Runs that were retried (run_attempt > 1) — the core flakiness signal. */
  reruns: number;
  /** Retried runs that eventually passed (failed, then green on re-run). */
  recovered: number;
  /** Runs originating from a forked repository (external PRs). */
  external: number;
  /** reruns / total, in the range 0..1. */
  flakyRate: number;
  /** failed / total, in the range 0..1. */
  failureRate: number;
  /**
   * Average runtime in milliseconds of runs created in the trailing 7 days,
   * or null when the workflow had no runs in that window.
   */
  avgDurationMs: number | null;
  lastRunAt: string;
}

/** A commit associated with a workflow run's head. */
export interface CommitInfo {
  sha: string;
  /** First line of the commit message. */
  message: string;
  /** Commit timestamp — used to order the timeline (force-push safe). */
  timestamp: string;
  author: string | null;
}

/** A single attempt ("try") of a workflow run. */
export interface RunAttempt {
  attempt: number;
  conclusion: RunConclusion;
  status: string | null;
  /** When this attempt started running. */
  startedAt: string;
  /** Runtime of this attempt in milliseconds, or null while still running. */
  durationMs: number | null;
  /** Link to this specific attempt on GitHub. */
  htmlUrl: string;
}

/** A workflow run expanded with its per-attempt details. */
export interface WorkflowRunDetail {
  id: number;
  runNumber: number;
  event: string;
  headBranch: string | null;
  headSha: string;
  commit: CommitInfo | null;
  /** Conclusion of the latest attempt. */
  conclusion: RunConclusion;
  status: string | null;
  createdAt: string;
  /** Runtime of the latest attempt in milliseconds, or null while still running. */
  durationMs: number | null;
  htmlUrl: string;
  /** True when the run originates from a forked repository (external PR). */
  external: boolean;
  /** One entry per attempt, ordered 1..n. */
  attempts: RunAttempt[];
}

/** A workflow definition in the repository. */
export interface WorkflowSummary {
  id: number;
  name: string;
  path: string;
  state: string;
}

/** All recent runs for a single workflow, expanded with attempts. */
export interface WorkflowTimeline {
  owner: string;
  repo: string;
  workflowId: number;
  workflowName: string;
  runsAnalyzed: number;
  totalRunsAvailable: number;
  /** Runs sorted by commit time (newest first). */
  runs: WorkflowRunDetail[];
}

/** A milestone as returned by the GitHub REST API. */
export interface Milestone {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  /** Open issue count reported by GitHub for this milestone. */
  open_issues: number;
  /** Closed issue count reported by GitHub for this milestone. */
  closed_issues: number;
  created_at: string;
  updated_at: string;
  /** Target date, if one was set. */
  due_on: string | null;
  closed_at: string | null;
  html_url: string;
}

/** Why a closed issue was closed. */
export type IssueStateReason = 'completed' | 'not_planned' | 'reopened' | null;

/** A GitHub user assigned to an issue. */
export interface IssueAssignee {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

/** A label applied to an issue. */
export interface IssueLabel {
  name: string;
  /** Hex color without the leading `#`, as GitHub returns it. */
  color: string;
}

/** A single issue attached to a milestone, reduced to the timeline essentials. */
export interface MilestoneIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  /** Distinguishes a completed issue from one closed as "not planned". */
  stateReason: IssueStateReason;
  /** ISO timestamp the issue was created — the segment's start. */
  createdAt: string;
  /** ISO timestamp the issue was closed, or null if still open — the segment's end. */
  closedAt: string | null;
  assignees: IssueAssignee[];
  labels: IssueLabel[];
  htmlUrl: string;
}

/** A milestone expanded with all of its issues, for the timeline view. */
export interface MilestoneTimeline {
  owner: string;
  repo: string;
  milestone: Milestone;
  /** Issues attached to the milestone, sorted by creation time (oldest first). */
  issues: MilestoneIssue[];
}

/** One month's row in the monthly reporting table. */
export interface MonthlyReportRow {
  /** First day of the month in UTC, ISO (e.g. "2025-07-01"). Stable row key. */
  month: string;
  /** Display label, e.g. "Jul 2025". */
  label: string;
  /**
   * Enhancement issues completed within the trailing 3 calendar months ending
   * with this month (this month + the two before it).
   */
  enhancementsTrailing3mo: number;
  /**
   * Issues carrying the "facilitation" label closed within the trailing 3
   * calendar months ending with this month.
   */
  facilitationClosedTrailing3mo: number;
  /**
   * Percentage (0..100) of tickets open at month-end that had no timeline
   * activity in the 3 months before month-end. Null when it can't be derived
   * (e.g. issue timelines were unavailable at build time).
   */
  untouchedPercent: number | null;
  /** Count of tickets open at month-end — the untouched-% denominator. */
  openAtMonthEnd: number;
  /** Count of open tickets untouched for 3+ months — the untouched-% numerator. */
  untouchedCount: number | null;
  /** Code coverage percentage (0..100) for the month, or null if unavailable. */
  coveragePercent: number | null;
}

/** The full monthly reporting dataset, newest month first. */
export interface MonthlyReport {
  owner: string;
  repo: string;
  /** Rows ordered newest month first. */
  months: MonthlyReportRow[];
  /** The label used to identify "enhancement" issues, for the page caption. */
  enhancementLabel: string;
  /** The label used to identify "facilitation" issues, for the page caption. */
  facilitationLabel: string;
  /** Non-fatal notes (e.g. why coverage or untouched-% is missing). */
  notes: string[];
}

/** One week of a developer's commit activity (aligned to a Sunday, UTC). */
export interface DeveloperWeek {
  /** Week start (Sunday) as an ISO date, e.g. "2025-06-01". */
  weekStart: string;
  commits: number;
  additions: number;
  deletions: number;
}

/** The selectable trailing windows a developer's metrics can be viewed over. */
export type DeveloperTimeRange = 'week' | 'month' | 'year';

/** Productivity metrics scoped to a single trailing time window. */
export interface DeveloperRangeMetrics {
  /** Commits in the window (weekly-bucketed, from the stats endpoint). */
  commits: number;
  additions: number;
  deletions: number;
  /** additions − deletions in the window. */
  netLines: number;
  /** Distinct weeks in the window with at least one commit. */
  activeWeeks: number;
  prsOpened: number;
  prsMerged: number;
  /** merged / opened in the window, in 0..1, or null when none were opened. */
  prMergeRate: number | null;
  issuesOpened: number;
  /** Issues authored that closed as completed within the window. */
  issuesClosed: number;
}

/**
 * Productivity metrics for a single contributor, combined from the
 * commit-statistics endpoint and the repository's issues + pull requests.
 * All-time totals sit at the top level; trailing-window views live in `ranges`.
 */
export interface DeveloperStats {
  login: string;
  avatarUrl: string;
  htmlUrl: string;

  // --- Commits, all-time (from GET /stats/contributors) ---
  commits: number;
  additions: number;
  deletions: number;
  /** additions − deletions. */
  netLines: number;
  /** Distinct weeks (all history) with at least one commit. */
  activeWeeks: number;
  /** Consecutive most-recent weeks with ≥1 commit (0 if gone quiet). */
  currentStreakWeeks: number;
  /** Highest commit count in any single week — a personal best. */
  bestWeekCommits: number;
  /** ISO date of the first week with a commit, or null. */
  firstActiveWeek: string | null;
  /** ISO date of the most recent week with a commit, or null. */
  lastActiveWeek: string | null;
  /** Trailing 52-week commit series (oldest → newest) for charts/sparklines. */
  recentWeeks: DeveloperWeek[];

  // --- Pull requests, all-time (from the issues + PR fetch) ---
  prsOpened: number;
  prsMerged: number;
  /** merged / opened, in 0..1, or null when they opened none. */
  prMergeRate: number | null;
  /** Median days from open to merge across their merged PRs, or null. */
  medianDaysToMerge: number | null;

  // --- Issues, all-time (non-PR items) ---
  /** Issues they authored. */
  issuesOpened: number;
  /** Issues they authored that closed as completed. */
  issuesCompleted: number;
  /** Issues assigned to them. */
  issuesAssigned: number;
  /** Assigned issues that closed as completed — work they resolved. */
  issuesAssignedCompleted: number;

  /** Share of all commits, in 0..1 — a non-ordinal measure of contribution. */
  commitShare: number;

  /** The same metrics scoped to each trailing window. */
  ranges: Record<DeveloperTimeRange, DeveloperRangeMetrics>;
}

/** The full developer-productivity dataset, contributors sorted by commits. */
export interface DeveloperReport {
  owner: string;
  repo: string;
  /** Contributors ordered by commit count, descending. */
  developers: DeveloperStats[];
  totalCommits: number;
  totalPrsMerged: number;
  totalContributors: number;
  /** Median commit count across contributors — a team baseline. */
  medianCommits: number;
  /** Non-fatal notes (e.g. why a metric is unavailable). */
  notes: string[];
}

/** A full flakiness report across all workflows for a given source. */
export interface FlakinessReport {
  owner: string;
  repo: string;
  source: RunSource;
  /** The branch analyzed when `source` is `branch`; otherwise undefined. */
  branch?: string;
  runsAnalyzed: number;
  totalReruns: number;
  /** Number of analyzed runs that came from forks (external PRs). */
  externalRuns: number;
  /** totalReruns / runsAnalyzed, in the range 0..1. */
  flakyRate: number;
  workflows: WorkflowFlakiness[];
  /** total_count reported by GitHub for this source (full history, not just the sample). */
  totalRunsAvailable: number;
}
