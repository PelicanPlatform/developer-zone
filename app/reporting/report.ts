import { unstable_cache } from 'next/cache';

import { fetchMonthlyReport } from '@/lib/github';
import type { CoverageConfig, MonthlyReport } from '@/lib/github';

export const OWNER = 'PelicanPlatform';
export const REPO = 'pelican';

/** Months shown in the table, one row each. */
export const MONTHS = 12;
/** Trailing window for the "delivered" metrics. */
export const TRAILING_MONTHS = 3;

/**
 * Where the coverage % comes from: the newest successful run of the first
 * workflow whose name/path contains one of `workflowHints`, whose artifact name
 * contains one of `artifactHints`. Tune these to match the Pelican CI setup —
 * the parser understands Go coverage profiles, `go tool cover -func` output,
 * LCOV, and Istanbul JSON summaries. Older months fill in only while their CI
 * artifacts remain within GitHub's retention window.
 */
export const COVERAGE: CoverageConfig = {
  workflowHints: ['coverage', 'cover'],
  artifactHints: ['coverage', 'cover'],
};

// Bump when the cached shape changes so stale payloads aren't served.
const CACHE_VERSION = 'v2';

/**
 * Cached monthly report. Keyed by the current year-month so a new month busts
 * the cache while repeated builds within a month reuse the (expensive) result —
 * it fetches every issue plus a per-issue event timeline.
 */
export function getMonthlyReport(): Promise<MonthlyReport> {
  const now = Date.now();
  const monthStamp = new Date(now).toISOString().slice(0, 7); // YYYY-MM

  return unstable_cache(
    () =>
      fetchMonthlyReport({
        owner: OWNER,
        repo: REPO,
        months: MONTHS,
        trailingMonths: TRAILING_MONTHS,
        now,
        coverage: COVERAGE,
      }),
    ['monthly-report', CACHE_VERSION, OWNER, REPO, monthStamp],
    { revalidate: 3600 },
  )();
}
