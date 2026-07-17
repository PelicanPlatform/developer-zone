/**
 * Runtime of a run/attempt in milliseconds, derived from GitHub's timestamps.
 * `updated_at` marks completion only once the run has finished, so in-progress
 * runs (and clock anomalies) yield null rather than a bogus duration.
 */
export function runDurationMs(
  startedAt: string | undefined,
  updatedAt: string | undefined,
  status: string | null,
): number | null {
  if (status !== 'completed' || !startedAt || !updatedAt) return null;
  const ms = new Date(updatedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}
