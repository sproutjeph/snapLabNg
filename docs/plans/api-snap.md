# `/api/snap`: the read stage as a server-sent event stream

## Goal
Stage ② of docs/04 §2. The client posts the compressed, header-blurred photo. The server fans out to Spark (blueprint), SAM (outlines) and Wonder (readings) in parallel, validates every answer against `packages/contracts`, and streams `SnapEvent`s (docs/04 §4.3) as each arrives. The same stream comes from recorded fixtures offline, and from the golden set. A hard spend cap stops live calls before the credit runs out, because Meta's own limit only notifies (docs/01 §0 rule 9).

## Out of scope
`/api/mark`, `/ws/examiner`, `/api/preview`, deployment, the web client that consumes the stream (next plan). Streaming Spark token-by-token (later: first, a non-streamed call per model).

## Files (`apps/api`, lead)
- `package.json`: add `hono` with `bun add`, plus `dev` (`bun --hot src/index.ts`) and `start` scripts.
- `src/env.ts`: the only reader of `process.env`. Settings:
  - `MODEL_API_KEY` (required unless `MODE=fixtures`);
  - `MODE` = `live` | `fixtures` | `golden-only` (default `fixtures` in dev);
  - `RECORD_FIXTURES`;
  - `SPEND_CAP_USD` (default 20);
  - `SPEND_DAILY_CAP_USD` (default 5);
  - `SNAPS_PER_HOUR_PER_IP` (default 10).
  The key is never logged or returned.
- `src/meta.ts`: `callResponses(body, { signal, timeoutMs, name })`. It POSTs `/v1/responses` and returns `{ json, usage, latencyMs }`. In `fixtures` mode it reads `fixtures/<name>.json` instead of calling Meta. With `RECORD_FIXTURES=1` it writes the response, with images replaced by a size note. Errors carry the HTTP status but never the request headers.
- `src/spend.ts`: a price table (docs/06 §3: Spark $1.25/$4.25, Wonder $4/$20 per M tokens, SAM $2.50 per 1k images) and `costUsd(model, usage)`.
  - A ledger (`total`, today's total) is kept in memory and in `SPEND_LEDGER_PATH` (default `.spend/ledger.json`, gitignored; a JSON file, not a database).
  - `reserve(estimateUsd)` refuses when total + estimate would pass either cap. `settle(actualUsd)` records the actual cost.
  - Each snap reserves its worst case before calling. That's about $0.15, from today's measurements with a 1.5× margin.
- `src/rateLimit.ts`: an in-memory token bucket per IP.
- `src/cache.ts`: an LRU of finished event streams keyed by the photo's SHA-256 (50 entries).
- `src/snap.ts`: `runSnap(photo, emit, signal)`. It emits `accepted`, starts the three stages together, and for each stage: validate (zod), clamp, emit its events, then emit `timing`. A failed stage emits `error{stage, fallback}` and the rest continue. It ends with `done`.
  - SAM: one call per noun phrase from docs/06 §5.2, parsed with `@meta-sam/parser` (after the api-verifier check), boxes converted to 0–1 in one function. If SAM finds nothing, `sam_box`es come from the blueprint's approximate boxes, marked in `timing.note`.
  - The blueprint's `notes` field is dropped before sending, because it can echo the NAME/SCHOOL text.
- `src/index.ts`: the Hono app.
  - `GET /healthz` returns `{ ok, mode, spend: { total, today, caps } }`.
  - `POST /api/snap` takes multipart `photo` (JPEG ≤ 600 KB) and returns `streamSSE`, aborting upstream calls when the client disconnects.
  - Served with `Bun.serve`, with an idle timeout long enough for a 20 s stream.
- `src/*.test.ts`. The tests run on `fixtures/`, never the live API.

## Contracts
`SnapEvent` in `packages/contracts/src/events.ts` (added with this plan). Its `timing` event carries the request (image replaced by a note) and the validated response, which feed the "Show the AI" drawer directly. Consumers: `apps/api` (producer), and `apps/web` (pipeline and drawer, next plan).

## Tests (Vitest, fixtures only)
- `costUsd` on the recorded usage from `fixtures/spike/2026-10-26`: Wonder 4,064 in / 3,332 out → $0.0829. Spark blueprint 4,060 / 991 → $0.0093 (docs/06 §3 prices).
- The spend cap: with a $0.20 cap and $0.10 already spent, a $0.15 reserve is refused. The ledger survives a reload from its file.
- The rate limit: the 11th snap in an hour from one IP is refused, and a different IP isn't affected.
- `runSnap` in fixtures mode, on the recorded spike responses:
  - the events come in the §4.3 order and every event passes `SnapEvent.parse`;
  - `mode` is `meter_bridge`;
  - `readings` validates;
  - no event contains `notes`;
  - three `timing` events (spark, wonder, sam) and `done` come last.
- A stage whose fixture is malformed JSON emits `error{stage:"readings"}` and the stream still ends with `done`.
- `/healthz` never contains the key (the test sets a dummy key and searches the response).

## Done-criteria
- The four checks pass. Tests run offline.
- `MODE=fixtures bun run --filter @snaplab/api dev` serves the endpoint, and `curl -N -F photo=@page.jpg localhost:8787/api/snap` streams valid events.
- One live run costs ≤ ₦200 (≈ $0.15). Its cost is shown in `/healthz` and logged in the BUILD_LOG. The user gets the estimate before the live run.
- `code-reviewer`: ship.

## Implementer
Lead (SSE relay).

## Risks
- Spark takes 7.8 s and Wonder 13 s. The client shows the local reveal first (docs/04 §5). Streaming Spark comes next.
- If SAM finds nothing on sketches, fall back to Plan B/C (docs/06 §5.2), and the drawer says so honestly.
- Bun's default idle timeout closes long SSE streams. Set `idleTimeout` explicitly (to be verified).
