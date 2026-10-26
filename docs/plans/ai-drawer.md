# "Show the AI" drawer

## Goal
A drawer, opened by a persistent "Show the AI" toggle at the top right, that shows judges what each Meta model did on this page and how long it took. It has one lane per model with live timing bars, a request/response viewer for every call, a deterministic-engine lane, and the line **"The AI reads and judges. The engine decides."** Sources: docs/03 (Use of Meta AI, 25% of the score; the toggle), docs/04 §3 `ai-drawer`, docs/10 shots 0:28 and 2:15.

## Out of scope
- Producing the trace. The lead's `/api/snap` stream and golden replays will fill it. Here it comes in through props, and the preview uses a hard-coded mock.
- The SSE client, Zustand, routing.
- Any number computed against the teacher's value, or the true X. The drawer only shows what the trace contains.
- New dependencies. Plain React, CSS-in-JS objects or a `.module.css` file, and no chart library.

## Files
All under `apps/web/src/ai-drawer/`. Owner: Gemini, branch `gemini/ai-drawer`, worktree `~/Desktop/SnapLabNG-gemini`.
- `types.ts`: the contract below, exactly.
- `timeline.ts`: pure helpers, unit-tested:
  - `laneSpans(trace, nowMs)` gives each call's bar as `{ leftPct, widthPct }` on a shared time axis from `trace.t0Ms` to `max(nowMs, last end)`. A running call stretches to `nowMs`.
  - `formatMs(ms)`: `"840 ms"` under 1 s, `"1.24 s"` from 1 s up.
  - `summarise(trace)`: totals per lane, how many calls, the longest call, and whether any call fell back.
  - `redactForDisplay(value)`: deep-copies JSON, replaces any string longer than 2,000 characters or starting with `data:` (images, audio) with `"[image 182 KB]"` or `"[text 5,321 chars]"`, and removes any key named like `key`, `authorization` or `api_key` (case-insensitive) at any depth.
- `AiDrawer.tsx`: default export, `props: { trace: AiTrace; nowMs: number; open: boolean; onClose(): void }`. A bottom sheet on phones (≤ 768 px wide, up to 70% of the height, drag handle) and a right-side panel on laptops (420 px). Inside: the motto, then one lane per `LaneId` in a fixed order (Spark, SAM, Wonder, Voice, Engine) with the model name and bars, then the flags list. Tapping a bar opens `CallDetail`.
- `CallDetail.tsx`: model, label, status, duration, and the request and response as collapsible, pretty-printed JSON after `redactForDisplay`, with a "copy" button.
- `ShowAiToggle.tsx`: a small fixed pill at the top right, labelled "Show the AI". It shows a pulsing dot while any call is running. `props: { running: boolean; onClick(): void }`.
- `mockTrace.ts`: a realistic metre bridge trace built from docs/04 §2 ② and docs/06 (Spark compile, about 6 SAM calls in parallel, Wonder readings, engine items such as "circuit solve" and "rule engine: 9 rules"), with plausible timings (Spark streaming 2–4 s, SAM 0.6–1.5 s each, Wonder 3–6 s) and one flag: "galvanometer type not written → centre-zero assumed". It contains no real student data.
- `DrawerPreview.tsx`: a page for `?drawer=1`. It replays `mockTrace` against a clock that starts at 0 (one `requestAnimationFrame` loop that updates `nowMs` at most 10 times a second), shows the toggle and the drawer, and has a "Replay" button.
- `timeline.test.ts`: the tests below.
- `apps/web/src/App.tsx`: add only a lazy `?drawer=1` switch, next to the existing `?kit=` and `?capture=` switches.

## Contracts (exact)
```ts
// apps/web/src/ai-drawer/types.ts
export type LaneId = "spark" | "sam" | "wonder" | "voice" | "engine";
export type CallStatus = "running" | "ok" | "fallback" | "error";

export interface AiCall {
  id: string;
  lane: LaneId;
  model: string;        // e.g. "muse-spark-1.3", "sam-3.1", "muse-wonder-1.0"; "engine" for the engine lane
  label: string;        // what it did, e.g. "Blueprint compile", "Outline: galvanometer", "circuit solve"
  startMs: number;      // absolute, same clock as AiTrace.t0Ms
  endMs: number | null; // null while running
  status: CallStatus;
  request: unknown;     // JSON as sent (the drawer redacts before showing)
  response: unknown;    // JSON as received, or null while running
  note: string | null;  // e.g. "fallback: boxes from Spark"
}

export interface AiFlag { lane: LaneId; message: string }

export interface AiTrace {
  t0Ms: number;
  calls: AiCall[];
  flags: AiFlag[];
}
```

## Tests (`bun run --filter @snaplab/web test`)
- `laneSpans`: two calls 0–1000 and 500–2000 ms with `nowMs` 2000 give `{0, 50}` and `{25, 75}` (left, width in %), within 1e-9. A running call (endMs null) at `nowMs` 3000 stretches to the right edge.
- `formatMs(840)` is `"840 ms"`, `formatMs(1240)` is `"1.24 s"` and `formatMs(0)` is `"0 ms"`.
- `summarise` counts calls per lane, finds the longest, and reports `anyFallback` true when one call has status `"fallback"`.
- `redactForDisplay` replaces a `data:image/jpeg;base64,…` string with `"[image N KB]"`, removes `Authorization`, `api_key` and nested `apiKey` keys, keeps short strings and numbers, and doesn't mutate its input.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree. The initial chunk stays ≤ 350 KB gzip, and the drawer is lazy.
- On port 5174: `bun run shot -- --route "/?drawer=1" --base http://localhost:5174` shows the toggle and the open drawer, with no console errors, on both phone (bottom sheet) and laptop (side panel).
- Keyboard: the toggle and every bar are reachable with Tab and open with Enter, and Escape closes the drawer. Text contrast meets WCAG AA.
- The drawer never shows a key: `redactForDisplay` is applied before anything is rendered.
- The PR description describes only what is in the branch, and every count and name in it is checked against the code. No AI attribution.

## Implementer
Gemini, in its worktree. The lead wires it to the real `/api/snap` stream later.

## Risks
- Long JSON makes the drawer slow → render request and response collapsed, expand on demand, and cap displayed JSON at 20,000 characters with "show more".
- Phone sheet gestures conflict with the 3D canvas → the sheet stops pointer propagation, and the canvas never sits under an open sheet's drag handle.
