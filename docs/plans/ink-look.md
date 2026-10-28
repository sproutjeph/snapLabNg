# Plan: the ink field-guide look

Approved by the user on Oct 28 (Day 3). It goes with `docs/plans/ohms-law-vi.md`, which has the waves, ports and the brief rules every slice follows.

## Goal
SnapLab NG looks like a calm, ink-drawn field guide on warm paper. The apparatus is outlined in blue-black pen ink, red ink is used only for examiner marks, and the UI uses thin rules and uppercase condensed labels, with no glassmorphism and no bloom.

The reference is Backcountry 101 (backcountry-101.vercel.app). We copy techniques and layout patterns only, never its code, text, icons or branding.

## Techniques (from the reference, rebuilt our way)
- **Procedural geometry only.** Lathe, tube, extrude and cylinder primitives, seeded vertex jitter where it helps, `mergeGeometries`, and `InstancedMesh` for repeats. No model files, no Blender.
- **Ink outline post-pass.** A custom `postprocessing` `Effect` on depth, normals and a per-object ink ID. It samples 8 directions and draws silhouettes, creases (normal change ≈ 0.35) and ID boundaries, so touching parts still get a line between them.
  - Thickness is ≈ 2.1–2.6 px (scaled with DPR) and the depth threshold is ≈ 0.04–0.05.
  - `thin` objects get lighter lines.
  - Ink colour is `--ink` #1d2430; only red-ink marks use `--red-ink`.
- **Lighting.** A soft-shadow sun plus `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)`, with matte materials and a small seeded colour jitter.
- **Paper ground.** The desk is warm paper (`--paper`) with faint ruled lines, like an exercise-book page.
- **Animation.** `learn/timeline.ts` (tweens ≤ 0.4 s, `outBack`/`inOut`) plus camera poses per step.
- **"Rises out of the ink"** becomes outlines that draw themselves on, then fills that fade in (Wave 3, for the hero).

## Contracts (Wave 0, frozen)
- `apps/web/src/scene/ink/ink.tsx`:
  - `InkTag {id 1–255, thin?}`;
  - `inkTag(obj, tag)` tags `obj` and its subtree through `userData.ink`;
  - `readInk(obj)`;
  - `nextInkId()`;
  - `<InkGroup id? thin?>`, which tags its children on mount.
- `apps/web/src/scene/ink/InkComposer.tsx`: `<InkComposer quality reveal?>`, where `reveal` is a ref from 0 to 1 and omitted means fully drawn. It is the one post stack for every canvas and is currently a stub.
- `apps/web/src/scene/ink/PaperDesk.tsx`: `<PaperDesk quality size? y?>`, currently a stub plane.
- `apps/web/src/scene/ink/InkLights.tsx`: `<InkLights quality>`, the shared sun, environment, fill and paper background, currently a stub. The V–I kit preview already uses it.
- Ink ids: 1–199 come from a scene's fixed table (the V–I bench uses `INK_IDS` in `apparatus/ohms-law/layout.ts`); `nextInkId()` hands out 200–255. Nested `<InkGroup>`s keep their own tag: `inkTag` stops at a nested root.
- `apps/web/src/styles/tokens.css`:
  - the user's palette, plus `--pencil`, `--rule`, `--radius` and `--tap: 44px`;
  - self-hosted Barlow and Barlow Condensed (`@fontsource`, latin subset);
  - opt-in `.snap-paper` and `.snap-label` classes. Existing screens keep their styles until the restyle slice.

## Wave 1 · slot 2: ink look (`shader-artist`, Opus, port 5178)
**Owns**
- `apps/web/src/scene/ink/**`
- `apps/web/src/scene/{Desk,Page,Scene}.tsx`
- `apps/web/src/lab/LabBench.tsx`, the `<EffectComposer>`, lights, environment and background only
- the `<Canvas>` setup of `apps/web/src/apparatus/meter-bridge/KitPreview.tsx` and `apps/web/src/apparatus/titration/KitPreview.tsx` (lights, background, composer)
- `apps/web/src/quality/tier.ts`, additive only: a setting for the outline mode
- `apps/web/src/scene/ink/*.glsl` when GLSL is used

