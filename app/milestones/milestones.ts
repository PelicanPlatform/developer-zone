import { unstable_cache } from 'next/cache';

import { fetchMilestones, fetchMilestoneTimeline } from '@/lib/github';
import type { Milestone, MilestoneTimeline } from '@/lib/github';

export const OWNER = 'PelicanPlatform';
export const REPO = 'pelican';

/**
 * Cached milestone list. Needed by the index page and by the detail route's
 * `generateStaticParams`, so it is wrapped in `unstable_cache` to fetch once
 * per build and serve the rest from the Data Cache.
 */
// Bump this when the cached shape changes so stale payloads are discarded
// instead of served from `.next/cache` under an unchanged key.
const CACHE_VERSION = 'v2';

export const getMilestones: () => Promise<Milestone[]> = unstable_cache(
  () => fetchMilestones(OWNER, REPO),
  ['milestones', CACHE_VERSION, OWNER, REPO],
  { revalidate: 3600 },
);

/**
 * Cached per-milestone timeline. The cache key includes the milestone number
 * so each milestone is fetched and stored independently.
 */
export function getMilestoneTimeline(
  milestoneNumber: number,
): Promise<MilestoneTimeline> {
  return unstable_cache(
    () =>
      fetchMilestoneTimeline({
        owner: OWNER,
        repo: REPO,
        milestoneNumber,
      }),
    ['milestone-timeline', CACHE_VERSION, OWNER, REPO, String(milestoneNumber)],
    { revalidate: 3600 },
  )();
}

/**
 * Every milestone expanded with its issues, for the cross-milestone comparison
 * view. Reuses the per-milestone timeline cache, so this adds no API calls
 * beyond what the detail pages already fetch during a build.
 */
export async function getAllMilestoneTimelines(): Promise<MilestoneTimeline[]> {
  const milestones = await getMilestones();
  return Promise.all(milestones.map((m) => getMilestoneTimeline(m.number)));
}
