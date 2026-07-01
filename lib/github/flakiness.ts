import { GITHUB_API, PER_PAGE, toApiError } from './client';
import type {
  FlakinessReport,
  RunSource,
  WorkflowFlakiness,
  WorkflowRun,
} from './types';

export interface FetchFlakinessParams {
  owner: string;
  repo: string;
  /** Which runs to include. Defaults to `all`. */
  source?: RunSource;
  /** Branch to analyze when `source` is `branch`. Defaults to `main`. */
  branch?: string;
  /** Maximum number of recent completed runs to analyze. Defaults to 200. */
  runCount?: number;
}

interface RunsResponse {
  total_count: number;
  workflow_runs: WorkflowRun[];
}

/**
 * Is this run from a forked repository (i.e. an external PR)? Fork runs report
 * a `head_repository` that differs from the base `repository`. We compare
 * against the queried `owner/repo` so it works even when the API omits
 * `repository` on the run.
 */
export function isExternalRun(
  run: WorkflowRun,
  owner: string,
  repo: string,
): boolean {
  const base = `${owner}/${repo}`.toLowerCase();
  const head = run.head_repository?.full_name?.toLowerCase();
  return Boolean(head && head !== base);
}

/**
 * Fetch recent completed workflow runs from the GitHub Actions API and
 * aggregate them into a flakiness report.
 *
 * Flakiness is measured from `run_attempt`: a run with `run_attempt > 1` was
 * re-run, which is the strongest signal that a workflow is unreliable. A re-run
 * that ends green ("recovered") is a textbook flaky run — it failed, was
 * retried, and passed without any code change.
 */
export async function fetchFlakinessReport({
  owner,
  repo,
  source = 'all',
  branch = 'main',
  runCount = 200,
}: FetchFlakinessParams): Promise<FlakinessReport> {
  const pages = Math.max(1, Math.ceil(runCount / PER_PAGE));
  const collected: WorkflowRun[] = [];
  let totalRunsAvailable = 0;

  // `external_pr` keeps only fork runs, so the API's per-page yield is a subset.
  // Allow a few extra pages to gather a useful sample without unbounded calls.
  const maxPages = source === 'external_pr' ? pages + 3 : pages;

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${GITHUB_API}/repos/${owner}/${repo}/actions/runs`);
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));
    url.searchParams.set('status', 'completed');
    if (source === 'branch') url.searchParams.set('branch', branch);
    if (source === 'pull_request' || source === 'external_pr') {
      url.searchParams.set('event', 'pull_request');
    }

    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!res.ok) throw await toApiError(res);

    const data: RunsResponse = await res.json();
    totalRunsAvailable = data.total_count;

    const batch =
      source === 'external_pr'
        ? data.workflow_runs.filter((r) => isExternalRun(r, owner, repo))
        : data.workflow_runs;
    collected.push(...batch);

    // Stop once we have enough, or there are no more runs to page through.
    if (collected.length >= runCount) break;
    if (data.workflow_runs.length < PER_PAGE) break;
  }

  const sample = collected.slice(0, runCount);
  return buildReport(sample, { owner, repo, source, branch, totalRunsAvailable });
}

interface ReportContext {
  owner: string;
  repo: string;
  source: RunSource;
  branch: string;
  totalRunsAvailable: number;
}

function buildReport(
  runs: WorkflowRun[],
  { owner, repo, source, branch, totalRunsAvailable }: ReportContext,
): FlakinessReport {
  const byWorkflow = new Map<string, WorkflowRun[]>();
  for (const run of runs) {
    const list = byWorkflow.get(run.name) ?? [];
    list.push(run);
    byWorkflow.set(run.name, list);
  }

  let totalReruns = 0;
  let externalRuns = 0;
  const workflows: WorkflowFlakiness[] = [];

  for (const [name, list] of byWorkflow) {
    let passed = 0;
    let failed = 0;
    let other = 0;
    let reruns = 0;
    let recovered = 0;
    let external = 0;

    for (const run of list) {
      if (run.conclusion === 'success') passed++;
      else if (run.conclusion === 'failure') failed++;
      else other++;

      if (run.run_attempt > 1) {
        reruns++;
        if (run.conclusion === 'success') recovered++;
      }

      if (isExternalRun(run, owner, repo)) external++;
    }

    totalReruns += reruns;
    externalRuns += external;
    const total = list.length;
    const latest = [...list].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    )[0];

    workflows.push({
      name,
      workflowId: latest.workflow_id,
      latestRunUrl: latest.html_url,
      total,
      passed,
      failed,
      other,
      reruns,
      recovered,
      external,
      flakyRate: total ? reruns / total : 0,
      failureRate: total ? failed / total : 0,
      lastRunAt: latest.created_at,
    });
  }

  workflows.sort(
    (a, b) =>
      b.flakyRate - a.flakyRate ||
      b.reruns - a.reruns ||
      b.failureRate - a.failureRate ||
      b.total - a.total,
  );

  return {
    owner,
    repo,
    source,
    branch: source === 'branch' ? branch : undefined,
    runsAnalyzed: runs.length,
    totalReruns,
    externalRuns,
    flakyRate: runs.length ? totalReruns / runs.length : 0,
    workflows,
    totalRunsAvailable,
  };
}
