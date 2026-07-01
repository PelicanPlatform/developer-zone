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
