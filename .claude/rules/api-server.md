---
paths:
  - "apps/api/**"
---
# API server code (loads only when these files are touched)

- Bun + Hono. Routes: `POST /api/snap` (SSE), `POST /api/mark`, `GET /ws/examiner`, `POST /api/preview`, `GET /healthz`.
- The key is read once from `process.env.MODEL_API_KEY` in one module. Never log it, never return it, never put it in an error message or a fixture. Redact `Authorization` headers in any request logging.
- SSE (`streamSSE`): events in the order of docs/04 §4.3, ending in `done` or `error{stage, fallback}`. Every Meta call has a timeout and an abort signal tied to the client disconnect. A failed stage sends `error` with its fallback and the stream continues where it can.
- Validate every model response against the schema in `packages/contracts` before use, then clamp values to physical ranges. Never pass raw model output to the client or the engine.
- SAM 3.1 returns special-token text, not JSON: parse with `@meta-sam/parser`. Boxes are in source pixels; convert to 0–1 page coordinates in one function.
- Realtime voice relay: the key goes in the first JSON message to Meta (not the header), within 10 s. Audio is raw PCM16 mono 16 kHz, paced in real time. The browser never talks to Meta directly.
- Recording mode: when `RECORD_FIXTURES=1`, write each raw Meta response to `fixtures/` with the request id. Tests and offline dev replay from `fixtures/`. Don't hand-edit fixtures; re-record.
- Check unfamiliar Meta request or response shapes with the `api-verifier` agent before coding them.
