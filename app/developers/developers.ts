import { unstable_cache } from 'next/cache';

import { fetchDeveloperReport } from '@/lib/github';
import type { DeveloperReport, DeveloperStats } from '@/lib/github';

export const OWNER = 'PelicanPlatform';
export const REPO = 'pelican';

// Bump when the cached shape changes so stale payloads aren't served.
const CACHE_VERSION = 'v2';

/**
 * Cached developer-productivity report. Keyed by the current ISO week so a new
 * week busts the cache while repeated builds within a week reuse the (expensive)
 * result — it fetches every issue/PR plus GitHub's per-author commit stats.
 * Needed by the index page and by the detail route's `generateStaticParams`.
 */
export function getDeveloperReport(): Promise<DeveloperReport> {
  const now = Date.now();
  // YYYY-Www-ish stamp: year + zero-based week index, stable within a week.
  const weekStamp = String(Math.floor(now / (7 * 86_400_000)));

  return unstable_cache(
    () => fetchDeveloperReport({ owner: OWNER, repo: REPO, now }),
    ['developer-report', CACHE_VERSION, OWNER, REPO, weekStamp],
    { revalidate: 3600 },
  )();
}

/** Look up a single developer by login (case-insensitive), or null. */
export async function getDeveloper(login: string): Promise<DeveloperStats | null> {
  const report = await getDeveloperReport();
  const lower = login.toLowerCase();
  return report.developers.find((d) => d.login.toLowerCase() === lower) ?? null;
}
