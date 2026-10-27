# Quality tiers, performance step-down and context-loss recovery

## Goal
Keep the 3D lab smooth on a low-end Android phone and rich on a laptop (docs/05 §3, docs/08 risk 7, docs/04 §8). Choose a quality tier (`low` / `mid` / `high`) from the GPU name, device memory, CPU cores and a 2-second warm-up FPS sample. Step down when the frame rate drops. Offer "Tap to reload the scene" after a WebGL context loss. Flag when the phone should switch to Lite mode (2D).

## Out of scope
- Lite mode itself (the 2D renderer), the lab scene, the kits and post-processing. They will read the settings this slice exposes; nothing here changes them.
- Any science, marks or network calls. New dependencies (drei's `PerformanceMonitor` is already installed).

## Files
All under `apps/web/src/quality/`. Owner: **Muse Code**, branch `muse/quality-tiers`, worktree `~/Desktop/SnapLabNG-muse`.
- `tier.ts` (pure, no DOM):
  - `chooseTier(signals: DeviceSignals): QualityTier`, with the rules below.
  - `settingsFor(tier): QualitySettings`.
  - `stepDown(tier)`: high → mid → low → low.
  - `parseOverride(search: string): QualityTier | null` reads `?quality=low|mid|high`; any other value gives null.
  Import `QualityTier` from `../apparatus/meter-bridge/types`, without copying it.
- `signals.ts`: `readDeviceSignals(): DeviceSignals`.
  - It gets the unmasked GPU renderer string from a throwaway WebGL2 context through `WEBGL_debug_renderer_info`, then releases that context with `WEBGL_lose_context`.
  - It reads `navigator.deviceMemory` (null where missing), `navigator.hardwareConcurrency` and a mobile check (`matchMedia("(pointer: coarse)")`).
  - Every read is wrapped so a missing API gives null, never a throw.
- `warmup.ts`: `measureWarmupFps(ms = 2000): Promise<number>` counts `requestAnimationFrame` frames.
- `QualityProvider.tsx` + `useQuality()`: a context of `{ tier, settings, stepDown(), liteSuggested }`.
  - The tier comes from the URL override if one is given; otherwise from `chooseTier` once signals and warm-up are in.
  - Until then, it is `mid`.
- `QualityMonitor.tsx`: goes inside a `<Canvas>` and wraps drei's `PerformanceMonitor`.
  - `onDecline` calls `stepDown()`, at most once every 3 s.
  - When the tier is already `low` and the frame rate stays under 20 fps for 5 s, it sets `liteSuggested`.
- `ContextLossOverlay.tsx`: given the canvas element, it listens for `webglcontextlost` and `webglcontextrestored`. While the context is lost it shows a full-size overlay with a button, "Tap to reload the scene". The button calls an `onReload()` prop, which the parent uses to remount its `<Canvas>` with a new `key`.
- `QualityPreview.tsx`: a page for `?quality=1`.
  - It shows the detected signals, the chosen tier and its settings.
  - It runs a stress scene of a few hundred instanced meshes inside the monitor, with "Step down", "Simulate context loss" (`WEBGL_lose_context.loseContext()`) and "Restore" buttons.
  - It sets `window.__SNAPLAB_READY__ = true` after the first frame (reuse `apps/web/src/scene/ReadySignal.tsx` if it exists).
- `quality.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?quality=1` switch, keeping every other switch.

## Contract (exact)
```ts
export interface DeviceSignals {
  gpu: string | null;            // unmasked renderer, e.g. "Mali-G52", "Apple M2", "ANGLE (NVIDIA ...)"
  deviceMemoryGb: number | null;
  cores: number | null;
  isMobile: boolean;
  warmupFps: number | null;
}
export interface QualitySettings {
  dpr: [number, number];   // min, max device pixel ratio for <Canvas dpr>
  bloom: boolean;
  shadows: boolean;
  maxParticles: number;    // cap for current-flow and drip particles
  physicalGlass: boolean;  // MeshPhysicalMaterial transmission; false = fake glass
  segments: number;        // curve and cylinder segments multiplier, 0.5 / 0.75 / 1
}
```
Rules for `chooseTier`, checked in this order:
1. `warmupFps` under 30, or `deviceMemoryGb` of 3 or less, gives `low`.
2. A weak GPU gives `low`. That is a GPU string matching (case-insensitive) `PowerVR`, `Mali-G5\d`, `Mali-G3\d`, `Mali-T`, `Adreno \(TM\) [3-5]\d\d`, `Adreno \(TM\) 6[0-1]\d` or `Intel(R) HD Graphics`.
3. `warmupFps` under 50 gives `mid`.
4. Mobile gives `mid`.
5. Otherwise `high`.

Settings:
- `low` = `{ dpr: [1, 1], bloom: false, shadows: false, maxParticles: 150, physicalGlass: false, segments: 0.5 }`
- `mid` = `{ dpr: [1, 1.5], bloom: true, shadows: false, maxParticles: 400, physicalGlass: false, segments: 0.75 }`
- `high` = `{ dpr: [1, 2], bloom: true, shadows: true, maxParticles: 1000, physicalGlass: true, segments: 1 }`

## Tests (`bun run --filter @snaplab/web test`)
- `chooseTier`:
  - "Mali-G52" on a phone with 4 GB and 60 fps gives `low`;
  - "Apple GPU" on a phone at 60 fps gives `mid`;
  - "ANGLE (NVIDIA GeForce RTX 3060…)" on a laptop at 60 fps gives `high`;
  - a laptop at 40 fps gives `mid`;
  - any device at 25 fps gives `low`;
  - 2 GB memory gives `low`;
  - all-null signals on a laptop give `high`.
- `settingsFor("low")` has `dpr [1, 1]`, bloom off and no physical glass. Each step up allows more particles than the one below.
- `stepDown` goes high → mid → low and stays at low.
- `parseOverride("?quality=low")` gives `low`, and `"?quality=ultra"` gives null.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree, after `bun install` following any merge of `main`.
- On port 5176, `bun run shot -- --route "/?quality=1" --base http://localhost:5176` renders on phone and laptop with no console errors. The signals and tier are shown. "Simulate context loss" shows the overlay, and "Tap to reload the scene" brings the scene back.
- `.claude/rules/web-3d.md` holds: no allocations in `useFrame`, and everything created is disposed (including the throwaway context in `signals.ts`).
- The quality code stays out of the initial bundle, except `tier.ts`, which is tiny and pure.
- PR `muse/quality-tiers` → `main`. The body starts with the Muse Code line from AGENTS.md, and its counts are checked against the branch.

## Implementer
Muse Code (fresh session). The lead later wires `useQuality()` into the lab scene, the kits' `quality` prop, `<Canvas dpr>` and bloom.
