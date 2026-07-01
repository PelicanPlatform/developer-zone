import { unstable_cache } from 'next/cache';

import { fetchTestFailureReport } from '@/lib/github';
import type { TestFailureReport } from '@/lib/github';

export const OWNER = 'PelicanPlatform';
export const REPO = 'pelican';

// macOS, Windows, and Linux test workflows — they run the same suite.
export const WORKFLOW_IDS = [228169648, 228169646, 228169649];
export const RUN_COUNT = 100;

/**
 * Cached report accessor. The report is expensive (it downloads and parses a
 * JUnit artifact per run), and it is needed by the index page, the detail
 * route's generateStaticParams, and every detail page. Wrapping it in
 * `unstable_cache` computes it once per build and serves the rest from the
 * Data Cache instead of re-downloading and re-parsing for every page.
 */
export const getTestFailureReport: () => Promise<TestFailureReport> =
  unstable_cache(
    () =>
      fetchTestFailureReport({
        owner: OWNER,
        repo: REPO,
        workflowIds: WORKFLOW_IDS,
        runCount: RUN_COUNT,
      }),
    ['test-failure-report', WORKFLOW_IDS.join('-'), String(RUN_COUNT)],
    { revalidate: 3600 },
  );
