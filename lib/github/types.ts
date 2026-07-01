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

/** A single workflow run as returned by the GitHub Actions REST API. */
export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string | null;
  head_sha: string;
  event: string;
  status: string | null;
  conclusion: RunConclusion;
  run_attempt: number;
  workflow_id: number;
  html_url: string;
  created_at: string;
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
