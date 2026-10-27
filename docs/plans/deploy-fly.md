# Deploy: one Fly.io app serves the site and the API

## Goal
A deployable build: one always-on Fly.io machine serves the built web app and the Bun + Hono API from the same origin. Because the origin is shared, `/api/*` and the coming `/ws/examiner` WebSocket need no CORS. The spend ledger survives restarts and redeploys on a Fly volume, so the $20 / $5-a-day cap holds (docs/05 §2 Hosting: API, docs/09 MUST "Deployed URL with rate limits, spend cap and DEMO_MODE", docs/01 §0).

This replaces the docs/05 plan of Cloudflare Pages for the front end: a second origin would need CORS, and a proxy that Pages cannot do for a WebSocket on another host. The lead updates docs/05.

## Out of scope
- Running `fly deploy`, creating the Fly app, or setting secrets: the user does that with their own account. Write the exact commands in the PR body.
- Any change to `apps/api/src/app.ts`, `env.ts` or `snap.ts` (lead files). Put the exact lines under "Needs from lead".
- New npm dependencies (Hono already has `serveStatic` for Bun).

## Files
Owner: **Muse Code**, branch `muse/deploy-fly`, worktree `~/Desktop/SnapLabNG-muse`.
- `Dockerfile` (repo root), with two stages.
  - **Build:** `FROM oven/bun:1.4.4`. Copy the manifests (`package.json`, `bun.lock`, `apps/*/package.json`, `packages/*/package.json`), run `bun install --frozen-lockfile`, copy the source, then run `bun run --filter @snaplab/web build`.
  - **Run:** `FROM oven/bun:1.4.4-slim`. Copy only what the server needs: `apps/api`, `packages/*` (source; the API imports TypeScript workspaces directly), production `node_modules`, `apps/web/dist` and `fixtures/` (for `MODE=fixtures` smoke tests).
  - `ENV PORT=8080 NODE_ENV=production`. Run as the `bun` user, `EXPOSE 8080`, `CMD ["bun", "apps/api/src/index.ts"]`.
  - Never copy `.env*`, `dataset/`, `.spend/` or `.shots/`.
- `.dockerignore`: `.env*`, `dataset/`, `.spend/`, `.shots/`, `**/node_modules`, `**/dist`, `.git`, `*.png` at the repo root, `coverage`, `.cache`.
- `fly.toml`:
  - `app = "snaplab-ng"` (the user can rename it) and `primary_region = "iad"` (closest to the Meta API; one machine);
  - `[http_service]` with `internal_port = 8080`, `force_https = true`, `auto_stop_machines = "off"`, `auto_start_machines = true` and `min_machines_running = 1`;
  - a `[[http_service.checks]]` on `GET /healthz` every 15 s;
  - `[mounts] source = "snaplab_data", destination = "/data"`;
  - `[env]`: `MODE = "fixtures"` (a safe default; the user switches to live), `TRUST_PROXY = "1"`, `SPEND_LEDGER_PATH = "/data/ledger.json"`.
  - The key is **never** in this file.
- `apps/api/src/static.ts`: `mountWebDist(app: Hono, distDir: string): void`.
  - It serves files from `apps/web/dist` for GET and HEAD requests that are not `/api/*`, `/ws/*` or `/healthz`.
  - An unknown path with no file extension gets `index.html` (the SPA fallback). An unknown path with an extension gets 404.
  - Headers:
    - `/assets/*` get `Cache-Control: public, max-age=31536000, immutable`;
    - `index.html`, `sw.js` and `manifest.webmanifest` get `Cache-Control: no-cache`;
    - every response gets `X-Content-Type-Options: nosniff`.
  - Path traversal (`..`, encoded or not) gets 404.
  - Use `serveStatic` from `hono/bun` if it does all of this. Otherwise read files with `Bun.file`. In tests (vitest, where there is no `Bun` global), take the file reader as an optional argument.
- `apps/api/src/static.test.ts`: tests against a temporary dist folder with `index.html`, `assets/app-abc.js`, `sw.js` and `golden/note1.json`.
- PR body, under **"How to deploy (for the user)"**: the exact commands, in order.
  1. Install `flyctl`.
  2. `fly auth login`.
  3. `fly launch --no-deploy --copy-config`.
  4. `fly volumes create snaplab_data --size 1 --region iad`.
  5. `fly secrets set MODEL_API_KEY=…`, typed by the user and never pasted into a file.
  6. `fly deploy`.
  7. `curl https://<app>.fly.dev/healthz`.
  8. Switch to live with `fly secrets set MODE=live` or by editing `[env]`, then redeploy.

## Tests
- `GET /` gives `index.html` with no-cache.
- `GET /?flow=1` gives `index.html`.
- `GET /assets/app-abc.js` gives the file, with the immutable header.
- `GET /sw.js` gives no-cache.
- `GET /missing.js` gives 404, and `GET /some/route` gives `index.html`.
- `GET /api/nope` is **not** served by static (404 from the app, never `index.html`).
- `GET /../package.json` and `GET /%2e%2e/package.json` give 404.
- `POST /` is not served by static.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree, after `bun install` following any merge of `main`.
- If Docker is installed:
  1. `docker build -t snaplab .` succeeds;
  2. `docker run -p 8080:8080 -e MODE=fixtures snaplab` serves `/` and `/healthz`;
  3. `/?flow=1&golden=note1` loads.
  If Docker is not installed, say so. Then, with no Docker: build the web app, temporarily mount `mountWebDist` in a scratch script (not committed) that imports `createApp`, and curl `/`, `/assets/…` and `/healthz`.
- `docker history` or the build log shows no `.env` file copied.
- The PR `muse/deploy-fly` → `main` starts with the Muse Code line from AGENTS.md, has its counts checked against the branch, and lists under "Needs from lead" the lines that mount `mountWebDist` in `apps/api/src/index.ts` or `app.ts` (after all API routes) and any `env.ts` addition (e.g. `WEB_DIST_DIR`).

## Implementer
Muse Code (fresh session). The lead wires `mountWebDist`, updates docs/05, and helps the user deploy.
