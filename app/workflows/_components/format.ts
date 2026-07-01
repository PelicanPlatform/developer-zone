/** Formats an ISO timestamp as a compact local date-time, e.g. "Jun 15, 06:37 PM". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short 7-character commit SHA. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
