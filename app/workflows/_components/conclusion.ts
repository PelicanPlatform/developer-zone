import type { RunConclusion } from '@/lib/github';

export interface ConclusionStyle {
  label: string;
  /** MUI theme color path, e.g. "success.main". */
  color: string;
}

/**
 * Map a run/attempt conclusion (and status, for runs still in progress) to a
 * label and a theme color used to paint the attempt node.
 */
export function getConclusionStyle(
  conclusion: RunConclusion,
  status?: string | null,
): ConclusionStyle {
  switch (conclusion) {
    case 'success':
      return { label: 'Passed', color: 'success.main' };
    case 'failure':
      return { label: 'Failed', color: 'error.main' };
    case 'timed_out':
      return { label: 'Timed out', color: 'error.dark' };
    case 'startup_failure':
      return { label: 'Startup failure', color: 'error.dark' };
    case 'cancelled':
      return { label: 'Cancelled', color: 'grey.500' };
    case 'skipped':
      return { label: 'Skipped', color: 'grey.400' };
    case 'action_required':
      return { label: 'Action required', color: 'warning.main' };
    case 'neutral':
      return { label: 'Neutral', color: 'grey.500' };
    case 'stale':
      return { label: 'Stale', color: 'grey.500' };
    default:
      // No conclusion yet — the run is queued or in progress.
      return {
        label: status === 'unknown' ? 'Unknown' : 'In progress',
        color: 'info.main',
      };
  }
}

/** Distinct conclusion styles for a legend. */
export const LEGEND: ConclusionStyle[] = [
  { label: 'Passed', color: 'success.main' },
  { label: 'Failed', color: 'error.main' },
  { label: 'Cancelled / skipped', color: 'grey.500' },
  { label: 'In progress', color: 'info.main' },
];
