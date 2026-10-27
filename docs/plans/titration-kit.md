# Titration 3D kit (procedural apparatus)

## Goal
Build the titration second act's apparatus as procedural three.js / React Three Fiber components. That is: a retort stand and burette clamp, a 50 cm³ burette with its stopcock and funnel, a 250 cm³ conical flask on a white tile, a 25 cm³ pipette and a beaker. Like the metre bridge kit (`docs/plans/meter-bridge-kit.md`, PR #3), the kit only draws and reports the student's actions. The engine decides every number and colour (docs/15 §1 and §3, docs/07 §2, docs/04 §3 `apparatus`).

## Out of scope
- Any chemistry: no pH, no indicator colour logic, no drop volumes, no end point. The kit draws the colour and volumes the engine writes.
- Custom GLSL (the indicator swirl blend is the lead's, later), the reveal choreography, the desk, camera moves, Zustand stores.
- Marking, the notebook and parallax physics. The kit only exposes the meniscus position.
- New dependencies. If one is truly needed, ask under "Needs from lead" in the PR.

## Files
All under `apps/web/src/apparatus/titration/`. Owner: **Gemini**, branch `gemini/titration-kit`, worktree `~/Desktop/SnapLabNG-gemini`.
- `types.ts`: the contract below, exactly. Import `QualityTier` from `../meter-bridge/types`, without copying it.
- `dimensions.ts`: every real size in metres, plus these pure helpers:
  - `volumeToY(cm3)` gives the height of the meniscus on the burette for a reading. 0 cm³ is at the top graduation and 50 cm³ at the bottom. Readings are clamped to 0–50.
  - `yToVolume(y)` is its inverse, also clamped.
  - `flaskLiquidHeight(cm3)` gives the liquid height in the conical flask from its frustum geometry. It is 0 for 0 cm³ and increases with volume.
- `Burette.tsx`:
  - a glass tube with the graduations on the front: a tick every 0.1 cm³, longer ticks every 1 cm³, and numbers every 1 cm³ from 0 at the top;
  - the liquid column down to the meniscus at `state.buretteReadingCm3`, with a visible concave meniscus;
  - the stopcock, turned by `state.stopcockOpen`, and the jet;
  - a falling drop when `state.dropping`.
- `Funnel.tsx`: a small filter funnel in the top of the burette, drawn only when `state.funnelOn`.
- `ConicalFlask.tsx`: a 250 cm³ conical flask holding `state.flaskVolumeCm3` of liquid. The liquid colour is `state.flaskColor`, and the liquid surface wobbles with `state.swirlPhase`.
- `RetortStand.tsx`: a heavy base, a rod, and a burette clamp holding the burette upright over the flask.
- `WhiteTile.tsx`, `Pipette.tsx` (25 cm³ bulb pipette lying on the bench) and `Beaker.tsx`.
- `TitrationKit.tsx`: lays everything out on the bench, with the jet tip about 2 cm inside the flask's mouth. It is the default export.
- `KitPreview.tsx`: a standalone `<Canvas>` with lights, `OrbitControls` and the kit, driven by a small demo state:
  - holding the stopcock lowers the burette reading at about 0.05 cm³ per drop and fills the flask;
  - the colour fades from pink to colourless as the reading passes 24.00 cm³ (a stand-in for the engine; comment it as such);
  - a "Swirl" button runs the wobble;
  - a "Funnel" button takes the funnel on and off.
  It sets `window.__SNAPLAB_READY__ = true` after the first frame (reuse `apps/web/src/scene/ReadySignal.tsx` if it exists on `main`).
- `dimensions.test.ts`.
- `apps/web/src/App.tsx`: add only a switch so that `?kit=titration` lazy-loads this `KitPreview`, keeping every other switch.

## Contract (exact)
```ts
// apps/web/src/apparatus/titration/types.ts
import type { QualityTier } from "../meter-bridge/types";

/** Written by the engine loop, read by the kit inside useFrame. Never React state. */
export interface TitrationVisualState {
  buretteReadingCm3: number;  // reading at the bottom of the meniscus, 0 (top) … 50
  stopcockOpen: number;       // 0 closed … 1 fully open
  dropping: boolean;          // a drop is falling from the jet now
  flaskVolumeCm3: number;     // liquid in the conical flask, 0 … 250
  flaskColor: [number, number, number]; // linear RGB 0–1, written by the engine
  swirlPhase: number;         // 0 … 1 while swirling, 0 at rest
  funnelOn: boolean;
}

export interface TitrationKitProps {
  state: { current: TitrationVisualState }; // a ref, mutated in place
  quality: QualityTier;
  onStopcockChange?: (open: number) => void; // press-and-hold or drag on the stopcock, 0…1
  onSwirl?: () => void;                      // tap on the flask
  onFunnelToggle?: () => void;               // tap on the funnel or the burette top
}
```
- Units: 1 scene unit = 1 m. The origin is on the bench top, under the flask's centre. The kit never assumes the desk's size.
- Real sizes:
  - burette ≈ 0.75 m long, 11 mm bore, graduated length ≈ 0.50 m for 50 cm³;
  - conical flask: base ≈ 85 mm across, ≈ 140 mm tall, neck ≈ 35 mm;
  - white tile ≈ 150 mm square;
  - retort stand rod ≈ 0.9 m;
  - 25 cm³ pipette ≈ 0.45 m.
- Graduations are on the front of the burette, facing the camera. The bottom of the meniscus sits on the reading (docs/15 §3).

## Tests (`bun run --filter @snaplab/web test`)
- `volumeToY(0)` is the top graduation and `volumeToY(50)` the bottom one. Readings increase downwards.
- `yToVolume(volumeToY(24.35))` is 24.35 within 1e-9.
- Both functions clamp: `volumeToY(-1) === volumeToY(0)` and `volumeToY(60) === volumeToY(50)`.
- `flaskLiquidHeight(0) === 0`. It increases strictly for 10, 50, 100 and 250 cm³. It stays below the flask's body height at 250 cm³.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree, after `bun install` following any merge of `main`.
- On port 5174, `bun run shot -- --route "/?kit=titration" --base http://localhost:5174` saves phone and laptop shots where every piece is visible, nothing is black, clipped or z-fighting, the graduations can be read when zoomed, and the console has no errors.
- Holding the stopcock in the preview lowers the meniscus and fills the flask. Swirl wobbles the liquid. Funnel toggles.
- `.claude/rules/web-3d.md` holds:
  - no allocations inside `useFrame`;
  - geometry and materials created once and disposed;
  - `low` quality uses no `MeshPhysicalMaterial` transmission (fake glass instead) and fewer segments.
- The kit stays in the lazy chunk.
- UI text uses Nigerian naming if any chemical is named, e.g. trioxocarbonate(IV), tetraoxosulphate(VI).
- PR `gemini/titration-kit` → `main`, body as in AGENTS.md, counts checked against the branch, no AI attribution.

## Implementer
Gemini (fresh session). The lead adds the titration engine and wires the kit to it.
