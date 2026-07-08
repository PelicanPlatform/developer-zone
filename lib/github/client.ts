export const GITHUB_API = 'https://api.github.com';
export const PER_PAGE = 100;

/**
 * How long (seconds) a GitHub response stays in Next's Data Cache before it is
 * refetched. This makes each unique request hit the API once and then be reused
 * across dev reloads / page switches and across builds within the window,
 * instead of refetching every render. Bump it down to see fresher data sooner,
 * or clear `.next/cache` to force an immediate refresh.
 */
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Standard GitHub REST headers, including a bearer token from `GITHUB_TOKEN`
 * when one is set. This is only ever read at build time (from Server
 * Components), so the token stays server-side and is never shipped to the
 * browser.
 */
export function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Fetch a GitHub API endpoint, throwing a human-readable error on failure.
 *
 * Reads `GITHUB_TOKEN` from the environment to authenticate. This is only ever
 * called at build time (from Server Components), so the token stays server-side
 * and is never shipped to the browser.
 */
export async function githubFetch<T>(url: URL | string): Promise<T> {
  const res = await fetch(url, {
    headers: githubHeaders(),
    // Cache in Next's Data Cache so a given request is made once and reused
    // across reloads, page switches, and builds within the window.
    next: { revalidate: CACHE_TTL_SECONDS },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

/**
 * Fetch a binary GitHub resource (e.g. an artifact zip) with auth + caching.
 * Zips are well under Next's per-entry Data Cache limit, so they are reused
 * across reloads and builds just like JSON responses.
 */
export async function githubFetchBinary(url: URL | string): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: githubHeaders(),
    next: { revalidate: CACHE_TTL_SECONDS },
  });
  if (!res.ok) throw await toApiError(res);
  return new Uint8Array(await res.arrayBuffer());
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
