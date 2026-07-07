import { unzipSync, strFromU8 } from 'fflate';

import { GITHUB_API, PER_PAGE, githubFetch, githubFetchBinary } from './client';
import { fetchWorkflows } from './workflow-runs';
import type { IssueStateReason, MonthlyReport, MonthlyReportRow, WorkflowRun } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface CoverageConfig {
  /** Case-insensitive substrings matched against a workflow's name and path. */
  workflowHints?: string[];
  /** Case-insensitive substrings matched against an artifact's name. */
  artifactHints?: string[];
}

export interface FetchMonthlyReportParams {
  owner: string;
  repo: string;
  /** Number of trailing months to report (one row each). Default 12. */
  months?: number;
  /** Trailing window for the "delivered" metrics, in months. Default 3. */
  trailingMonths?: number;
  /** Staleness threshold for the "not touched" metric, in months. Default 3. */
  untouchedMonths?: number;
  /**
   * Build-time clock in epoch ms. Passed in by the caller so the report is a
   * pure function of its inputs (and so static builds don't smear across a
   * month boundary mid-build).
   */
  now: number;
  /** Label names identifying an "enhancement". Default ["enhancement"]. */
  enhancementLabels?: string[];
  /** Label names identifying "facilitation" work. Default ["facilitation"]. */
  facilitationLabels?: string[];
  /**
   * Guardrail: if more issues than this were alive during the window, the
   * per-issue timeline fetch is skipped and the untouched-% is reported as
   * unavailable rather than partially (and thus wrongly) computed.
   */
  maxTimelineIssues?: number;
  coverage?: CoverageConfig;
}

const DEFAULT_ENHANCEMENT_LABELS = ['enhancement'];
const DEFAULT_FACILITATION_LABELS = ['facilitation'];
const DEFAULT_COVERAGE_WORKFLOW_HINTS = ['coverage', 'cover'];
const DEFAULT_COVERAGE_ARTIFACT_HINTS = ['coverage', 'cover'];

// Bounded concurrency for the (potentially many) per-issue timeline requests.
const TIMELINE_CONCURRENCY = 8;
// Never page issues forever, even against a pathological repo.
const MAX_ISSUE_PAGES = 200;

// ---------------------------------------------------------------------------
// Raw GitHub shapes (only the fields we use)
// ---------------------------------------------------------------------------

interface RawIssue {
  number: number;
  state: 'open' | 'closed';
  state_reason: IssueStateReason;
  created_at: string;
  closed_at: string | null;
  labels: ({ name: string } | string)[];
  /** Present only when the "issue" is actually a pull request. */
  pull_request?: unknown;
}

interface TimelineEvent {
  event?: string;
  created_at?: string;
  /** `committed` events carry the date under the commit author/committer. */
  author?: { date?: string };
  committer?: { date?: string };
}

interface Artifact {
  id: number;
  name: string;
  expired: boolean;
  archive_download_url: string;
}

interface ArtifactsResponse {
  artifacts: Artifact[];
}

interface RunsResponse {
  total_count: number;
  workflow_runs: WorkflowRun[];
}

// ---------------------------------------------------------------------------
// A normalized issue with the fields the metrics need, parsed once.
// ---------------------------------------------------------------------------

interface Issue {
  number: number;
  createdMs: number;
  closedMs: number | null;
  /** Lower-cased label names. */
  labels: string[];
  /** Closed as completed (not "not planned"). */
  completed: boolean;
}

function normalizeIssue(raw: RawIssue): Issue {
  return {
    number: raw.number,
    createdMs: Date.parse(raw.created_at),
    closedMs: raw.closed_at ? Date.parse(raw.closed_at) : null,
    labels: raw.labels.map((l) => (typeof l === 'string' ? l : l.name).toLowerCase()),
    completed: raw.state === 'closed' && raw.state_reason !== 'not_planned',
  };
}

function matchesAnyLabel(names: string[], targets: string[]): boolean {
  return names.some((n) =>
    targets.some(
      (t) => n === t || n.endsWith(`/${t}`) || n.endsWith(`:${t}`) || n.endsWith(` ${t}`),
    ),
  );
}

// ---------------------------------------------------------------------------
// Month math (all UTC)
// ---------------------------------------------------------------------------

function ymFromMs(ms: number): [number, number] {
  const d = new Date(ms);
  return [d.getUTCFullYear(), d.getUTCMonth()];
}

