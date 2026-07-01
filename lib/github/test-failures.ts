import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';

import { GITHUB_API, PER_PAGE, githubFetch, githubFetchBinary } from './client';
import type { WorkflowRun } from './types';

export interface FetchTestFailuresParams {
  owner: string;
  repo: string;
  /** Workflows to analyze (they should run the same test suite). */
  workflowIds: number[];
  /** Recent runs to inspect per workflow. Defaults to 50. */
  runCount?: number;
}

/** Per-workflow breakdown of failures for a single test. */
export interface TestWorkflowStat {
  workflowId: number;
  label: string;
  seen: number;
  failed: number;
}

/** A single run in which a test failed. */
export interface FailingRun {
  workflowId: number;
  workflowLabel: string;
  runNumber: number;
  url: string;
  sha: string;
  branch: string | null;
  event: string;
  createdAt: string;
  message?: string;
}

/** Aggregated failure record for one test across all analyzed runs. */
export interface TestFailureRow {
  /** URL-safe id encoding classname+name, used for the detail route. */
  id: string;
  classname: string;
  name: string;
  /** Runs in which the test ran (not skipped). */
  seen: number;
  /** Runs in which the test failed. */
  failed: number;
  /** failed / seen, 0..1. */
  failureRate: number;
  /** Failed in some but not all runs it ran in — the flaky signal. */
  flaky: boolean;
  byWorkflow: TestWorkflowStat[];
  /** Distinct short failure messages seen. */
  messages: string[];
  /** Every run in which this test failed, newest first. */
  failures: FailingRun[];
  lastFailureUrl?: string;
  lastFailureSha?: string;
  lastFailureAt?: string;
}

/** Encode a test's classname+name into a URL-safe id for its detail page. */
export function encodeTestId(classname: string, name: string): string {
  return Buffer.from(`${classname} ${name}`, 'utf8').toString('base64url');
}

export interface WorkflowRunStat {
  workflowId: number;
  label: string;
  runsAnalyzed: number;
  runsWithArtifact: number;
  runsParsed: number;
  runsFailedDownload: number;
}

export interface TestFailureReport {
  owner: string;
  repo: string;
  workflows: WorkflowRunStat[];
  totalRunsAnalyzed: number;
  totalRunsParsed: number;
  totalFailureOccurrences: number;
  uniqueFailingTests: number;
  flakyTests: number;
  consistentlyFailingTests: number;
  rows: TestFailureRow[];
  coverageStart?: string;
  coverageEnd?: string;
  /** Set when artifact downloads failed (e.g. the token lacks the actions scope). */
  downloadError?: string;
}

// ---------------------------------------------------------------------------
// JUnit parsing
// ---------------------------------------------------------------------------

type TestStatus = 'passed' | 'failed' | 'skipped';

