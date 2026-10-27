/**
 * Pure routing decision for the service worker fetch handler.
 *
 * `apps/web/public/sw.js` carries the same logic in plain JavaScript (a
 * service worker cannot import this module); keep the two in sync. The rules
 * come from docs/plans/pwa-offline.md: `/api/*` is never cached, and only
 * navigations, hashed `/assets/*` files and `/golden/*` files are handled.
 */
export type Route = "navigate-network-first" | "cache-first" | "bypass";

/**
 * Decides how the service worker handles one request.
 *
 * `mode` is the request mode (`"navigate"` for page loads). `baseOrigin` is
 * the origin the worker serves; it defaults to the page origin in a browser
 * and to `http://localhost` elsewhere (tests) so the decision stays pure.
 */
export function routeFor(
  url: URL,
  method: string,
  mode: string = "cors",
  baseOrigin: string = typeof location !== "undefined" ? location.origin : "http://localhost",
): Route {
  if (method !== "GET") return "bypass";
  if (url.origin !== baseOrigin) return "bypass";
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return "bypass";
  if (mode === "navigate") return "navigate-network-first";
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/golden/")) {
    return "cache-first";
  }
  return "bypass";
}