/** Start-of-month ms shifted by `delta` months (handles year rollover). */
function addMonthsMs(ms: number, delta: number): number {
  const [y, m] = ymFromMs(ms);
  return Date.UTC(y, m + delta, 1);
}

function monthKey(ms: number): string {
  const [y, m] = ymFromMs(ms);
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthLabel(ms: number): string {
  const [y, m] = ymFromMs(ms);
  return `${MONTHS[m]} ${y}`;
}

/** The oldest → newest list of month starts ending with `now`'s month. */
function buildMonths(now: number, count: number): number[] {
  const [y, m] = ymFromMs(now);
  const current = Date.UTC(y, m, 1);
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addMonthsMs(current, -i));
  return out;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchAllIssues(owner: string, repo: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  for (let page = 1; page <= MAX_ISSUE_PAGES; page++) {
    const url = new URL(`${GITHUB_API}/repos/${owner}/${repo}/issues`);
    url.searchParams.set('state', 'all');
    url.searchParams.set('sort', 'created');
    url.searchParams.set('direction', 'asc');
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));

    const batch = await githubFetch<RawIssue[]>(url);
    for (const raw of batch) {
      if (!raw.pull_request) issues.push(normalizeIssue(raw));
    }
    if (batch.length < PER_PAGE) break;
  }
  return issues;
}

/** All activity timestamps (ms) for an issue, sorted ascending. */
async function fetchIssueActivity(
  owner: string,
  repo: string,
  issue: Issue,
): Promise<number[]> {
  const times: number[] = [issue.createdMs];
  for (let page = 1; ; page++) {
    const url = new URL(
      `${GITHUB_API}/repos/${owner}/${repo}/issues/${issue.number}/timeline`,
    );
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));

    const batch = await githubFetch<TimelineEvent[]>(url);
    for (const e of batch) {
      const iso = e.created_at ?? e.committer?.date ?? e.author?.date;
      const t = iso ? Date.parse(iso) : NaN;
      if (!Number.isNaN(t)) times.push(t);
    }
    if (batch.length < PER_PAGE) break;
  }
  times.sort((a, b) => a - b);
  return times;
}

/** Run `fn` over `items` with a bounded number of concurrent workers. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function listWorkflowRuns(
  owner: string,
  repo: string,
  workflowId: number,
  max: number,
): Promise<WorkflowRun[]> {
  const pages = Math.max(1, Math.ceil(max / PER_PAGE));
  const runs: WorkflowRun[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = new URL(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs`,
    );
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));
    const data = await githubFetch<RunsResponse>(url);
    runs.push(...data.workflow_runs);
    if (data.workflow_runs.length < PER_PAGE) break;
  }
  return runs.slice(0, max);
}

// ---------------------------------------------------------------------------
// Coverage (best-effort from a CI artifact)
// ---------------------------------------------------------------------------

/** Try several common coverage-report formats; return a 0..100 % or null. */
export function parseCoveragePercent(files: Record<string, Uint8Array>): number | null {
  for (const [name, bytes] of Object.entries(files)) {
    if (name.endsWith('/')) continue;
    const lower = name.toLowerCase();

    // Istanbul / nyc JSON summary.
    if (lower.endsWith('.json')) {
      try {
        const json = JSON.parse(strFromU8(bytes));
        const pct = json?.total?.lines?.pct ?? json?.total?.statements?.pct;
        if (typeof pct === 'number') return round1(pct);
      } catch {
        // not the JSON we expected — fall through to text strategies
      }
    }

    const text = safeText(bytes);
    if (!text) continue;

    // `go tool cover -func` footer: "total:\t(statements)\t83.4%".
    const goFunc = text.match(/total:\s*\(statements\)\s*([\d.]+)%/i);
    if (goFunc) return round1(Number(goFunc[1]));

    // A bare "total: 83.4%" line (custom footers).
    const bareTotal = text.match(/total:\s*([\d.]+)%/i);
    if (bareTotal) return round1(Number(bareTotal[1]));

    // Go coverage profile ("mode: set" + per-block statement counts).
    if (/^mode:\s/.test(text)) {
      const pct = parseGoProfile(text);
      if (pct != null) return pct;
    }

    // LCOV (lines found / lines hit).
    if (/^LF:/m.test(text) || /^LH:/m.test(text)) {
      const pct = parseLcov(text);
      if (pct != null) return pct;
    }
  }
  return null;
}

