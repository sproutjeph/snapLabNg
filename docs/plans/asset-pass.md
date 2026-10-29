# Plan: Wave 1b, the asset pass: every V–I part modelled to its own reference image

Status: **APPROVED by the user on Oct 29.** Runs as soon as W1-look merges and before Wave 2 of `docs/plans/exam-redesign.md`.
Inputs:
- `docs/plans/exam-redesign.md`: The look, the Wave 1 and 2 tables, Context management and the Wave 1 handoff notes.
- `docs/plans/exam-redesign-brief.md` reports 1 and 2: Backcountry 101's (BC101) author designs image first, then code, and BC101 is fully procedural.
- `docs/design/exam-redesign/{golden-frame.webp,prompts.md}`: the approved style. `scripts/design-targets.ts`. `.claude/agents/apparatus-modeller.md`.

## Progress (a fresh session reads this first)
- [x] Prerequisites (Oct 29): W1-look merged (the seam imports its files); the pending edit to `exam-redesign.md` (Wave 1 handoff notes) committed; AGENTS.md "Who owns what" gets the four rows below.
- [ ] 1b-0: the seam (`claude/asset-seam`) and the 10 reference images merged; reference gate passed
- [ ] G4 leads and terminal, G2 box/key/cells, G3 board and tray, G1 meters and desk props: gates passed, user sign-off, merged (this order)
- [ ] Whole-bench integration shot at DPR 3 and DPR 2, and the user's last look in Chrome

