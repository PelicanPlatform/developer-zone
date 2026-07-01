export const GITHUB_API = 'https://api.github.com';
export const PER_PAGE = 100;

/** Fetch a GitHub API endpoint, throwing a human-readable error on failure. */
export async function githubFetch<T>(url: URL | string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

/** Map a non-OK GitHub response to a human-readable error. */
export async function toApiError(res: Response): Promise<Error> {
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (res.status === 403 && remaining === '0') {
    const reset = res.headers.get('x-ratelimit-reset');
    const when = reset
      ? new Date(Number(reset) * 1000).toLocaleTimeString()
      : 'shortly';
    return new Error(
      `GitHub API rate limit reached (unauthenticated requests are limited to 60/hour). Try again after ${when}.`,
    );
  }

  let detail = '';
  try {
    const body = await res.json();
    if (body?.message) detail = `: ${body.message}`;
  } catch {
    // Response had no JSON body; fall back to the status code alone.
  }
  return new Error(`GitHub API error (${res.status})${detail}`);
}
