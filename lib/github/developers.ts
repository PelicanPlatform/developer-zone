import { GITHUB_API, PER_PAGE, githubFetch, githubHeaders, toApiError } from './client';
import type {
  DeveloperRangeMetrics,
  DeveloperReport,
  DeveloperStats,
  DeveloperTimeRange,
  DeveloperWeek,
  IssueStateReason,
} from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface FetchDeveloperReportParams {
  owner: string;
  repo: string;
  /**
   * Build-time clock in epoch ms. Passed in by the caller so the report is a
   * pure function of its inputs and static builds don't smear across a week
   * boundary mid-build.
   */
  now: number;
  /**
   * Contributors with fewer than this many commits are dropped from the report
   * to keep the table focused on real authors (drive-by typo fixers add noise).
   * Default 1 (everyone with a commit).
   */
  minCommits?: number;
}

// Never page issues forever, even against a pathological repo.
const MAX_ISSUE_PAGES = 200;
const DAY_MS = 86_400_000;

/** The trailing windows exposed by the range tabs, in milliseconds. */
const RANGES: { key: DeveloperTimeRange; ms: number }[] = [
  { key: 'week', ms: 7 * DAY_MS },
  { key: 'month', ms: 30 * DAY_MS },
  { key: 'year', ms: 365 * DAY_MS },
];
// GitHub computes /stats/contributors lazily; a first request 202s while it
// builds the cache. Retry a few times before giving up.
const STATS_MAX_ATTEMPTS = 6;
const STATS_RETRY_MS = 2500;

// ---------------------------------------------------------------------------
// Raw GitHub shapes (only the fields we use)
// ---------------------------------------------------------------------------

interface RawContributorWeek {
  /** Week start, unix seconds (Sunday 00:00 UTC). */
  w: number;
  /** Additions. */
  a: number;
  /** Deletions. */
  d: number;
  /** Commits. */
  c: number;
}

interface RawContributor {
  total: number;
  weeks: RawContributorWeek[];
  author: { login: string; avatar_url: string; html_url: string } | null;
}

