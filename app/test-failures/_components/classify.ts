import type { TestFailureRow } from '@/lib/github';

export type Classification =
  | 'potentially-flaky'
  | 'branch-specific'
  | 'always-fails';

/** Distinct branches these failures came from, derived from the raw failures. */
export function distinctBranches(row: TestFailureRow): number {
  return new Set((row.failures ?? []).map((f) => f.branch ?? '(unknown)')).size;
}

/**
 * Classify a failing test:
 * - `always-fails`: failed every run it ran in → broken, not flaky.
 * - `potentially-flaky`: intermittent AND failed across multiple branches, so
 *   the failures aren't tied to a single branch's changes.
 * - `branch-specific`: intermittent but only ever failed on one branch — more
 *   likely a change on that branch than a genuine flake.
 */
export function classify(row: TestFailureRow): Classification {
  if (row.failed >= row.seen) return 'always-fails';
  return distinctBranches(row) > 1 ? 'potentially-flaky' : 'branch-specific';
}

export interface ClassMeta {
  label: string;
  color: 'warning' | 'error' | 'default';
  /** Higher = more concerning; used for sorting. */
  rank: number;
}

export const CLASS_META: Record<Classification, ClassMeta> = {
  'potentially-flaky': { label: 'Potentially flaky', color: 'warning', rank: 3 },
  'always-fails': { label: 'Always fails', color: 'error', rank: 2 },
  'branch-specific': { label: 'Branch-specific', color: 'default', rank: 1 },
};
