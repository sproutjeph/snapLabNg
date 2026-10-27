# Her lab rises out of the ink (3D bench in the flow)

## Goal
After her page is read in `?flow=1`, show "Your lab". Her own flattened page lies on a bench. Its ink glows, sparks of ink lift off from the parts she drew (Spark's component boxes) and fly to where those parts stand on the bench, and the metre bridge kit materialises, rising from the bench top behind a glowing line. The camera moves from her page to the bench. Then the bench is live, driven by `@snaplab/engine`: she can tap the wire, watch the needle, and use the plugs and the key. This is the hero moment (docs/09 MUST: "Local-first reveal choreography"; docs/04 §2 ②–③).

## Out of scope (later lead slices)
- Current-flow particles, the metre-rule parallax loupe, the lab notebook on the bench, and lab sounds in the flow.
- Titration (its engine is not built yet).
- A custom dissolve shader per kit material. A rising clipping plane gives the same read, on every tier.

## Files (owner: lead, branch `claude/lab-bench-reveal`)
- `apps/web/src/lab/benchSetup.ts` (pure):
  - `PLUG_BOX_COILS = [1, 2, 2, 5, 10, 20]` Ω, a standard school box that makes every whole value from 1 to 40 Ω;
  - `plugsInFor(rOhm)` gives the plugs to pull for her first R, or null;
  - `benchSetupFrom({ resistancesOhm, teacherXOhm, herMeanXOhm })` gives `BenchSetup` and the plug labels. X is the teacher's value if one was entered, else her own mean X if it is between 0.5 and 50 Ω, else 4 Ω. **X is never shown.**
- `apps/web/src/lab/reveal.ts` (pure): `revealAt(tS)` gives the timeline phases `{ glow, sparks, rise, camera }`, each 0–1, and `REVEAL_S`. With reduced motion the reveal ends at once.
- `apps/web/src/lab/PageSheet.tsx`: her page as a textured plane on the bench. A fragment shader adds a cyan glow on the ink (ink = dark pixels), driven by one uniform. Its emissive output is not tone-mapped, so bloom picks it up on mid and high tiers.
- `apps/web/src/lab/InkSparks.tsx`: one `InstancedMesh` of small glowing quads.
  - Each drawn part gets an equal share of `settings.maxParticles / 2`. Every spark starts inside that part's box on her page and follows a curved path to the part's anchor on the bench.
  - All paths are computed once. The per-frame code only writes instance matrices, through reused objects.
- `apps/web/src/lab/RevealClip.tsx`: a clipping plane on the kit's materials only. Its height rises with `rise`, and a thin glowing line marks the cut. The planes are removed when the reveal ends.
- `apps/web/src/lab/LabBench.tsx` (default export, lazy):
  - `QualityProvider` around a `<Canvas>` that takes its `dpr`, shadows and bloom from the tier;
  - `ContextLossOverlay` with a remount, and `QualityMonitor`;
  - a camera that eases from her page to the bench;
  - `OrbitControls` once the reveal is done;
  - `useMeterBridgeEngine` with the bench setup;
  - a short hint ("Tap the wire with the jockey to find the balance point. Don't slide it.") and "Replay" / "Skip" buttons.
- `apps/web/src/pipeline/FlowPage.tsx`: a "Your lab" section once a metre bridge page has been read. Its inputs are the page URL, the component events, the blueprint values, the teacher's X and her own mean X.
- Tests: `apps/web/src/lab/lab.test.ts`.

## Tests
- `plugsInFor`:
  - 2 Ω pulls only one 2 Ω plug;
  - 8 Ω pulls exactly coils that add to 8;
  - every whole value from 1 to 40 is possible;
  - 41 and 2.5 give null.
- `benchSetupFrom`:
  - the teacher's X wins;
  - otherwise her mean X is used (4·00 gives 4);
  - an absurd mean (e.g. 900) falls back to 4;
  - her first R decides which plugs start out;
  - the labels are the coil values.
- `revealAt`: every phase stays within 0–1 and never decreases; all phases are 1 at `REVEAL_S`; glow starts before sparks, and sparks before rise.

## Done-criteria
- The four checks pass. The lab chunk stays lazy, and the initial bundle does not grow.
- `?flow=1&golden=note1` with `MODE=fixtures` shows:
  - the glow on her page;
  - sparks flying from the drawn parts;
  - the kit rising, then the live bench;
  - a tap on the wire swings the needle.
  `/verify-3d`-style shots on phone and laptop, with no console errors.
- Low tier: no bloom, DPR 1, fewer sparks, still readable.
- The UI shows no value of X anywhere.

## Implementer
Lead (3D, shaders, choreography).
