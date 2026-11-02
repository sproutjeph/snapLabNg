// Where the API lives. Unset VITE_API_ORIGIN = same origin (dev, E2E, the all-in-one Docker image).
// The value is a public URL, not a secret (docs/plans/deploy-gcp.md).

/** The API origin without a trailing slash, or "" for same origin. */
function origin(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/\/+$/, "");
}

/** `/api/...` on the API origin. */
export function apiUrl(
  path: string,
  raw: string | undefined = import.meta.env.VITE_API_ORIGIN,
): string {
  return `${origin(raw)}${path}`;
}

/** `ws(s)://.../ws/...` on the API origin, or on this page's host when unset. */
export function wsUrl(
  path: string,
  raw: string | undefined = import.meta.env.VITE_API_ORIGIN,
  loc: { protocol: string; host: string } = location,
): string {
  const o = origin(raw);
  if (o) return `${o.replace(/^http/, "ws")}${path}`;
  return `${loc.protocol === "https:" ? "wss" : "ws"}://${loc.host}${path}`;
}