**Does not touch:** `apps/web/src/apparatus/ohms-law/**` (the apparatus slices own it), `lab/reveal.ts`, `RevealClip.tsx`, `PageSheet.tsx` and `InkSparks.tsx` (Wave 3), and the contracts above.

**Build**
1. **Check the library first.** Before writing code, confirm the APIs with `api-verifier`-level care: read the installed `postprocessing` 6.39.5 and `@react-three/postprocessing` 3.2.2 sources in `node_modules`. Questions: a custom `Effect` with `EffectAttribute.DEPTH`; a normal pass (`NormalPass`, or `EffectComposer enableNormalPass`); how to render an ink-ID target (an override-material pass into a small `WebGLRenderTarget`, reading `userData.ink` through `onBeforeRender` or a material swap); and MRT support. Write what you found into the report.
2. **Build `InkComposer`.** Implement the high and mid tier: depth, normals and the ID edges at full resolution on high and at 0.75× on mid.
3. **Low tier:** measure first. Option (a) depth-only edges at 0.5×, with no normal or ID pass. Option (b) no post at all, with inverted-hull outlines on parts tagged with large ink ids. Pick the one that holds ≥ 30 fps on `?quality=low` in the headless shot, report both numbers, and keep the other out of the code.
4. **Build `PaperDesk`.** Paper colour, faint ruled lines from a canvas texture ≤ 1024 px, and matte.
5. **Replace Bloom** in `Scene.tsx`, `LabBench.tsx` and both existing kit previews with `<InkComposer>`, and fill in `<InkLights>`, using it in those canvases too. Set the lighting: soft sun, the RoomEnvironment PMREM at 0.04, and the hemisphere fill toned to paper. The canvas background becomes `--paper`.
6. **Keep the hero working.** Its current reveal still plays; only the post stack changes. Nothing glows from heat, and current-flow dots stay visible (if dots need to stand out, give them a solid ink-blue fill, not bloom).
7. **Dispose** every render target, material and texture. Create uniforms once. No `new` in `useFrame`.

**Done**
- Outlines appear on `?kit=ohms-law`, `?kit=meter-bridge` and `?kit=titration`, and the hero `?flow=1&golden=note1` still plays to the bench.
- Phone and laptop shots were reviewed against `.shots/ref/`.
- `?quality=low` is ≥ 30 fps. No console errors. The four checks pass.

## Wave 3 · slot 3: hero draw-on reveal (`shader-artist`)
**Owns:** `apps/web/src/lab/{reveal.ts,RevealClip.tsx,PageSheet.tsx,InkSparks.tsx}` and `apps/web/src/scene/ink/**`.

The kit's outlines draw themselves on (the `reveal` ref drives a noise-and-gradient mask in the ink pass), then the fills fade in, replacing the cyan glow and the clipping-plane rise. Reduced motion jumps to the end. The `lab.test.ts` reveal tests are updated only as the plan says, with the new phase timings stated.

**Done:** reveal shots at 3 points in time in `?flow=1&golden=note1`, and docs/03's reveal line matches.

## Wave 3: restyle the existing screens (Muse Code)
Home, about, AI drawer, marking and score card, the metre-bridge notebook, teacher panel, examiner console, capture UI, the PWA notice and `index.html`, all moved onto the tokens. The plan is `docs/plans/ink-restyle.md` (the lead writes it at the start of Wave 3, after the shell from Wave 2 sets the patterns).

## Risks
- **The extra passes cost too much on phones.** The low tier is chosen by measurement.
- **The look change could break the hero.** The shots in `.shots/ref/` are the baseline, and the reveal changes only in Wave 3.
