# Metre bridge 3D kit (procedural apparatus)

## Goal
Build the hero's apparatus as procedural three.js / React Three Fiber components: the metre bridge (wooden base, metre rule, 100 cm wire, copper strips with the two gaps, jockey), the brass plug resistance box, the centre-zero galvanometer, the Leclanché cell, the plug key and the connecting tube wires. The kit only draws and reports taps. The engine decides everything (docs/15 §2, docs/04 §3 `apparatus`, docs/07 §4).

## Out of scope
- Any science: no currents, no balance point, no needle physics, no polarisation, no scrape effect on resistance. The kit reads numbers the engine writes and calls back when the student acts.
- Current-flow particles, glow and any custom GLSL (lead, later, driven by the engine's branch currents).
- The reveal choreography, the desk, the page, camera moves, Zustand stores, routing beyond the preview switch below.
- Titration and glass block kits.
- New dependencies. If one is truly needed, ask under "Needs from lead" in the PR.

## Files
All under `apps/web/src/apparatus/meter-bridge/` unless noted. Owner: Gemini, on branch `gemini/meter-bridge-kit`, in the worktree `~/Desktop/SnapLabNG-gemini`.
- `types.ts`: the props and visual-state types below, exactly.
- `dimensions.ts`: every real-world size in one place (metres), plus `cmToX(cm)` and `xToCm(x)` (clamped to 0–100 cm).
- `MeterBridge.tsx`: base, metre rule with cm and mm ticks and numbers every 10 cm, the wire, the thick copper strips (L-shaped ends and a middle strip) with the left gap labelled R and the right gap labelled X, binding-screw terminals, and the jockey.
- `Jockey.tsx`: knife-edge contact on an insulated handle. It sits at `state.jockeyCm` and lowers onto the wire when `state.jockeyDown`.
- `PlugBox.tsx`: ebonite-topped box, brass blocks, tapered brass plugs with black heads, one per entry in `plugLabels`. A plug that is out is drawn lying beside the box.
- `Galvanometer.tsx`: centre-zero dial (−30 … 0 … +30), glass cover, needle at `state.needleDeg`.
- `LeclancheCell.tsx`: glass jar, porous pot, carbon rod and zinc rod with terminals.
- `PlugKey.tsx`: two brass blocks on a base and a plug, drawn in or out from `state.keyClosed`.
- `TubeWire.tsx`: a flexible insulated lead between two terminal anchors (`TubeGeometry` along a `CatmullRomCurve3` that sags a little).
- `MeterBridgeKit.tsx`: lays out all of the above on a bench and wires them as in docs/07 §4.1 (cell and key across A and C, plug box in the left gap, unknown in the right gap, galvanometer from B to the jockey). Default export.
- `KitPreview.tsx`: a standalone `<Canvas>` with lights, `OrbitControls` and the kit, driven by a small demo state (the needle sweeps slowly, clicks toggle plugs and the key, taps move the jockey). It sets `window.__SNAPLAB_READY__ = true` after the first frame (reuse `apps/web/src/scene/ReadySignal.tsx` if it exists on `main`).
- `dimensions.test.ts`: the tests below.
- `apps/web/src/App.tsx`: the one file outside the folder. Add only a switch: when `new URLSearchParams(location.search).get("kit") === "meter-bridge"`, lazy-load `KitPreview` instead of the normal scene. Nothing else changes there.

## Contracts (exact; the lead's engine loop will write `state` and listen to the callbacks)
```ts
// apps/web/src/apparatus/meter-bridge/types.ts
export type QualityTier = "low" | "mid" | "high";

/** Written by the engine loop every step, read by the kit inside useFrame. Never React state. */
export interface MeterBridgeVisualState {
  jockeyCm: number;        // 0–100, position along the wire from end A
  jockeyDown: boolean;     // true while the knife-edge touches the wire
  needleDeg: number;       // galvanometer needle angle; 0 = centre, ±45 = against the stops
  plugsIn: boolean[];      // same order as plugLabels; true = plug in (that coil shorted)
  keyClosed: boolean;
  scrapesCm: Array<[number, number]>; // dragged segments to draw as scratches, [fromCm, toCm]
}

export interface MeterBridgeKitProps {
  state: { current: MeterBridgeVisualState }; // a ref, mutated in place
  plugLabels: string[];                      // e.g. ["1", "2", "2", "5", "10"], drawn on the box as Ω values
  unknownLabel: string;                      // label on the right gap, e.g. "X"
  quality: QualityTier;
  onWireTap?: (cm: number) => void;          // pointer down and up on the wire with < 4 px movement
  onWireDrag?: (fromCm: number, toCm: number) => void; // pointer moved along the wire while down
  onPlugToggle?: (index: number) => void;
  onKeyToggle?: () => void;
}
```
- Units: 1 scene unit = 1 real metre. Origin at the centre of the top face of the metre bridge base. The wire runs along +x from x = −0.5 (0 cm, end A) to x = +0.5 (100 cm, end C), at the front edge, so `cmToX(cm) = cm / 100 − 0.5`. The lab scene scales and places the kit's root group; the kit never assumes the desk's size.
- Real sizes (the realism matters for teachers): base ≈ 1.10 × 0.03 × 0.15 m; wire diameter 0.5 mm, drawn no thinner than 1.5 px on screen; copper strips ≈ 20 mm wide, 3 mm thick; gaps ≈ 30 mm; galvanometer ≈ 0.12 m across; plug box ≈ 0.20 × 0.06 × 0.10 m; Leclanché jar ≈ 0.10 m across, 0.15 m tall.

## Tests (`bun run --filter @snaplab/web test`)
- `cmToX(0) === -0.5`, `cmToX(50) === 0`, `cmToX(100) === 0.5`.
- `xToCm(cmToX(37.4))` is 37.4 within 1e-9.
- `xToCm` clamps: `xToCm(-1) === 0`, `xToCm(1) === 100`.
- `plugLabels.length` sets the number of plugs: a pure layout helper (for example `plugPositions(n)`) returns n evenly spaced, non-overlapping x positions inside the box for n = 1, 5 and 8.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` all pass in the worktree.
- `bun run shot -- --route "/?kit=meter-bridge"` (with `bun run dev` running) saves phone and laptop shots in which every piece is visible, nothing is black, clipped or z-fighting, and the console has no errors. The shots or a description of them go in the PR.
- Tapping the wire in the preview moves the jockey to that point and lowers it. Dragging calls `onWireDrag` and draws a scratch. Clicking a plug or the key toggles it.
- `.claude/rules/web-3d.md` holds: no allocations inside `useFrame`, geometry and materials created once and disposed, `low` quality uses cheaper materials (no `MeshPhysicalMaterial` transmission, fewer segments).
- The 3D code stays in the lazy chunk: the initial bundle does not grow.
- PR `gemini/meter-bridge-kit` → `main`, body as in AGENTS.md, no AI attribution.

## Implementer
Gemini (second builder), in its own worktree. The lead reviews and merges. Not `implementer`: this runs in parallel with the lead's engine work, which is why it has its own worktree and owns only this folder plus the one-line preview switch in `App.tsx`.

## Risks
- Thin wire flickers or vanishes at phone resolution → draw it as a slightly thicker tube with a minimum on-screen width, or add a thin bright line on top.
- Too many draw calls (ticks, screws, plugs) → build the rule's ticks into one `CanvasTexture` and instance repeated parts (`InstancedMesh` or drei `Instances`).
- Pointer hit-testing on a 0.5 mm wire is impossible → use an invisible, wider hit box along the wire for `onWireTap` and `onWireDrag`.