interface ParsedCase {
  classname: string;
  name: string;
  status: TestStatus;
  message?: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Keep the (large) failure/error log bodies as opaque strings instead of
  // parsing them into nodes — we only need the attributes and their presence.
  stopNodes: ['*.failure', '*.error'],
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function firstMessage(node: unknown): string | undefined {
  const n = Array.isArray(node) ? node[0] : node;
  if (n && typeof n === 'object' && '@_message' in n) {
    const m = (n as Record<string, unknown>)['@_message'];
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return undefined;
}

/** Parse a JUnit XML document into a flat list of testcases with status. */
export function parseJunit(xml: string): ParsedCase[] {
  const doc = xmlParser.parse(xml);
  const suites = asArray(doc?.testsuites?.testsuite ?? doc?.testsuite);
  const cases: ParsedCase[] = [];

  for (const suite of suites) {
    for (const c of asArray(suite?.testcase)) {
      const classname = String(c['@_classname'] ?? c['@_class'] ?? '');
      const name = String(c['@_name'] ?? '');
      if (!name) continue;

      let status: TestStatus = 'passed';
      let message: string | undefined;
      if (c.failure !== undefined || c.error !== undefined) {
        status = 'failed';
        message = firstMessage(c.failure ?? c.error);
      } else if (c.skipped !== undefined) {
        status = 'skipped';
      }
      cases.push({ classname, name, status, message });
    }
  }
  return cases;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

interface RunsResponse {
  total_count: number;
  workflow_runs: WorkflowRun[];
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

async function listRuns(
  owner: string,
  repo: string,
  workflowId: number,
  runCount: number,
): Promise<WorkflowRun[]> {
  const pages = Math.max(1, Math.ceil(runCount / PER_PAGE));
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
  return runs.slice(0, runCount);
}

/** Extract the first JUnit XML file found in an artifact zip. */
function extractJunitXml(zip: Uint8Array): string | null {
  const files = unzipSync(zip);
  const xmlName = Object.keys(files).find((n) => n.toLowerCase().endsWith('.xml'));
  return xmlName ? strFromU8(files[xmlName]) : null;
}

/** Run async `fn` over `items` with a bounded number of concurrent workers. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface Accum {
  classname: string;
  name: string;
  seen: number;
  failed: number;
  byWorkflow: Map<number, TestWorkflowStat>;
  messages: Set<string>;
  failures: FailingRun[];
}

/** A test's outcome within a single run, after collapsing duplicate entries. */
interface RunOutcome {
  classname: string;
  name: string;
  ran: boolean;
  failed: boolean;
  message?: string;
}

interface RunResult {
  workflowId: number;
  label: string;
  parsed: boolean;
  hadArtifact: boolean;
  downloadFailed: boolean;
  downloadErrorMessage?: string;
  cases: ParsedCase[];
  run: WorkflowRun;
}

const DOWNLOAD_CONCURRENCY = 8;

/**
 * Build a cross-run test-failure report for a set of workflows that run the
 * same suite. Downloads each run's JUnit artifact, parses it, and aggregates
 * per-test pass/fail counts so intermittent (flaky) failures stand out.
 */
export async function fetchTestFailureReport({
  owner,
  repo,
  workflowIds,
  runCount = 50,
}: FetchTestFailuresParams): Promise<TestFailureReport> {
  // Gather runs for every workflow, labelled by the workflow's display name.
  const perWorkflowRuns = await Promise.all(
    workflowIds.map(async (workflowId) => {
      const runs = await listRuns(owner, repo, workflowId, runCount);
      const label = runs[0]?.name ?? `Workflow ${workflowId}`;
      return { workflowId, label, runs };
    }),
  );

  // Stop hammering the API once we learn downloads are forbidden (e.g. the
  // token lacks the actions scope) — the first failure implies the rest.
  let downloadError: string | undefined;

  const allRunItems = perWorkflowRuns.flatMap((w) =>
    w.runs.map((run) => ({ workflowId: w.workflowId, label: w.label, run })),
  );

  const runResults = await mapPool(
    allRunItems,
    DOWNLOAD_CONCURRENCY,
    async ({ workflowId, label, run }): Promise<RunResult> => {
      const base: RunResult = {
        workflowId,
        label,
        parsed: false,
        hadArtifact: false,
        downloadFailed: false,
        cases: [],
        run,
      };
      if (downloadError) return base;

      try {
        const artifacts = await githubFetch<ArtifactsResponse>(
          `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${run.id}/artifacts?per_page=${PER_PAGE}`,
        );
        const junit = artifacts.artifacts.find(
          (a) => /junit/i.test(a.name) && !a.expired,
        );
        if (!junit) return base;
        base.hadArtifact = true;

        const zip = await githubFetchBinary(junit.archive_download_url);
        const xml = extractJunitXml(zip);
        if (!xml) return base;

        base.cases = parseJunit(xml);
        base.parsed = true;
        return base;
      } catch (err) {
        base.downloadFailed = true;
        base.downloadErrorMessage =
          err instanceof Error ? err.message : String(err);
        // Record the first download error and short-circuit the rest.
        if (!downloadError) downloadError = base.downloadErrorMessage;
        return base;
      }
    },
  );

  return aggregate({
    owner,
    repo,
    workflowIds,
    perWorkflowRuns,
    runResults,
    downloadError,
  });
}

interface AggregateInput {
  owner: string;
  repo: string;
  workflowIds: number[];
  perWorkflowRuns: { workflowId: number; label: string; runs: WorkflowRun[] }[];
  runResults: RunResult[];
  downloadError?: string;
}

function aggregate({
  owner,
  repo,
  perWorkflowRuns,
  runResults,
  downloadError,
}: AggregateInput): TestFailureReport {
  const labels = new Map(perWorkflowRuns.map((w) => [w.workflowId, w.label]));
  const tests = new Map<string, Accum>();

  const stats = new Map<number, WorkflowRunStat>(
    perWorkflowRuns.map((w) => [
      w.workflowId,
      {
        workflowId: w.workflowId,
        label: w.label,
        runsAnalyzed: w.runs.length,
        runsWithArtifact: 0,
        runsParsed: 0,
        runsFailedDownload: 0,
      },
    ]),
  );

  let totalFailureOccurrences = 0;
  let coverageStart: string | undefined;
  let coverageEnd: string | undefined;

  for (const result of runResults) {
    const stat = stats.get(result.workflowId);
    if (stat) {
      if (result.hadArtifact) stat.runsWithArtifact++;
      if (result.parsed) stat.runsParsed++;
      if (result.downloadFailed) stat.runsFailedDownload++;
    }
    if (!result.parsed) continue;

    const created = result.run.created_at;
    if (!coverageStart || created < coverageStart) coverageStart = created;
    if (!coverageEnd || created > coverageEnd) coverageEnd = created;

    // Collapse duplicate testcase entries within this one run first, so a test
    // counts at most once per run (failed if any occurrence failed). Without
    // this, tests like Go's TestMain — emitted once per package, sometimes with
    // a shared classname — get over-counted far beyond the number of runs.
    const perRun = new Map<string, RunOutcome>();
    for (const c of result.cases) {
      const key = `${c.classname} ${c.name}`;
      let outcome = perRun.get(key);
      if (!outcome) {
        outcome = { classname: c.classname, name: c.name, ran: false, failed: false };
        perRun.set(key, outcome);
      }
      if (c.status === 'failed') {
        outcome.failed = true;
        outcome.ran = true;
        if (c.message && !outcome.message) outcome.message = c.message;
      } else if (c.status === 'passed') {
        outcome.ran = true;
      }
      // 'skipped' leaves ran/failed untouched.
    }

    for (const [key, outcome] of perRun) {
      if (!outcome.ran) continue; // skipped in every occurrence → not "seen"
      let acc = tests.get(key);
      if (!acc) {
        acc = {
          classname: outcome.classname,
          name: outcome.name,
          seen: 0,
          failed: 0,
          byWorkflow: new Map(),
          messages: new Set(),
          failures: [],
        };
        tests.set(key, acc);
      }
      acc.seen++;

      let wf = acc.byWorkflow.get(result.workflowId);
      if (!wf) {
        wf = {
          workflowId: result.workflowId,
          label: labels.get(result.workflowId) ?? String(result.workflowId),
          seen: 0,
          failed: 0,
        };
        acc.byWorkflow.set(result.workflowId, wf);
      }
      wf.seen++;

      if (outcome.failed) {
        acc.failed++;
        wf.failed++;
        totalFailureOccurrences++;
        if (outcome.message) acc.messages.add(outcome.message);
        acc.failures.push({
          workflowId: result.workflowId,
          workflowLabel:
            labels.get(result.workflowId) ?? String(result.workflowId),
          runNumber: result.run.run_number,
          url: result.run.html_url,
          sha: result.run.head_sha,
          branch: result.run.head_branch,
          event: result.run.event,
          createdAt: created,
          message: outcome.message,
        });
      }
    }
  }

  const rows: TestFailureRow[] = [];
  for (const acc of tests.values()) {
    if (acc.failed === 0) continue;
    const failures = [...acc.failures].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const latest = failures[0];
    rows.push({
      id: encodeTestId(acc.classname, acc.name),
      classname: acc.classname,
      name: acc.name,
      seen: acc.seen,
      failed: acc.failed,
      failureRate: acc.seen ? acc.failed / acc.seen : 0,
      flaky: acc.failed > 0 && acc.failed < acc.seen,
      byWorkflow: [...acc.byWorkflow.values()].sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
      messages: [...acc.messages].slice(0, 5),
      failures,
      lastFailureUrl: latest?.url,
      lastFailureSha: latest?.sha,
      lastFailureAt: latest?.createdAt,
    });
  }

  // Flaky (intermittent) tests first, then by raw failure count.
  rows.sort(
    (a, b) =>
      Number(b.flaky) - Number(a.flaky) ||
      b.failed - a.failed ||
      b.failureRate - a.failureRate,
  );

  const workflows = [...stats.values()];
  return {
    owner,
    repo,
    workflows,
    totalRunsAnalyzed: workflows.reduce((s, w) => s + w.runsAnalyzed, 0),
    totalRunsParsed: workflows.reduce((s, w) => s + w.runsParsed, 0),
    totalFailureOccurrences,
    uniqueFailingTests: rows.length,
    flakyTests: rows.filter((r) => r.flaky).length,
    consistentlyFailingTests: rows.filter((r) => !r.flaky).length,
    rows,
    coverageStart,
    coverageEnd,
    downloadError,
  };
}
