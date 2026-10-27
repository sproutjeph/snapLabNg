export const ROUTES = {
  snap: "/?flow=1",
  demo: "/?flow=1&golden=note1",
} as const;

/**
 * Adds or replaces a single query parameter in `path`, preserving existing parameters and hash.
 */
export function withParam(path: string, key: string, value: string): string {
  const url = new URL(path, "http://snaplab.local");
  url.searchParams.set(key, value);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