## Goal
The golden frame was approved, but the parts are still plain: Backcountry 101 earns its feel from each object being drawn well. Give every V–I bench part the same treatment its author uses: **one reference image per asset (Muse Image), then model it in isolation, shoot it at real pixel density, compare, fix, repeat.**
- Fixed decisions:
  - references are isolated assets in the approved style (the same iso view, cream graph paper, ink #1d2430, wood, brass and bakelite);
  - the loop is model → shoot at real density (phone DPR 3 or laptop DPR 2, ladder pinned) → compare with the reference → fix, up to about 6 iterations per asset, then stop and report;
  - the final sign-off is in the user's real Chrome, through the lead, beside the reference and `backcountry-101.vercel.app`, judged on vibe, texture and feel.
- At most 4 writers in parallel, each `apparatus-modeller` in its own worktree, on disjoint files. The lead orchestrates and runs every gate.
- **Principle unchanged:** a part paints only what the real object shows (printed scales, labels). No computed value is ever drawn.

## Out of scope
- The metre-bridge hero parts (see "For W2-hero"), the titration kit, any new apparatus, model files, any new dependency.
- Moving or resizing parts: `OHMS_LAW_LAYOUT`, `BENCH_FOOTPRINTS`, `INK_IDS` blocks, `TerminalId`s, component props and `poseTargets.ts` are frozen.
- The look itself (`scene/ink/**`, `scene/look/**` except `DeskProps.tsx`: lights, ink pass, camera, ground). If the look is wrong, the writer reports it; it does not patch it.
- `learn/**` (wiring, script, readings), the engine and rules, `PenNib.tsx` (a cursor, no reference).
- Making the parts animate or react differently. Behaviour (taps, needles, plugs, key) stays as it is.

## The seam: what exists, and Wave 1b-0
**Exists in part.** `?kit=ohms-law&part=ammeter|voltmeter|cells|key|box|wire|tray` (`apparatus/ohms-law/KitPreview.tsx`, #81) frames one part, with `az`, `deg`, `leads`, `drawn`, `pen` and `quality`. It is not enough:
- it uses the pre-look `scene/ink` lights, `PaperDesk` and a private perspective `FrameRig`, so no soft shadows, catcher, blob or look camera;
- `dpr` is `[1, 2]` and cannot be pinned, so phone DPR 3 is unreachable;
- no turntable, and no subject for leads, a terminal or the desk props;
- `scripts/shot.ts` shoots at DPR 1 only (fixed 390×844 and 1440×900). `?look=ohms-law&shot=<slot>` (W1-look) has the real look but the same gaps.

**1b-0 builds, as two writers in parallel on disjoint paths (branch `claude/asset-seam`, port 5177):**
- `apparatus-modeller`, `apparatus/ohms-law/KitPreview.tsx` only. Mount the look as the real pages do (`LookTier.Provider`, `LookCamera` with a fixed shot fitted to the subject, `LookLights`, `LookGround`, `BlobShadow`, `InkComposer`; imports only), orthographic, azimuth `az` (default 45, the golden frame's), elevation 41°. Keep every existing param. Add:
  - `part=leads` (the seven leads; their end parts stay mounted for the terminals and fade through the look's focus set), `part=terminal&id=A+` (a macro of one nut with a plug), `part=desk` (the desk props only);
  - `dpr=<1..3>` pins the canvas pixel ratio and switches the ladder off; `zoom=<1..4>` tightens the fit for materials shots; `turn=1` sweeps the azimuth ±30° about `az` over 8 s (for Chrome; drag still works);
  - `dump=1` logs the terminal registry's world positions as JSON once ready (the regression baseline for hit targets);
  - SHOULD: `ref=1` shows the reference image beside the canvas, in dev only and absent from `dist/`; otherwise the lead uses two browser tabs.
- `implementer`, `scripts/` only. `shot.ts`: `--dpr <n>` (deviceScaleFactor, default 1), `--only phone|laptop`, and the fps line only at DPR 1; default behaviour unchanged. `design-targets.ts`: `--set asset-pass` (default `exam-redesign` is untouched) with the targets below, output `docs/design/asset-pass/<asset>.webp` and `prompts.md`. Then it runs it from the repo root (Bun loads the server env; the key is never printed, read or copied). A rerun skips existing files.
- **Seam acceptance:** all ten subjects shoot at `--dpr 3 --only phone` and `--dpr 2 --only laptop` with no console error, in one identical camera; shadows and the 3 px ink visible; `dump=1` lists the 12 terminal ids; `?learn=ohms-law` and `?look=ohms-law` unchanged; four checks green.

## The assets and their owners (ownership is per file; one writer per file)
| Group | Branch, port | Assets (reference) | Owns (under `apps/web/src/` unless noted) |
|---|---|---|---|
| **G4** leads | `claude/asset-leads`, 5180 | leads, terminal | `apparatus/ohms-law/{Lead.tsx,LeadParts.ts,TerminalNut.tsx}`. Also the named owner of `layout.ts` and of `BENCH_FOOTPRINTS`/`floorAt` (additive, and only with the lead's OK) |
| **G2** bench | `claude/asset-bench`, 5178 | resistance-box, plug-key, cell-holder | `apparatus/ohms-law/{ResistanceBox,Key,CellHolder}.tsx`; also the named owner of `apparatus/materials/**` (additive only: no changed signature, seed or existing texture) |
| **G3** board | `claude/asset-board`, 5179 | wire-board, tray | `apparatus/ohms-law/{WireBoard.tsx,WireBoardTextures.ts,Tray.tsx,TrayParts.ts}` |
| **G1** meters | `claude/asset-meters`, 5177 | ammeter, voltmeter, desk-props | `apparatus/ohms-law/{Meter.tsx,MeterDial.ts,MeterImage.ts,MeterMaterials.ts}` (`MeterMaterials.ts` is imported by Key, CellHolder, ResistanceBox: additive only), `scene/look/DeskProps.tsx` |
- Ammeter and voltmeter share `Meter.tsx`, so one owner. Terminal nuts are shared by every part, so **G4 owns `TerminalNut.tsx`**; the others judge "terminals readable" after G4 merges first.
- The tray's leads reuse G4's plug and clip shapes, so G3 re-checks the tray after G4 merges. `ResistanceBox` and `Key` read `meter-bridge/dimensions.ts` (`PLUG_BOX_DIMS`, `plugPositions`, `PLUG_KEY_DIMS`); that file is W2-hero's, so size changes are made in the V–I files only.
- Real parts, not the golden frame: leads are red, black and yellow; the box coils are 1 2 2 5 10 20 20 50 Ω; the tray holds leads (two with crocodile clips), sandpaper, a rheostat and a micrometer.
- A part that must grow past its footprint stops and writes it under NEEDS FROM LEAD; the lead routes it to G4 (at most ±10% in one dimension, `layout.test.ts` stays green).
- **Merge order:** seam, then G4, then G2, G3 and G1; each merges `origin/main` in and re-runs the four checks.

## The reference prompts (paste into `design-targets.ts` as `ASSET_TARGETS`, all `1536x1024`)
```ts
const assetFrame = (noun: string, body: string) => words(
  `A single isolated ${noun} alone on a cream graph-paper desk, landscape: nothing else in the frame, no other apparatus, no hands, no user interface.`,
  SCENE_LOOK, body,
  "Composition: the object centred and filling about 70 percent of the frame, seen from the 45 degree front-right corner at 41 degrees elevation, one soft contact shadow under it, key light from the upper left front. Text only where the real object is printed.",
  AVOID);
```
- **ammeter** (G1): an ammeter, a school moving-coil meter: a square speckled black bakelite case about 12 cm wide with a round glass dial window (cream scale, black ticks, numerals 0 0.2 0.4 0.6 0.8 1 and the letter A, a thin black needle one third across, a soft curved highlight on the glass), a small zero-adjust screw under the dial, and a low front ledge carrying two chunky brass terminals with knurled nuts and washers, one with a red insulating cap and one with a black cap.
- **voltmeter** (G1): the same meter in the same style with the numerals 0 1 2 3 and the letter V, needle one third across.
- **resistance-box** (G2): a resistance box: a long dark mahogany box about 30 cm long with visible grain and a brushed-brass top plate carrying a row of eight brass blocks; ebonite-handled brass plugs seated in the gaps between the blocks, two plugs pulled out and standing beside the box to show their tapered brass shanks; a cream printed paper label along the front edge reading 1 2 2 5 10 20 20 50 and the ohm sign; a chunky brass terminal at each end.
- **plug-key** (G2): a one-way plug key: a small wooden base about 9 cm long, two thick brass blocks with a tapered brass plug seated between them (closed), a black ebonite knob on the plug, a knurled brass terminal on each block, and a small cream printed label reading K.
- **cell-holder** (G2): two 1.5 V cylindrical dry cells (black bodies with paper wrapper bands, silver tops, brass caps) lying end to end in series in a bevelled wooden holder, brass spring clips at both ends and between the cells, and two knurled brass terminals on the front edge marked + and −.
- **wire-board** (G3): a metre-wire board: a long, low pale-pine board about 110 cm by 12 cm with rounded edges and visible grain; a thin bare constantan wire stretched taut along it between two chunky brass end blocks, each with a knurled terminal nut, a printed X on the left and Y on the right; a printed cream metre scale along the front edge with black ticks and numerals every 10 cm from 0 to 100. Shown whole, running from lower left to upper right.
- **tray** (G3): a shallow wooden tray about 26 by 34 cm with a low rim, holding a loose coil of spare leads with two crocodile clips, a strip of sandpaper, a rheostat (white ceramic tube wound with bare wire, brass end terminals, a sliding brass contact on a rod) and a micrometer screw gauge (steel C-frame, thimble with a scale, ratchet).
- **leads** (G4): three soft insulated flexible leads, one red, one black, one yellow, each about 60 cm long, laid in gentle sagging curves with one loose loop; every end finished with a banana plug (brass pin, ribbed coloured sleeve) standing upright about 4 cm tall.
- **terminal** (G4): a tight close-up of one terminal on a school meter: a short chunky brass post with a knurled brass nut, a flat washer and a red insulating cap on a small black bakelite pad, with a black banana plug seated in its top and its soft 3 mm lead leaving sideways in a curve; beside it a second, empty terminal showing the bare threaded post.
- **desk-props** (G1): four exam-desk items laid apart on the paper, none overlapping: a closed answer booklet with a blue-black cover and a small printed label; a sharpened hexagonal wooden pencil; a pink eraser block; a flat scientific calculator with a grey rubber keypad and a plain dark display showing nothing.
- **Reference gate** (`visual-qa`, ≤ 8 lines): each image has one isolated object, the iso view, the right parts and counts, no garbled text, no photoreal gloss. A failed image is rerolled (delete the file, rerun; at most 5 rerolls in all). A weak one is annotated in its writer's brief ("ignore X") instead of rerolled forever, as `metre-bridge.webp` was.

## The loop (every asset, in its writer's worktree)
1. **Model** in isolation: edit only owned files; look at `?kit=ohms-law&part=<id>` on the writer's port.
2. **Shoot at real density:** `bun run shot -- --route "/?kit=ohms-law&part=<id>&dpr=3" --dpr 3 --only phone --base http://localhost:<port> --name a-<id>-i<N>`, then DPR 2 on the laptop, at `az` 45, 15 and 75, plus one `zoom=3` materials shot.
3. **Compare:** open `docs/design/asset-pass/<id>.webp` and the new PNGs together (Read) and fill the checklist below, ✓ or ✗ with one concrete line per ✗ (never "looks good").
4. **Fix** the ✗ rows, worst first; commit small, staged by name (`asset(<id>): iteration N`).
5. **Stop** when every row is ✓, or at iteration 6, or when the same row fails after two fixes. The report lists what is still ✗ and why.

**Per-asset checklist**
- **C1 Silhouette and proportions:** it reads as the real WAEC object at a squint (25% scale) and beside its reference; real sizes in metres; inside its footprint, plus at most 6 cm for plugs and nuts.
- **C2 Materials and texture:** each surface has its kit material (mahogany grain, pine, speckled bakelite, brushed brass, printed paper), roughness .85–.95 (glass and brass may be glossier); no flat face wider than 3 cm; grain and speckle visible in the `zoom=3` shot at DPR 3; seeded, so no flicker between loads.
- **C3 Ink weight:** about 3 px silhouettes and 1.5 px creases at the shot's DPR, as in the golden frame; no solid-black patches; small pieces tagged thin; touching sub-parts have different ids; no stair-stepped creases on bevels.
- **C4 Bevels:** every box edge is rounded (radius ≥ 1.5 mm) and catches the key light as a line.
- **C5 Terminals and labels:** at 390 px wide and DPR 3 every printed label, dial numeral and ± mark is legible, and each terminal reads as a chunky thing to tap. Nothing prints a value.
- **C6 Contact shadow:** the part sits on the desk (lowest point at y = 0 ± 0.5 mm) with the look's soft cast and blob shadow: no floating, no acne, no detached shadow.
- **C7 Likeness:** three named good things from the reference are present (or rejected with a reason); nothing contradicts how the apparatus looks in a WAEC lab.
- **C8 No regression:** layout tests green; `dump=1` terminal drift ≤ 2 mm against main; hit meshes and tap handlers unchanged (key, 8 plugs, 12 terminals still work on `?learn=ohms-law`); both pages' shots clean at 390×844 and 1440×900; `?quality=low` ≥ 30 fps.
- **C9 Cost:** triangles ≤ 1.3× before; no texture over 1024 px; every geometry, material and texture still disposed; low tier has a lighter path.

**Sign-off.** Gates per group, in order: the writer's four checks → `verifier` (failures only) → `visual-qa` at DPR 3 phone and DPR 2 laptop, scoring C1–C9 independently (≤ 8 lines) → `code-reviewer`. Then the lead starts the dev server from the writer's worktree and opens, in the user's Chrome, the part with `turn=1`, its reference and `backcountry-101.vercel.app`; the user answers APPROVE or FIX with one line per asset, on vibe, texture and feel. FIX goes back to the same writer by `SendMessage` (at most 2 rounds of 3 iterations). A group merges only when each of its assets is approved, or the user waives it. If an asset fails 2 FIX rounds, it ships as it is and moves to the beauty pass. No asset waits for a time slot.

## Tests
- **Unchanged and green:** `layout.test.ts` (footprints, spacing, compact, wire board visible, frozen terminal ids), `poseTargets.test.ts`, `materials.test.ts`, `cache.test.ts`, `boundary.test.ts`. The total test count must not fall; no test is weakened.
- **New, per part, only where a pure builder exists (no WebGL, no canvas):**
  - G1: the dial spec prints only scale numerals (`scaleLabel`), the needle stays inside `METER_STOP_DEG`.
  - G2: the box label lists `coilsOhm` in order and there is one plug per coil; the key and cells keep their terminal positions.
  - G3: `buildTray` ink ids stay inside the tray's block of ten and each item's hit box contains its geometry; the rule texture's 0 and 100 cm match the X and Y blocks within 1 mm.
  - G4: the plug is `PLUG_HEIGHT_M` tall ±1 mm; a lead ends at `NUT_TOP_M`; `floorAt` is unchanged; a nut's tap target is no smaller than before.
- **Seam:** a unit test for the `part`/`dpr` parameter parsing, if it is a pure function.

## Done-criteria (each with its proof)
1. The seam renders all ten subjects at DPR 3 and DPR 2 in one camera. Proof: ten PNG pairs and the console JSON.
2. Ten references exist, with their prompts, and the reference gate passed. Proof: `docs/design/asset-pass/*.webp` and `prompts.md`; the BUILD_LOG line with the cost.
3. Each asset's checklist is all ✓, or its remaining ✗ are named after 6 iterations. Proof: the writer's table, re-scored by `visual-qa`.
4. **The user approved each asset in real Chrome**, beside its reference and BC101. Proof: the verdicts recorded in Progress.
5. No regression: the four checks green with the test count not lower; `?learn=ohms-law` and `?look=ohms-law` shots clean at both sizes; the footprint and terminal-drift checks hold.
6. Whole-bench integration shot (DPR 3 phone, DPR 2 laptop) after all four merges, and the user's last look. Proof: two PNGs and the verdict.

## Implementer
- Seam: `apparatus-modeller` (KitPreview) and `implementer` (scripts), both with `isolation: "worktree"`.
- Assets: four `apparatus-modeller` writers (Sonnet, high effort), briefs of about 10 lines: "Read `docs/plans/asset-pass.md` §<group> and AGENTS.md; own only these files; port N; run the loop; the four checks; commit on your branch; report in ≤ 300 words with the checklist table".
- The lead adds the four ownership rows to AGENTS.md at launch, runs every gate, pushes, opens and merges the PRs. If a group fails the same row twice, it goes to `debugger`.

## Context management
- State lives in this file's Progress and in BUILD_LOG, not in chat. One lead session for the pass; at the end it says "Ready for `/clear`" and Wave 2 starts fresh.
- The lead never reads part files, diffs, test logs or more than 2 screenshots per group. Gates return verdicts: `verifier` failures only, `visual-qa` ≤ 8 lines, `code-reviewer` ≤ 25 lines.
- Fix rounds go through `SendMessage` to the same writer, so its context grows, not the lead's. Tripwire: past 50% of the context, stop launching and ask for `/clear`.

## Budget
- Muse Image: 10 images at $0.01 = $0.10, plus at most 5 rerolls: **≤ $0.15** (about ₦210). With the 9 earlier targets ($0.12), D2's cap (≤ 12 images, ≤ ₦170) is passed, with the user's approval on Oct 29. No other Meta calls.
- Time: 4 writers × up to 6 iterations; target 3 hours of wall-clock from launch. Each DPR 3 phone shot is a 1170×2532 frame in software GL: slow, so fps is read only at DPR 1.

## Schedule: as fast as it goes, no time slots (the user's rule, Oct 29)
Each step starts the moment the step before it is done. Nothing waits for a clock time.
1. W1-look merges → `/clear` → this pass starts in a fresh lead session straight away.
2. Wave 1b-0: the seam writer and the `implementer` run in parallel; the references are generated and gated.
3. The seam merges → G1–G4 launch at once (ports 5177–5180).
4. Each group is gated the moment it reports. Once a group's gates pass, the lead pings the user and opens that group's parts in Chrome for sign-off straight away, then merges it (G4 first if the others are ready at the same time).
5. After the last merge: the integration shot, the user's last look, "Ready for `/clear`", and Wave 2 starts.

## For W2-hero
Use the same loop for the metre bridge's parts (jockey, galvanometer, E-strips, wire board, box, coil): one reference per part, an equivalent `?kit=meter-bridge` seam (copy the seam spec above), and the same checklist. Do not rely on `metre-bridge.webp` (its jockey is a knife and it has screws, not plugs). `ResistanceBox` and `Key` share `meter-bridge/dimensions.ts`; change it only after this pass has merged.

## Risks
1. **A weak reference misleads a writer.** The reference gate and the rule "build toward it, do not copy pixels" cover this. The user's sign-off overrides the reference.
2. **Shared files collide** (`MeterMaterials.ts`, `LeadParts.ts`, the kit). One named owner each, additive only, and a fixed merge order.
3. **Looks better, taps worse.** C8 and the terminal-drift dump guard the hit targets; hit meshes are not resized.

## Backcountry side by side in real Chrome (Oct 29, after W1-look round 4): what each asset must hit
The look recipe (paper, ink, lights, shadows, anti-aliasing) matches BC101's. The gap is the assets and the framing:
- **Scale.** BC101 shows each hero object at about 150–250 px on a 1440 laptop (logs, mug, knife); ours shows a meter at about 70 px. Judge every asset at BC101's scale: the turntable preview's zoom gives about 200 px for a meter.
- **Chunky, stylised proportions.** Exaggerate slightly while staying WAEC-recognisable: thicker bases and bezels, bigger knobs and terminal nuts, cables and plugs about 1.5–2× thicker, deeper bevels. Footprints and terminal ids stay frozen; only the visual mass grows.
- **Rich texture.** High-contrast grain on wood (like BC101's bark and log ends), speckle and edge wear on bakelite, brushed highlights on brass, colour variation within each material, and slightly higher saturation. Flat colour is a ✗ on C4.
- Add "chunky stylised proportions, rich hand-painted texture, like Backcountry 101" to every reference prompt.
- **Out of this pass, recorded for W2:** per-beat shots should frame 2–4 items at this scale (W2-watch). BC101's paper carries faint printed motifs (contour lines, tiny trees); our cue could be faint exam-desk marks (a margin rule, a faint stamp). That's a beauty-pass idea, and it needs the user's OK.
