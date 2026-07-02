import { GITHUB_API, PER_PAGE, githubFetch } from './client';
import type {
  IssueStateReason,
  Milestone,
  MilestoneIssue,
  MilestoneTimeline,
} from './types';

/** Raw issue shape from the GitHub REST API — only the fields we use. */
interface RawIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  state_reason: IssueStateReason;
  created_at: string;
  closed_at: string | null;
  html_url: string;
  assignees: { login: string; avatar_url: string; html_url: string }[] | null;
  /** Labels are objects on the issues endpoint; guard for the legacy string form. */
  labels: ({ name: string; color: string } | string)[];
  /** Present only when the "issue" is actually a pull request. */
  pull_request?: unknown;
}

/**
 * List the repository's milestones (open and closed), sorted by due date with
 * the nearest deadline first.
 */
export async function fetchMilestones(
  owner: string,
  repo: string,
): Promise<Milestone[]> {
  const milestones: Milestone[] = [];
  for (let page = 1; ; page++) {
    const url = new URL(`${GITHUB_API}/repos/${owner}/${repo}/milestones`);
    url.searchParams.set('state', 'all');
    url.searchParams.set('sort', 'due_on');
    url.searchParams.set('direction', 'desc');
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));

    const batch = await githubFetch<Milestone[]>(url);
    milestones.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return milestones;
}

export interface FetchMilestoneTimelineParams {
  owner: string;
  repo: string;
  milestoneNumber: number;
}

/**
 * Load a milestone and every issue attached to it, reduced to the fields the
 * timeline needs. Pull requests share the issues endpoint but are excluded —
 * only true issues become timeline segments. Issues are returned oldest-first
 * so the timeline reads top-to-bottom in creation order.
 */
export async function fetchMilestoneTimeline({
  owner,
  repo,
  milestoneNumber,
}: FetchMilestoneTimelineParams): Promise<MilestoneTimeline> {
  const milestone = await githubFetch<Milestone>(
    `${GITHUB_API}/repos/${owner}/${repo}/milestones/${milestoneNumber}`,
  );

  const raw: RawIssue[] = [];
  for (let page = 1; ; page++) {
    const url = new URL(`${GITHUB_API}/repos/${owner}/${repo}/issues`);
    url.searchParams.set('milestone', String(milestoneNumber));
    url.searchParams.set('state', 'all');
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('page', String(page));

    const batch = await githubFetch<RawIssue[]>(url);
    raw.push(...batch);
    if (batch.length < PER_PAGE) break;
  }

  const issues: MilestoneIssue[] = raw
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      stateReason: issue.state_reason,
      createdAt: issue.created_at,
      closedAt: issue.closed_at,
      assignees: (issue.assignees ?? []).map((a) => ({
        login: a.login,
        avatarUrl: a.avatar_url,
        htmlUrl: a.html_url,
      })),
      labels: issue.labels
        .map((label) =>
          typeof label === 'string'
            ? { name: label, color: '888888' }
            : { name: label.name, color: label.color },
        ),
      htmlUrl: issue.html_url,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return { owner, repo, milestone, issues };
}
