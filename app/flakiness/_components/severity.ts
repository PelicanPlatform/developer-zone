/** Maps a flaky-rate (0..1) to a severity bucket with a theme palette key. */

export type Severity = 'low' | 'moderate' | 'high';

export interface SeverityInfo {
  level: Severity;
  label: string;
  /** MUI theme palette key, e.g. "success.main". */
  color: string;
}

const MODERATE_THRESHOLD = 0.05;
const HIGH_THRESHOLD = 0.15;

export function getSeverity(flakyRate: number): SeverityInfo {
  if (flakyRate >= HIGH_THRESHOLD) {
    return { level: 'high', label: 'High', color: 'error.main' };
  }
  if (flakyRate >= MODERATE_THRESHOLD) {
    return { level: 'moderate', label: 'Moderate', color: 'warning.main' };
  }
  return { level: 'low', label: 'Low', color: 'success.main' };
}

/** Formats a 0..1 rate as a percentage string, e.g. 0.123 -> "12.3%". */
export function formatPercent(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits)}%`;
}
