# Lite mode: the metre bridge in 2D (for phones that can't run the 3D lab)

## Goal
A flat, fast SVG metre bridge that works on any phone, even one with no WebGL or one that stays under 20 fps (docs/05 §3 "Lite mode (2D) if WebGL fails or the phone stays under 20 fps", docs/08 risk 7, docs/09 SHOULD). It runs the **same engine** through the same controller as the 3D kit, so it behaves the same:
- tap the wire to place the jockey;
- the needle swings;
- plugs and the key toggle;
- dragging along the wire scrapes it (the modelled mistake).

## Out of scope
- Any WebGL, canvas 3D, three.js or React Three Fiber import. Any science: every number comes from `createBenchController` (`apps/web/src/apparatus/meter-bridge/benchController.ts`).
- Switching to Lite automatically, and wiring it into the flow: the lead does that.
- New dependencies.

## Files
All under `apps/web/src/lite/`. Owner: **Gemini (Flash)**, branch `gemini/lite-mode`, worktree `~/Desktop/SnapLabNG-gemini`.
- `geometry.ts` (pure, no DOM). The SVG `viewBox` is `0 0 1200 700`, and the wire runs from x = 100 (0 cm) to x = 1100 (100 cm) at y = 420.
  - `cmToSvgX(cm)` and `svgXToCm(x)` convert between cm on the wire and SVG x, and both clamp to 0–100 cm.
  - `clientXToCm(clientX, rectLeft, rectWidth)` maps a pointer on the rendered SVG to cm on the wire. It uses the viewBox scale, so it works at any size.
  - `needleAngle(deg)` clamps to ±45°.
  - `isDrag(dxPx)` is true when the pointer has moved more than 4 px.
- `LiteBench.tsx`: the default export.
  - Props: `{ setup: BenchSetup; plugLabels: string[]; unknownLabel: string }`.
  - It creates one controller with `useState(() => createBenchController(setup))` and runs a `requestAnimationFrame` loop that calls `controller.advance(dtSeconds)` (dt capped at 0.1 s). Each frame it updates the SVG **through refs** (`setAttribute`), never React state: the needle's rotation, the jockey's x and whether it is down, plug states, the key state and new scrape segments. The loop is cancelled on unmount.
  - Drawing, with plain SVG shapes:
    - the wooden base;
    - the metre rule, with a tick every 1 cm, a longer one every 5 cm and numbers every 10 cm;
    - the wire, with A at the left end, C at the right and B at the middle copper strip;
    - the gaps labelled R (left) and the unknown label (right);
    - a plug box, with one button per `plugLabels` entry ("5 Ω") showing in or out;
    - the plug key, as a button showing open or closed;
    - a centre-zero galvanometer: a semicircular dial from −30 to +30, with ticks every 5 and a needle;
    - the jockey, a triangle over the wire that drops onto it when down;
    - scrapes, drawn as short dark-red segments on the wire.
  - Input on the wire's hit area (a transparent rect 60 px tall around the wire):
    - pointer down remembers the start;
    - pointer up without a drag calls `handlers.onWireTap(cm)`;
    - pointer move with a drag calls `handlers.onWireDrag(prevCm, cm)` for each move.
    Use `setPointerCapture`. Plugs and the key are real `<button>`s outside the SVG or `role="button"` groups with `tabIndex=0` and Enter/Space.
  - Text under the drawing: "Close the key, then tap the wire to find where the needle reads zero. Don't slide the jockey."
  - **It never shows X, a balance length or any computed value.** The needle is the only feedback.
- `LitePreview.tsx`: a page for `?lite=1` with the golden bench: coils `[1, 2, 2, 5, 10]`, plugs in `[false, true, true, true, true]` and `xOhm: 3`. Its labels are `["1", "2", "2", "5", "10"]` and its unknown label is "X". It sets `window.__SNAPLAB_READY__ = true` after mount.
- `lite.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?lite=1` switch, keeping every other switch.

## Tests (`bun run --filter @snaplab/web test`)
- `cmToSvgX(0) === 100`, `cmToSvgX(100) === 1100`, `cmToSvgX(50) === 600`, and `svgXToCm(cmToSvgX(37.5))` is 37.5 within 1e-9.
- Clamping: `svgXToCm(0) === 0` and `svgXToCm(1200) === 100`.
- `clientXToCm`: with the SVG drawn 600 px wide starting at clientX 20, clientX 320 (the middle) gives 50 cm.
- `needleAngle(80) === 45` and `needleAngle(-80) === -45`.
- `isDrag(3) === false` and `isDrag(5) === true`.
- With the controller (no DOM): after `onKeyToggle()`, `onWireTap(10)` and 20 calls of `advance(1/60)`, `visual.needleDeg` is not 0. It is the same check as `benchController.test.ts`, run through your module's exports if you wrap the controller.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass in the worktree, after `bun install` following any merge of `main`. The LitePreview chunk does **not** include three.js: check the build output, where it should be under 15 kB gzip.
- On port 5174, `bun run shot -- --route "/?lite=1" --base http://localhost:5174` saves phone and laptop shots where everything is visible and labelled, with no console errors and no horizontal scroll on the phone.
- In a headless run: click the key, then click the wire left of centre, and the needle visibly rotates. Describe it in the PR.
- The PR `gemini/lite-mode` → `main` has the body sections from AGENTS.md, counts checked against the branch, and no AI attribution.

## Implementer
Gemini (Flash, fresh session). The lead switches to Lite when WebGL fails or `liteSuggested` fires.
