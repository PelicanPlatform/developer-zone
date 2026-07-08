import type { DeveloperTimeRange } from '@/lib/github';

/** The range tabs, in display order. */
export const TIME_RANGES: { key: DeveloperTimeRange; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

/** A human phrase for the trailing window a range covers. */
export function rangeWindowLabel(range: DeveloperTimeRange): string {
  switch (range) {
    case 'week':
      return 'past 7 days';
    case 'month':
      return 'past 30 days';
    case 'year':
      return 'past year';
  }
}

/** Compact integer, e.g. 1234 → "1,234", 15300 → "15.3k". */
export function formatCount(n: number): string {
  if (Math.abs(n) >= 10_000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return n.toLocaleString();
}

/** Signed net-lines value, e.g. 320 → "+320", −45 → "−45". */
export function formatNet(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${formatCount(Math.abs(n))}`;
}

/** A 0..1 ratio as a whole-number percent, e.g. 0.73 → "73%". */
export function formatRate(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

/** Days as a friendly duration, e.g. 0.4 → "9h", 3.2 → "3.2d". */
export function formatDays(days: number | null): string {
  if (days == null) return '—';
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 10) return `${days.toFixed(1)}d`;
  return `${Math.round(days)}d`;
}

/**
 * Human "time ago" from an ISO week start relative to `now` (ms). Weeks are the
 * finest granularity GitHub's contributor stats expose.
 */
export function formatWeekAgo(weekStart: string | null, now: number): string {
  if (!weekStart) return 'never';
  const ms = Date.parse(`${weekStart}T00:00:00Z`);
  const weeks = Math.floor((now - ms) / (7 * 86_400_000));
  if (weeks <= 0) return 'this week';
  if (weeks === 1) return 'last week';
  if (weeks < 8) return `${weeks} weeks ago`;
  const months = Math.round(weeks / 4.345);
  if (months < 24) return `${months} mo ago`;
  return `${(months / 12).toFixed(1)} yr ago`;
}

/** Format an ISO date as "Jun 2025" (UTC). */
export function formatMonthYear(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
