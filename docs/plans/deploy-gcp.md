# Deploy: Google Cloud (Cloud Run API + Firebase Hosting site), Nov 2

Replaces `docs/plans/deploy-fly.md` (the user's call, Nov 2: everything on Google Cloud, SnapLab in its own project,
the front end on the best free host: Firebase Hosting).

## Goal
A public SnapLab for judges, free at judging traffic:
- **Site** on **Firebase Hosting** (Google's CDN): the built Vite app from `apps/web/dist`, at
  `https://<project>.web.app`. Fast first load of the ~10 MB of 3D assets anywhere, Nigeria included.
- **API** on **Cloud Run** (`snaplab-api`, region `us-east1`), built from the existing `Dockerfile`:
  `/api/snap`, `/api/question`, `/api/examiner` (SSE and JSON) and `/ws/examiner` (WebSocket), reading photos
  **live** with Meta (`MODE=live`, the user's call). The key lives only in Secret Manager.
- The spend ledger (the $20 / $5-a-day cap) survives restarts on a Cloud Storage volume.

## Verified facts (docs.cloud.google.com, firebase.google.com, Nov 2)
- Cloud Run free tier (request-based billing): 2M requests, 180,000 vCPU-s, 360,000 GiB-s, 1 GB North America egress
  a month. Request timeout up to 3600 s (default 300). WebSockets supported (the timeout applies per connection).
  Instances share no state, so `--max-instances 1` keeps the in-memory rate limit and cache correct.
- `gcloud run deploy --source .` builds our Dockerfile in Cloud Build (2,500 free build-min/month) into Artifact
  Registry (0.5 GB free; our image may cost pennies above that).
- Cloud Storage volume mount: `--add-volume name=data,type=cloud-storage,bucket=…` + `--add-volume-mount
  volume=data,mount-path=/data`; no locking, last write wins (one instance, whole-file writes: fine). Always Free
  5 GB in us-east1/us-west1/us-central1, 5,000 Class A ops/month (one ledger write per Meta call).
- Secret Manager: 6 active versions and 10,000 accesses a month free; `--update-secrets` maps the key's env var to secret `model-api-key`, version 1.
- Firebase Hosting free quota: 10 GB storage, 360 MB/day transfer (~36 first visits a day; repeat visits use the
  browser cache, assets are immutable). Its Cloud Run rewrites time out at 60 s and are not used: the site calls the
  API on its own `run.app` address, so the 40 s Meta read and the WebSocket never pass through Hosting.
- The deeepsolve.com organisation already allows public Cloud Run services (`allUsers` → `roles/run.invoker`).

## Code changes (one PR, `claude/deploy-gcp`)
1. Web `apps/web/src/apiOrigin.ts`: `apiUrl(path)` and `wsUrl(path)` from `import.meta.env.VITE_API_ORIGIN`
   (a public URL, not a secret; unset = same origin, so dev and E2E are unchanged). Used by
   `pipeline/snapClient.ts`, `snapq/client.ts`, `examiner/examinerClient.ts`, `examiner/voice/useVoiceAnswer.ts`.
   The PWA's `/api` bypass also matches the API origin.
2. API: CORS on `/api/*` for the origins in `ALLOWED_ORIGINS` (comma list; `hono/cors`, already in Hono), and the
   same check on the `/ws/examiner` upgrade's `Origin`. Unset = same-origin only, as today.
3. Client IP: Cloud Run sends `X-Forwarded-For`; the code reads its **last** entry when `TRUST_PROXY=1` (Google appends the real client; the first entry can be forged)
   (comments drop the Fly wording).
4. `Dockerfile`: the entrypoint's `chown /data` must not fail on a Cloud Storage mount (mounted with uid/gid 1000).
   `fly.toml` is removed.
5. `firebase.json` + `.firebaserc`: public `apps/web/dist`, SPA fallback to `/index.html`, `Cache-Control` immutable
   for `/assets/**`, `no-cache` for `index.html`, `sw.js`, `manifest.webmanifest`.
6. Docs: `docs/05` hosting row, `docs/plans/deploy-fly.md` marked superseded, BUILD_LOG.
Tests: `apiUrl`/`wsUrl` with and without the origin; CORS allows a listed origin, refuses another, and is off when
unset; the WS origin check. The four checks and the five E2E scripts pass unchanged.

## Deploy steps (lead runs them, after the user approves; the user does only the key)
1. `gcloud projects create snaplab-ng-<suffix>` (under the organisation), link billing account
   `01365C-150891-11A576`, enable run, cloudbuild, artifactregistry, secretmanager, storage, firebasehosting.
2. Bucket `gs://snaplab-ng-<suffix>-data` in `us-east1`; grant the Cloud Run service account
   `roles/storage.objectUser` and `roles/secretmanager.secretAccessor`; Cloud Build account `roles/run.builder`.
3. **User:** stores the key in Secret Manager as `model-api-key` without printing it (the one-line command is given
   in chat: it pipes only the key's value from the server env file into `gcloud secrets create --data-file=-`).
4. `gcloud run deploy snaplab-api --source . --region us-east1 --allow-unauthenticated --max-instances 1
   --timeout 300 --memory 512Mi --update-secrets <the key's env var>=model-api-key:1
   --set-env-vars MODE=live,TRUST_PROXY=1,SPEND_LEDGER_PATH=/data/ledger.json,ALLOWED_ORIGINS=https://<project>.web.app,https://<project>.firebaseapp.com
   --add-volume name=data,type=cloud-storage,bucket=<bucket>,mount-options="uid=1000;gid=1000"
   --add-volume-mount volume=data,mount-path=/data`; then `curl <run.app>/healthz`.
5. `firebase projects:addfirebase snaplab-ng-<suffix>`; build with `VITE_API_ORIGIN=<run.app URL> bun run build`;
   `firebase deploy --only hosting --project snaplab-ng-<suffix>`.
6. Smoke test in Chrome on `https://<project>.web.app`: home + welcome voice, Watch, Practise, Exam, Snap your
   question → Try a sample (live, ~40 s), the metre bridge snap, the examiner's voice; screenshots to the user.

## Cost and cold starts
- Free at judging traffic. Beyond the free tiers: Cloud Run egress ~$0.12/GB, Hosting $0.15/GB, Meta ~5 cents per
  question read (capped at $5 a day by the ledger).
- With `--min-instances 0` the first request after ~15 idle minutes waits for a cold start (a few seconds). On judging
  day `--min-instances 1` keeps one instance warm, billed at the idle rate; turn it back to 0 afterwards.

## Done when
The judges' URL loads the site from Firebase Hosting, every mode runs, a snapped question is read live, the examiner
voice works, `/healthz` reports `mode: live`, the key is only in Secret Manager, and the ledger survives a redeploy.
