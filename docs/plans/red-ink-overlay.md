# Red-ink marking overlay

## Goal
The hero moment (docs/10 shot 1:20, "Wow 3"). Her own flattened page fills the screen, and red ink draws the examiner's marks onto it, item by item:
- a circle on "57" with "57.0" written beside it;
- a box around the small graph;
- a strike through "Avoid parallax error" with the past-tense fix;
- ticks where she earned marks.

A score card counts up to **"Question 3: 15½ / 21"**. Tapping a mark opens the rule, its fix in English (and Pidgin when given) and the WAEC source link. Sources: docs/15 §5 (the answer key), docs/07 §5 (rules), docs/03.

## Out of scope
- Computing any mark. Marks arrive as a `MarkSheet` (`@snaplab/contracts`, `packages/contracts/src/marks.ts`) from `packages/rules`, which the lead builds. Here a hand-written G1 sheet stands in.
- The examiner's voice, the drawer, the 3D scene. This is a 2D layer over the page image.
- New dependencies. Use SVG and CSS or Web Animations only.

## Files
All under `apps/web/src/marking/`. Owner: Gemini, branch `gemini/red-ink`, worktree `~/Desktop/SnapLabNG-gemini`.
- `RedInkOverlay.tsx`, the default export. `props: { pageImageUrl: string; pageAspect: number; sheet: MarkSheet; playing: boolean; onItemOpen?(id: string): void }`.
  - Draws the page image, then an absolutely positioned SVG in the same 0–1 page box (`viewBox="0 0 1 <aspect>"`).
  - Each item's `evidence[].box` gets its `annotation`, drawn as a hand-inked stroke (slightly irregular path, a stroke-dashoffset draw-on, about 400 ms each, staggered). Kinds:
    - `circle`: an ellipse with a little overshoot;
    - `underline`;
    - `strike`;
    - `box`;
    - `tick`: a small check mark at the box's right edge.
  - When `correction` is set, it's written in red "handwriting" (a cursive web-safe stack) just right of the box.
  - Lost items are drawn in red. Earned items get a red tick only.
  - Order: top to bottom of the page, lost and earned interleaved as they appear.
- `ScoreCard.tsx`: "Question 3", then the running total counting up in half marks as items finish (`15½ / 21`), using the real ½ character.
- `MarkDetail.tsx`: opens when an annotation is tapped or focused and Enter is pressed. Shows the rule code, the outcome, "−½" or "+1", `fix_en`, `fix_pcm` (when set) and the source link (`target="_blank" rel="noreferrer"`).
- `inkPaths.ts`: pure helpers, unit-tested. `circlePath(box, aspect, seed)`, `strikePath(...)`, `underlinePath(...)`, `tickPath(...)` and `boxPath(...)` return SVG path strings. The wobble comes from a small seeded PRNG (deterministic: same seed, same path; no `Math.random`). `formatHalf(15.5)` gives `"15½"`, and `formatHalf(21)` gives `"21"`.
- `g1Sheet.ts`: the G1 `MarkSheet` from docs/15 §5. It totals exactly 21 available and 15½ earned, with these lost items, each with an evidence box on the preview page:
  - PHYS-1DP "57";
  - PHYS-3SF "0.02";
  - PHYS-TABLE (l⁻¹ header unit);
  - GRAPH-AXES (vertical axis unit);
  - GRAPH-SCALE (graph box);
  - GRAPH-SLOPE (small triangle);
  - two PRECAUTIONS items (1 each).
  The earned items make up the rest of the 21. One setup issue: "No key drawn in the circuit". It must pass `MarkSheet.parse`.
- `g1Page.ts`: draws a synthetic G1 page on a canvas (paper, ruled lines, the G1 table from docs/15 §5, a small graph in the lower right, the two precautions as written in docs/11 §2, and a circuit with no key). It returns a data URL, and the evidence boxes in `g1Sheet` line up with it. Use no real student handwriting or photos.
- `MarkingPreview.tsx`: a page for `?marking=1`, with a "Replay" button.
- `inkPaths.test.ts` and `g1Sheet.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?marking=1` switch.

## Contracts
`MarkSheet` and `MarkItem` from `@snaplab/contracts`. Add `"@snaplab/contracts": "workspace:*"` to `apps/web` with `bun add` inside `apps/web`. That is the one dependency change allowed in this slice.

## Tests
- `g1Sheet` passes `MarkSheet.parse`, with `earned` 15.5 and `available` 21 (docs/15 §5), and lost items exactly as the answer key lists (rule and marks lost).
- `formatHalf`: 15.5 → `"15½"`, 21 → `"21"`, 0.5 → `"½"`.
- The path helpers are deterministic (same seed → identical string), return valid path syntax (starting `M`), and keep every point within the box expanded by 15%.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass. The overlay is lazy, and the initial chunk is unchanged.
- On port 5174, `bun run shot -- --route "/?marking=1" --base http://localhost:5174` shows the page with red ink and "15½ / 21" on phone and laptop, with no console errors.
- Keyboard: every annotation is focusable, and Enter opens its detail, with no colour-only meaning (lost items show "−½").
- `prefers-reduced-motion`: the ink appears without the draw-on animation.
- The PR description lists only what is in the branch, with counts checked against the test output.

## Implementer
Gemini. The lead later feeds the real `MarkSheet` from `packages/rules` and the real flattened page from `rectify`.

## Risks
- Evidence boxes from Wonder are approximate → pad each annotation 10% around its box.
- Long Pidgin fixes overflow on phones → `MarkDetail` is a bottom sheet on narrow screens.