interface RawIssue {
  number: number;
  state: 'open' | 'closed';
  state_reason: IssueStateReason;
  created_at: string;
  closed_at: string | null;
  user: { login: string; avatar_url: string; html_url: string } | null;
  assignees: { login: string; avatar_url: string; html_url: string }[] | null;
  /** Present only when the "issue" is actually a pull request. */
  pull_request?: { merged_at: string | null } | null;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch per-author commit statistics. This endpoint returns `202 Accepted`
 * with an empty body the first time it's hit while GitHub computes the cache,
 * so we poll a handful of times before surfacing the delay to the caller.
 */
async function fetchContributorStats(
  owner: string,
  repo: string,
): Promise<RawContributor[]> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/stats/contributors?per_page=${PER_PAGE}`;
  for (let attempt = 1; attempt <= STATS_MAX_ATTEMPTS; attempt++) {
    // `no-store`: don't let Next's Data Cache memoize a transient 202 body.
    const res = await fetch(url, { headers: githubHeaders(), cache: 'no-store' });
    if (res.status === 202) {
      await delay(STATS_RETRY_MS * attempt);
      continue;
    }
    if (!res.ok) throw await toApiError(res);
    const text = await res.text();
    if (!text) {
      await delay(STATS_RETRY_MS * attempt);
      continue;
    }
    return JSON.parse(text) as RawContributor[];
  }
  throw new Error(
    'GitHub is still computing contributor statistics for this repository; try again shortly.',
  );
}

async function fetchAllIssues(owner: string, repo: string): Promise<RawIssue[]> {
  const issues: RawIssue[] = [];
  for (let page = 1; page <= MAX_ISSUE_PAGES; page++) {
    const url = new URL(`${GITHUB_API}/repos/${owner}/${repo}/issues`);
    url.searchParams.set('state', 'all');
    url.searchParams.set('sort', 'created');
    url.searchParams.set('direction', 'asc');
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));

    const batch = await githubFetch<RawIssue[]>(url);
    issues.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** GitHub bot accounts (dependabot, etc.) — excluded from the leaderboard. */
function isBot(login: string): boolean {
  return login.endsWith('[bot]') || login === 'dependabot' || login === 'github-actions';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function isoWeek(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Build a zeroed record keyed by every time range. */
function zeroRange<T>(make: () => T): Record<DeveloperTimeRange, T> {
  return { week: make(), month: make(), year: make() };
}

/** Per-range issue/PR counters. */
interface IssueRangeCounts {
  prsOpened: number;
  prsMerged: number;
  issuesOpened: number;
  issuesClosed: number;
}

/** Per-developer accumulator for the issue/PR pass. */
interface IssueAgg {
  avatarUrl: string;
  htmlUrl: string;
  prsOpened: number;
  prsMerged: number;
  daysToMerge: number[];
  issuesOpened: number;
  issuesCompleted: number;
  issuesAssigned: number;
  issuesAssignedCompleted: number;
  range: Record<DeveloperTimeRange, IssueRangeCounts>;
}

function emptyIssueAgg(avatarUrl: string, htmlUrl: string): IssueAgg {
  return {
    avatarUrl,
    htmlUrl,
    prsOpened: 0,
    prsMerged: 0,
    daysToMerge: [],
    issuesOpened: 0,
    issuesCompleted: 0,
    issuesAssigned: 0,
    issuesAssignedCompleted: 0,
    range: zeroRange<IssueRangeCounts>(() => ({
      prsOpened: 0,
      prsMerged: 0,
      issuesOpened: 0,
      issuesClosed: 0,
    })),
  };
}

/**
 * Build the developer-productivity dataset. Commit metrics come from GitHub's
 * per-author statistics; pull-request and issue metrics are aggregated from the
 * repository's issues endpoint (which includes PRs). Pure with respect to
 * `now`, so a static build is reproducible.
 */
export async function fetchDeveloperReport({
  owner,
  repo,
  now,
  minCommits = 1,
}: FetchDeveloperReportParams): Promise<DeveloperReport> {
  const notes: string[] = [];
  const cutoffs = RANGES.map((r) => ({ key: r.key, cutoff: now - r.ms }));

  const [contributors, rawIssues] = await Promise.all([
    fetchContributorStats(owner, repo),
    fetchAllIssues(owner, repo),
  ]);

  // --- Issue / PR pass, keyed by author login ---
  const issueAggs = new Map<string, IssueAgg>();
  const getAgg = (login: string, avatar: string, html: string): IssueAgg => {
    let agg = issueAggs.get(login);
    if (!agg) {
      agg = emptyIssueAgg(avatar, html);
      issueAggs.set(login, agg);
    }
    return agg;
  };

  for (const item of rawIssues) {
    const isPr = Boolean(item.pull_request);
    const completed = item.state === 'closed' && item.state_reason !== 'not_planned';

    if (item.user && !isBot(item.user.login)) {
      const agg = getAgg(item.user.login, item.user.avatar_url, item.user.html_url);
      const openedMs = Date.parse(item.created_at);
      if (isPr) {
        agg.prsOpened += 1;
        for (const { key, cutoff } of cutoffs) {
          if (openedMs >= cutoff) agg.range[key].prsOpened += 1;
        }
        const mergedAt = item.pull_request?.merged_at ?? null;
        if (mergedAt) {
          agg.prsMerged += 1;
          const mergedMs = Date.parse(mergedAt);
          for (const { key, cutoff } of cutoffs) {
            if (mergedMs >= cutoff) agg.range[key].prsMerged += 1;
          }
          const days = (mergedMs - openedMs) / DAY_MS;
          if (Number.isFinite(days)) agg.daysToMerge.push(Math.max(0, days));
        }
      } else {
        agg.issuesOpened += 1;
        for (const { key, cutoff } of cutoffs) {
          if (openedMs >= cutoff) agg.range[key].issuesOpened += 1;
        }
        if (completed) {
          agg.issuesCompleted += 1;
          const closedMs = item.closed_at ? Date.parse(item.closed_at) : NaN;
          for (const { key, cutoff } of cutoffs) {
            if (closedMs >= cutoff) agg.range[key].issuesClosed += 1;
          }
        }
      }
    }

    // Assignment credit applies to issues only (PR assignees are usually the
    // author or a triager, not a productivity signal).
    if (!isPr) {
      for (const a of item.assignees ?? []) {
        if (isBot(a.login)) continue;
        const agg = getAgg(a.login, a.avatar_url, a.html_url);
        agg.issuesAssigned += 1;
        if (completed) agg.issuesAssignedCompleted += 1;
      }
    }
  }

  // --- Commit pass, keyed by author login ---
  interface CommitRangeCounts {
    commits: number;
    additions: number;
    deletions: number;
    activeWeeks: number;
  }

  interface CommitAgg {
    login: string;
    avatarUrl: string;
    htmlUrl: string;
    commits: number;
    additions: number;
    deletions: number;
    activeWeeks: number;
    bestWeek: number;
    firstWeek: string | null;
    lastWeek: string | null;
    streak: number;
    recentWeeks: DeveloperWeek[];
    range: Record<DeveloperTimeRange, CommitRangeCounts>;
  }

  const commitAggs: CommitAgg[] = [];
  for (const c of contributors) {
    if (!c.author) continue;
    const { login, avatar_url, html_url } = c.author;
    if (isBot(login)) continue;
    if (c.total < minCommits) continue;

    let additions = 0;
    let deletions = 0;
    let activeWeeks = 0;
    let bestWeek = 0;
    let firstWeek: string | null = null;
    let lastWeek: string | null = null;
    const range = zeroRange<CommitRangeCounts>(() => ({
      commits: 0,
      additions: 0,
      deletions: 0,
      activeWeeks: 0,
    }));

    for (const w of c.weeks) {
      additions += w.a;
      deletions += w.d;
      const ms = w.w * 1000;
      for (const { key, cutoff } of cutoffs) {
        if (ms >= cutoff) {
          range[key].commits += w.c;
          range[key].additions += w.a;
          range[key].deletions += w.d;
          if (w.c > 0) range[key].activeWeeks += 1;
        }
      }
      if (w.c > 0) {
        activeWeeks += 1;
        if (w.c > bestWeek) bestWeek = w.c;
        if (firstWeek === null) firstWeek = isoWeek(w.w);
        lastWeek = isoWeek(w.w);
      }
    }

    // Current streak: consecutive active weeks counting back from the end,
    // tolerating a single quiet trailing week (the current, partial one).
    let lastActiveIdx = -1;
    for (let i = c.weeks.length - 1; i >= 0; i--) {
      if (c.weeks[i].c > 0) {
        lastActiveIdx = i;
        break;
      }
    }
    let streak = 0;
    if (lastActiveIdx >= c.weeks.length - 2) {
      for (let i = lastActiveIdx; i >= 0; i--) {
        if (c.weeks[i].c > 0) streak += 1;
        else break;
      }
    }

    const recentWeeks: DeveloperWeek[] = c.weeks.slice(-52).map((w) => ({
      weekStart: isoWeek(w.w),
      commits: w.c,
      additions: w.a,
      deletions: w.d,
    }));

    commitAggs.push({
      login,
      avatarUrl: avatar_url,
      htmlUrl: html_url,
      commits: c.total,
      additions,
      deletions,
      activeWeeks,
      bestWeek,
      firstWeek,
      lastWeek,
      streak,
      recentWeeks,
      range,
    });
  }

  // --- Merge the two passes into DeveloperStats, ordered by commits ---
  commitAggs.sort((a, b) => b.commits - a.commits || a.login.localeCompare(b.login));

  const totalCommits = commitAggs.reduce((sum, c) => sum + c.commits, 0);
  const n = commitAggs.length;

  const developers: DeveloperStats[] = commitAggs.map((c) => {
    const issue = issueAggs.get(c.login);
    const ranges = zeroRange<DeveloperRangeMetrics>(() => ({
      commits: 0,
      additions: 0,
      deletions: 0,
      netLines: 0,
      activeWeeks: 0,
      prsOpened: 0,
      prsMerged: 0,
      prMergeRate: null,
      issuesOpened: 0,
      issuesClosed: 0,
    }));
    for (const { key } of RANGES) {
      const cr = c.range[key];
      const ir = issue?.range[key];
      ranges[key] = {
        commits: cr.commits,
        additions: cr.additions,
        deletions: cr.deletions,
        netLines: cr.additions - cr.deletions,
        activeWeeks: cr.activeWeeks,
        prsOpened: ir?.prsOpened ?? 0,
        prsMerged: ir?.prsMerged ?? 0,
        prMergeRate: ir && ir.prsOpened > 0 ? ir.prsMerged / ir.prsOpened : null,
        issuesOpened: ir?.issuesOpened ?? 0,
        issuesClosed: ir?.issuesClosed ?? 0,
      };
    }

    return {
      login: c.login,
      avatarUrl: c.avatarUrl,
      htmlUrl: c.htmlUrl,
      commits: c.commits,
      additions: c.additions,
      deletions: c.deletions,
      netLines: c.additions - c.deletions,
      activeWeeks: c.activeWeeks,
      currentStreakWeeks: c.streak,
      bestWeekCommits: c.bestWeek,
      firstActiveWeek: c.firstWeek,
      lastActiveWeek: c.lastWeek,
      recentWeeks: c.recentWeeks,
      prsOpened: issue?.prsOpened ?? 0,
      prsMerged: issue?.prsMerged ?? 0,
      prMergeRate:
        issue && issue.prsOpened > 0 ? issue.prsMerged / issue.prsOpened : null,
      medianDaysToMerge: issue
        ? (() => {
            const m = median(issue.daysToMerge);
            return m == null ? null : Math.round(m * 10) / 10;
          })()
        : null,
      issuesOpened: issue?.issuesOpened ?? 0,
      issuesCompleted: issue?.issuesCompleted ?? 0,
      issuesAssigned: issue?.issuesAssigned ?? 0,
      issuesAssignedCompleted: issue?.issuesAssignedCompleted ?? 0,
      commitShare: totalCommits > 0 ? c.commits / totalCommits : 0,
      ranges,
    };
  });

  const totalPrsMerged = developers.reduce((sum, d) => sum + d.prsMerged, 0);
  const medianCommits = median(commitAggs.map((c) => c.commits)) ?? 0;

  if (n === 0) {
    notes.push(
      'No contributor statistics were returned — the repository may be empty or GitHub was still computing its stats cache at build time.',
    );
  }

  return {
    owner,
    repo,
    developers,
    totalCommits,
    totalPrsMerged,
    totalContributors: n,
    medianCommits: Math.round(medianCommits),
    notes,
  };
}