function parseGoProfile(text: string): number | null {
  let total = 0;
  let covered = 0;
  for (const line of text.split('\n')) {
    // path.go:12.34,56.78 3 1  →  <numStatements> <hitCount>
    const m = line.match(/\s(\d+)\s(\d+)\s*$/);
    if (!m) continue;
    const stmts = Number(m[1]);
    const hits = Number(m[2]);
    total += stmts;
    if (hits > 0) covered += stmts;
  }
  return total > 0 ? round1((covered / total) * 100) : null;
}

function parseLcov(text: string): number | null {
  let found = 0;
  let hit = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('LF:')) found += Number(line.slice(3));
    else if (line.startsWith('LH:')) hit += Number(line.slice(3));
  }
  return found > 0 ? round1((hit / found) * 100) : null;
}

function safeText(bytes: Uint8Array): string | null {
  // Skip obviously-binary blobs (a NUL byte in the first 1KB).
  const limit = Math.min(bytes.length, 1024);
  for (let i = 0; i < limit; i++) if (bytes[i] === 0) return null;
  try {
    return strFromU8(bytes);
  } catch {
    return null;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface CoverageResult {
  byMonth: Map<string, number>;
  note?: string;
}

async function fetchCoverageByMonth(
  owner: string,
  repo: string,
  monthStarts: number[],
  config: CoverageConfig | undefined,
): Promise<CoverageResult> {
  const byMonth = new Map<string, number>();
  const workflowHints = (config?.workflowHints ?? DEFAULT_COVERAGE_WORKFLOW_HINTS).map((h) =>
    h.toLowerCase(),
  );
  const artifactHints = (config?.artifactHints ?? DEFAULT_COVERAGE_ARTIFACT_HINTS).map((h) =>
    h.toLowerCase(),
  );

  try {
    const workflows = await fetchWorkflows(owner, repo);
    const workflow = workflows.find((w) => {
      const hay = `${w.name} ${w.path}`.toLowerCase();
      return workflowHints.some((h) => hay.includes(h));
    });
    if (!workflow) {
      return {
        byMonth,
        note: `Coverage: no workflow matched ${workflowHints.join(', ')}; coverage column is empty.`,
      };
    }

    const windowStart = monthStarts[0];
    const runs = await listWorkflowRuns(owner, repo, workflow.id, 300);

    // Runs come newest-first, so the first success seen in a month is the latest.
    const latestRunPerMonth = new Map<string, WorkflowRun>();
    for (const run of runs) {
      if (run.conclusion !== 'success') continue;
      const created = Date.parse(run.created_at);
      if (Number.isNaN(created) || created < windowStart) continue;
      const key = monthKey(created);
      if (!latestRunPerMonth.has(key)) latestRunPerMonth.set(key, run);
    }

    let expiredHit = false;
    await mapPool([...latestRunPerMonth.entries()], 4, async ([key, run]) => {
      const artifacts = await githubFetch<ArtifactsResponse>(
        `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${run.id}/artifacts?per_page=${PER_PAGE}`,
      );
      const match = artifacts.artifacts.find((a) =>
        artifactHints.some((h) => a.name.toLowerCase().includes(h)),
      );
      if (!match) return;
      if (match.expired) {
        expiredHit = true;
        return;
      }
      const zip = await githubFetchBinary(match.archive_download_url);
      const pct = parseCoveragePercent(unzipSync(zip));
      if (pct != null) byMonth.set(key, pct);
    });

    if (byMonth.size === 0) {
      return {
        byMonth,
        note: expiredHit
          ? `Coverage: matching artifacts have expired (GitHub retention); recent months only once fresh runs exist.`
          : `Coverage: workflow "${workflow.name}" had no parseable coverage artifact (looked for ${artifactHints.join(', ')}).`,
      };
    }
    if (expiredHit) {
      return {
        byMonth,
        note: `Coverage: older months are blank because their CI artifacts have expired (GitHub retention).`,
      };
    }
    return { byMonth };
  } catch (err) {
    return {
      byMonth,
      note: `Coverage unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Untouched-% (per-issue timeline reconstruction)
// ---------------------------------------------------------------------------

/** Largest value in the ascending array strictly less than `x`, or -Infinity. */
function lastBefore(sorted: number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? sorted[lo - 1] : -Infinity;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Build the monthly reporting dataset. Issue-derived metrics are exact and
 * historical; the untouched-% is reconstructed from each issue's event
 * timeline; coverage is best-effort from a CI artifact and degrades to blank
 * cells (with a note) when a source isn't available.
 */
export async function fetchMonthlyReport({
  owner,
  repo,
  months = 12,
  trailingMonths = 3,
  untouchedMonths = 3,
  now,
  enhancementLabels,
  facilitationLabels,
  maxTimelineIssues = 2500,
  coverage,
}: FetchMonthlyReportParams): Promise<MonthlyReport> {
  const enhTargets = (enhancementLabels ?? DEFAULT_ENHANCEMENT_LABELS).map((l) =>
    l.toLowerCase(),
  );
  const facTargets = (facilitationLabels ?? DEFAULT_FACILITATION_LABELS).map((l) =>
    l.toLowerCase(),
  );

  const monthStarts = buildMonths(now, months);
  const firstMonthEnd = addMonthsMs(monthStarts[0], 1);
  const lastMonthEnd = addMonthsMs(monthStarts[monthStarts.length - 1], 1);
  const notes: string[] = [];

  const issues = await fetchAllIssues(owner, repo);

  // Issues that were open at the end of at least one month in the window.
  const alive = issues.filter(
    (i) =>
      i.createdMs < lastMonthEnd &&
      (i.closedMs == null || i.closedMs >= firstMonthEnd),
  );

  // Reconstruct activity for the alive set, unless it's too large / errors out.
  let activity: Map<number, number[]> | null = new Map();
  if (alive.length > maxTimelineIssues) {
    activity = null;
    notes.push(
      `Untouched-% omitted: ${alive.length} issues were open during the window, above the ${maxTimelineIssues} timeline-fetch cap.`,
    );
  } else {
    try {
      const activities = await mapPool(alive, TIMELINE_CONCURRENCY, (issue) =>
        fetchIssueActivity(owner, repo, issue),
      );
      alive.forEach((issue, idx) => activity!.set(issue.number, activities[idx]));
    } catch (err) {
      activity = null;
      notes.push(
        `Untouched-% unavailable: issue timelines could not be fetched (${err instanceof Error ? err.message : String(err)}).`,
      );
    }
  }

  const coverageResult = await fetchCoverageByMonth(owner, repo, monthStarts, coverage);
  if (coverageResult.note) notes.push(coverageResult.note);

  const rows: MonthlyReportRow[] = monthStarts.map((start) => {
    const monthEnd = addMonthsMs(start, 1);
    const trailingStart = addMonthsMs(start, -(trailingMonths - 1));
    const untouchedThreshold = addMonthsMs(monthEnd, -untouchedMonths);

    let enhancements = 0;
    let facilitation = 0;
    for (const issue of issues) {
      if (issue.closedMs == null) continue;
      if (issue.closedMs < trailingStart || issue.closedMs >= monthEnd) continue;
      if (issue.completed && matchesAnyLabel(issue.labels, enhTargets)) enhancements++;
      if (matchesAnyLabel(issue.labels, facTargets)) facilitation++;
    }

    let openAtMonthEnd = 0;
    let untouchedCount: number | null = activity ? 0 : null;
    for (const issue of alive) {
      const openHere =
        issue.createdMs < monthEnd && (issue.closedMs == null || issue.closedMs >= monthEnd);
      if (!openHere) continue;
      openAtMonthEnd++;
      if (activity) {
        const times = activity.get(issue.number) ?? [issue.createdMs];
        const last = lastBefore(times, monthEnd);
        if (last < untouchedThreshold) untouchedCount!++;
      }
    }

    const untouchedPercent =
      activity && openAtMonthEnd > 0
        ? round1((untouchedCount! / openAtMonthEnd) * 100)
        : activity
          ? 0
          : null;

    return {
      month: new Date(start).toISOString().slice(0, 10),
      label: monthLabel(start),
      enhancementsTrailing3mo: enhancements,
      facilitationClosedTrailing3mo: facilitation,
      untouchedPercent,
      openAtMonthEnd,
      untouchedCount,
      coveragePercent: coverageResult.byMonth.get(monthKey(start)) ?? null,
    };
  });

  rows.reverse(); // newest month first for display

  return {
    owner,
    repo,
    months: rows,
    enhancementLabel: enhTargets[0],
    facilitationLabel: facTargets[0],
    notes,
  };
}
