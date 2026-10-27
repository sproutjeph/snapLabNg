# Golden replay (record a real read, play it back offline)

## Goal
The demo must never fail (docs/04 §6), and schools with poor data need a lab that works offline. A golden replay is a recording of one real `/api/snap` event stream with its timings. Played back, it drives exactly the same screens (drawer, table, marking, bench) at the same pace, with no network. docs/09 MUST: "Golden notebooks G1 and G2 with recorded event streams".

## Out of scope
Server-side recording, the golden pages themselves (photos from the user), and wiring the player into the flow page and the default route (lead). Service-worker caching (PWA, later).

## Files
All under `apps/web/src/golden/`. Owner: **Muse Code**, branch `muse/golden-replay`, worktree `~/Desktop/SnapLabNG-muse`.
- `recorder.ts`: `createRecorder(meta: { id: string; title: string; page: { file: string; width: number; height: number } })`, which returns `{ push(event: SnapEvent): void; finish(): GoldenRecording }`. `at_ms` is measured from the first pushed event with an injectable clock (`now: () => number`, default `performance.now`). `finish()` validates with `GoldenRecording.parse` and throws a clear error if the stream didn't start with `accepted` or end with `done`.
- `replay.ts`: `replay(rec: GoldenRecording, opts: { signal: AbortSignal; speed?: number; sleep?: (ms: number, signal: AbortSignal) => Promise<void> }): AsyncGenerator<SnapEvent>`. It yields each event at its recorded time divided by `speed` (default 1). It stops promptly, without throwing to the consumer, when the signal aborts. `sleep` can be injected so tests run instantly.
- `load.ts`: `loadGolden(id: string, signal: AbortSignal): Promise<GoldenRecording>`. It fetches `/golden/<id>.json` and validates with `GoldenRecording.safeParse`, raising a clear error on failure.
- `download.ts`: `downloadRecording(rec)` saves the JSON as `<id>.json` through a temporary object URL and an `<a download>`, revoking the URL afterwards.
- `GoldenPreview.tsx`: a page for `?golden-preview=1`.
  - It builds a small synthetic recording in memory: accepted → mode → values → setup_issues → readings (two rows) → three timings → done, over about 3 s. Use the shapes in `packages/contracts/src/events.ts`, and copy no real fixture data.
  - It replays it with a speed control (0.5×, 1×, 4×), shows each event as it arrives with its time, and has "Download as JSON".
- `golden.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?golden-preview=1` switch.

## Contracts
`GoldenRecording` and `SnapEvent` from `@snaplab/contracts` (`packages/contracts/src/golden.ts`, added with this plan).

## Tests
- The recorder: with a fake clock giving 100, 250 and 900, `at_ms` comes out as 0, 150 and 800. `finish()` throws when the last event isn't `done`.
- `replay` with an injected `sleep`: it yields every event in order, and the sleep durations are the gaps between `at_ms` values divided by `speed` (speed 4 → quarter durations).
- `replay` stops after the current event when the signal aborts, without throwing.
- `GoldenRecording` rejects events that are out of time order.

## Done-criteria
- The four checks pass (after `bun install`). The golden code is lazy.
- On port 5176, the `?golden-preview=1` screenshot renders with no console errors, and a 4× replay finishes in under a second.
- The PR body starts with the Muse Code credit and has checked counts.

## Implementer
Muse Code. The lead records G1/G2 from real pages and wires the player into the app.

## Risks
- Timers drift on slow phones → schedule each event against the replay's start time, not cumulatively.
- Large recordings (with request/response bodies in `timing`) → fine for a few hundred KB, and served gzipped.
