# Installable app, with the demo working offline (PWA)

## Goal
Make SnapLab NG installable on a phone ("Add to Home screen") and make the demo page work with no data connection after one visit. A student on a weak MTN signal, or a judge on bad Wi-Fi, can still open the app and play the golden demo (docs/09 SHOULD: "PWA offline"; docs/05 §3). Live snaps still need the network, and the app says so instead of failing silently.

## Out of scope
- New dependencies (no `vite-plugin-pwa`, no Workbox). A small hand-written service worker is enough.
- Caching any `/api/*` response, student photos or audio. Push notifications. 3D.
- Editing `apps/web/index.html` or `apps/web/src/main.tsx`: those are lead files. List the exact lines to add under "Needs from lead".

## Files
Owner: **Muse Code**, branch `muse/pwa-offline`, worktree `~/Desktop/SnapLabNG-muse`.
- `apps/web/public/manifest.webmanifest`:
  - name "SnapLab NG", short_name "SnapLab";
  - `start_url` "/?home=1", `display` "standalone";
  - `background_color` and `theme_color` "#0b0d12";
  - icons 192 and 512 (PNG) plus a maskable 512.
- `apps/web/public/icons/`: the three PNG icons. Draw them with a small script you commit in `apps/web/src/pwa/makeIcons.ts`, run with bun: a simple flask-and-wire glyph in cyan on `#0b0d12`, rasterised in the script and encoded as PNG with `node:zlib` and a hand-written CRC32. No dependency and no external images.
- `apps/web/public/sw.js`: the service worker, plain JavaScript.
  - `CACHE = "snaplab-v1"`.
  - On install, it caches the app shell: `/`, `/index.html`, `/manifest.webmanifest`, the icons, `/golden/note1.json` and `/golden/note1.jpg`.
  - On fetch, requests are handled by type:
    - navigations: network first, with a fallback to the cached `/index.html`;
    - same-origin `/assets/*` (Vite's hashed files): cache first, and stored on first use;
    - `/golden/*`: cache first;
    - `/api/*` and any other origin: never touched, so they go straight to the network;
    - anything that is not GET: never touched.
  - On activate, it deletes old `snaplab-*` caches and calls `clients.claim()`.
- `apps/web/src/pwa/register.ts`: `registerServiceWorker(): void`. It registers `/sw.js` only when `"serviceWorker" in navigator`, in production builds (`import.meta.env.PROD`), and not inside an iframe. Errors are caught and logged once, never thrown.
- `apps/web/src/pwa/useOnline.ts`: `useOnline(): boolean`, from `navigator.onLine` and the online and offline events.
- `apps/web/src/pwa/OfflineNotice.tsx`: when offline, a small fixed banner: "You're offline. The demo page still works; snapping a new page needs a connection." It has `role="status"` and does not cover the bottom 64 px on phones.
- `apps/web/src/pwa/PwaPreview.tsx`: a page for `?pwa=1`. It shows whether a service worker is registered and controlling the page, the cache names and entry counts (through the Cache API), the online state, and the `OfflineNotice`. It sets `window.__SNAPLAB_READY__ = true` after mount.
- `apps/web/src/pwa/pwa.test.ts`: tests of a pure `routeFor(url: URL, method: string): "navigate-network-first" | "cache-first" | "bypass"`. Put that function in `apps/web/src/pwa/routing.ts`, and copy the same logic into `sw.js` with a comment pointing at it. The test also checks the manifest fields by reading the JSON file.
- `apps/web/src/App.tsx`: add only a lazy `?pwa=1` switch, keeping every other switch.

## Tests
- `routeFor`:
  - `/assets/index-abc.js` GET gives cache-first;
  - `/golden/note1.json` GET gives cache-first;
  - `/api/snap` POST and `/api/examiner` GET both give bypass;
  - a navigation to `/?flow=1` gives navigate-network-first (pass `mode: "navigate"` in however you model it);
  - `https://cdn.example.com/x.js` gives bypass;
  - any method other than GET gives bypass.
- Manifest: it has `name`, `start_url`, `display: "standalone"`, and icons of 192 and 512, including one with `purpose` containing "maskable". Every icon file exists.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree, after `bun install` following any merge of `main`. `dist/` contains `sw.js`, the manifest and the icons.
- After `bun run build`, serve `dist/` with `cd apps/web && bun run preview -- --port 5176 --strictPort`. Then, in headless Chromium:
  1. opens `/?pwa=1` and sees the worker controlling the page after one reload;
  2. goes offline (`context.setOffline(true)`) and reloads `/?flow=1&golden=note1`;
  3. the demo still loads, with no failed requests except `/api/*`.
  Describe the result in the PR.
- No `/api/*` response is ever written to a cache.
- The PR `muse/pwa-offline` → `main` starts with the Muse Code line from AGENTS.md, has its counts checked against the branch, and lists under "Needs from lead":
  - the `<link rel="manifest">` and `<meta name="theme-color">` lines for `index.html`;
  - the one `registerServiceWorker()` call for `main.tsx`;
  - where `OfflineNotice` should be mounted.

## Implementer
Muse Code (fresh session).
