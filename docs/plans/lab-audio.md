# Lab sounds (procedural Web Audio)

## Goal
The bench should sound like a school lab: a soft click when the galvanometer reaches the null, a hard knock when the needle slams against its stop, a scrape when the jockey is dragged, the clack of a plug going in or out, and the key closing. All of it is synthesised with standard Web Audio nodes, with no audio files (docs/04 §3 `audio`, docs/09 Day 4 "Sounds (click at null)", docs/15 §2).

## Out of scope
- Deciding *when* a sound plays. The lead's bench code calls these functions from the engine's events (balance reached, `needle.slammed`, scrape added, plug or key toggled). The module only makes sounds.
- Titration sounds (drip, glass ting), music, speech.
- New dependencies or audio files.

## Files
All under `apps/web/src/audio/`. Owner: **Muse Code**, branch `muse/lab-audio`, worktree `~/Desktop/SnapLabNG-muse`.
- `labAudio.ts`: `createLabAudio(): LabAudio`, which creates one `AudioContext` lazily on the first `unlock()` (call it from a user gesture; required on iOS Safari).
  ```ts
  export interface LabAudio {
    unlock(): Promise<void>;          // resume the context from a tap or click
    nullClick(): void;                // soft, short tick: needle settles at zero
    needleSlam(intensity: number): void; // 0–1, louder and lower for harder hits
    scrape(durationS: number): void;  // filtered noise burst, gritty, 0.1–1.5 s
    plug(inserted: boolean): void;    // brass-on-brass clack, higher pitch when pulled out
    keyToggle(closed: boolean): void;
    setMuted(muted: boolean): void;
    dispose(): void;                  // close the context
  }
  ```
  Each sound is a few nodes (oscillator, noise buffer, biquad filter, gain envelope) built on demand and disconnected when it ends. One shared noise `AudioBuffer` is made once. Master gain is about −12 dB. Never clip: keep peaks ≤ 0.8 after the master gain.
- `envelopes.ts`: pure helpers, unit-tested without a browser.
  - `adsr(t, a, d, s, r, holdS)` returns the gain at time t.
  - `slamParams(intensity)` returns `{ freqHz, gain, decayS }`. These are monotonic: harder means louder, lower and longer, clamped to [0, 1] intensity.
  - `scrapeParams(durationS)` returns a clamped duration and a filter Q.
  - `makeNoise(length, seed)` returns a deterministic Float32Array in [−1, 1], with a seeded PRNG and no `Math.random`.
- `AudioPreview.tsx`: a page for `?audio=1`. It has a big "Tap to enable sound" button (calls `unlock`), then one button per sound, an intensity slider for the slam and a mute toggle.
- `envelopes.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?audio=1` switch.

## Tests
- `adsr`: 0 at t=0; peak 1 at t=a; s during the hold; 0 after the release; never negative or above 1.
- `slamParams`: intensity 0.2 vs 0.9 gives a higher gain, a lower frequency and a longer decay for 0.9. Out-of-range input is clamped (−1 → same as 0, 2 → same as 1).
- `makeNoise(1024, 7)` is identical on two calls, differs for seed 8, and stays within [−1, 1].

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass. Audio is in a lazy chunk, and the initial bundle is unchanged.
- On port 5176, `bun run shot -- --route "/?audio=1" --base http://localhost:5176` renders the preview with no console errors. No sound plays before the unlock tap.
- Each button makes its sound in Chrome and Safari (the user checks by ear). No clicks or pops at note ends (each envelope ends with a short release).
- The PR description lists only what is in the branch, with counts checked against the test output, and has no AI attribution.

## Implementer
Muse Code (Meta's coding agent), in its own worktree. The lead wires it to the engine events afterwards. It's logged in the BUILD_LOG as built with Muse Code.

## Risks
- iOS Safari keeps the context suspended → `unlock()` must run inside the tap handler, and the preview shows a clear "tap to enable" state.
- Too many simultaneous scrapes → cap at 4 live voices and drop the oldest.
