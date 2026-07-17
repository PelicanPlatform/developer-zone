import { GITHUB_API, PER_PAGE, githubFetch } from './client';
import { runDurationMs } from './duration';
import { isExternalRun } from './flakiness';
import type {
  RunAttempt,
  WorkflowRun,
  WorkflowRunDetail,
  WorkflowSummary,
  WorkflowTimeline,
} from './types';

interface WorkflowsResponse {
  total_count: number;
  workflows: WorkflowSummary[];
}

/** List the repository's active workflow definitions. */
export async function fetchWorkflows(
  owner: string,
  repo: string,
): Promise<WorkflowSummary[]> {
  const data = await githubFetch<WorkflowsResponse>(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows?per_page=${PER_PAGE}`,
  );
  return data.workflows.filter((w) => w.state === 'active');
}

export interface FetchTimelineParams {
  owner: string;
  repo: string;
  workflowId: number;
  /** Maximum number of recent runs to load. Defaults to 50. */
  runCount?: number;
}

interface RunsResponse {
  total_count: number;
  workflow_runs: WorkflowRun[];
}

// Guardrail: never fan out more than this many attempt requests for one run.
const MAX_ATTEMPTS_PER_RUN = 20;

/**
 * Load recent runs for a single workflow and expand each into its individual
 * attempts ("tries"). GitHub's `run_started_at` on the run object is the latest
 * attempt's start, so only attempts `1..n-1` need a dedicated request — the
 * final attempt is synthesized from the run itself.
 */
export async function fetchWorkflowTimeline({
  owner,
  repo,
  workflowId,
  runCount = 50,
}: FetchTimelineParams): Promise<WorkflowTimeline> {
  const pages = Math.max(1, Math.ceil(runCount / PER_PAGE));
  const rawRuns: WorkflowRun[] = [];
  let totalRunsAvailable = 0;

  for (let page = 1; page <= pages; page++) {
    const url = new URL(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs`,
    );
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));

    const data = await githubFetch<RunsResponse>(url);
    totalRunsAvailable = data.total_count;
    rawRuns.push(...data.workflow_runs);
    if (data.workflow_runs.length < PER_PAGE) break;
  }

  const sample = rawRuns.slice(0, runCount);

  const runs = await Promise.all(
    sample.map((run) => expandRun(run, owner, repo)),
  );

  // Order by commit time so force-pushed / rebased commits land in true
  // chronological order, independent of when CI happened to run them.
  runs.sort((a, b) => runTime(b).localeCompare(runTime(a)));

  return {
    owner,
    repo,
    workflowId,
    workflowName: sample[0]?.name ?? `Workflow ${workflowId}`,
    runsAnalyzed: runs.length,
    totalRunsAvailable,
    runs,
  };
}

/** The timestamp a run is ordered by: its commit time, falling back to run creation. */
function runTime(run: WorkflowRunDetail): string {
  return run.commit?.timestamp ?? run.createdAt;
}

async function expandRun(
  run: WorkflowRun,
  owner: string,
  repo: string,
): Promise<WorkflowRunDetail> {
  const attempts = await fetchAttempts(run, owner, repo);

  return {
    id: run.id,
    runNumber: run.run_number,
    event: run.event,
    headBranch: run.head_branch,
    headSha: run.head_sha,
    commit: run.head_commit
      ? {
          sha: run.head_commit.id,
          message: run.head_commit.message.split('\n')[0],
          timestamp: run.head_commit.timestamp,
          author: run.head_commit.author?.name ?? null,
        }
      : null,
    conclusion: run.conclusion,
    status: run.status,
    createdAt: run.created_at,
    durationMs: runDurationMs(run.run_started_at, run.updated_at, run.status),
    htmlUrl: run.html_url,
    external: isExternalRun(run, owner, repo),
    attempts,
  };
}

async function fetchAttempts(
  run: WorkflowRun,
  owner: string,
  repo: string,
): Promise<RunAttempt[]> {
  const latest: RunAttempt = {
    attempt: run.run_attempt,
    conclusion: run.conclusion,
    status: run.status,
    startedAt: run.run_started_at,
    durationMs: runDurationMs(run.run_started_at, run.updated_at, run.status),
    htmlUrl:
      run.run_attempt > 1
        ? `${run.html_url}/attempts/${run.run_attempt}`
        : run.html_url,
  };

  if (run.run_attempt <= 1) return [latest];

  const lastEarlier = Math.min(run.run_attempt - 1, MAX_ATTEMPTS_PER_RUN);
  const earlier = await Promise.all(
    Array.from({ length: lastEarlier }, (_, i) =>
      fetchEarlierAttempt(run, i + 1, owner, repo),
    ),
  );

  return [...earlier, latest];
}

async function fetchEarlierAttempt(
  run: WorkflowRun,
  attempt: number,
  owner: string,
  repo: string,
): Promise<RunAttempt> {
  const htmlUrl = `${run.html_url}/attempts/${attempt}`;
  try {
    const data = await githubFetch<WorkflowRun>(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${run.id}/attempts/${attempt}`,
    );
    return {
      attempt,
      conclusion: data.conclusion,
      status: data.status,
      startedAt: data.run_started_at ?? data.created_at,
      durationMs: runDurationMs(
        data.run_started_at ?? data.created_at,
        data.updated_at,
        data.status,
      ),
      htmlUrl,
    };
  } catch {
    // Degrade gracefully (e.g. mid-run rate limiting) rather than failing the
    // whole timeline — render this attempt as "unknown".
    return {
      attempt,
      conclusion: null,
      status: 'unknown',
      startedAt: run.created_at,
      durationMs: null,
      htmlUrl,
    };
  }
}
