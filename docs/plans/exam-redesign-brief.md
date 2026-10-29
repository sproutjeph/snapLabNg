# Brief: the exam-mimic redesign (NOT YET PLANNED OR APPROVED)

Written by the lead on Oct 29 (night), just before a context compaction, so that nothing is lost. The plan file (`docs/plans/exam-redesign.md`) comes next, once the two research reports are in and the user has approved it.

## Where the app stands (main = d54ecfd, all merged, 498 tests green)
- `?learn=ohms-law`: the hands-on V–I practical, end to end.
  - Bench, tap-to-wire, loupes with mirror parallax, typed notebook, graph sheet, step poses, Identify cards.
  - DRAFT marking (20 marks), exam mode (`&mode=exam`).
  - A Playwright E2E through the real page scores 20/20. A no-leak check passes.
  - Helper scripts live in `node_modules/.cache/` (`learn-e2e-graph.mjs`, `learn-noleak.mjs`, `learn-connect.mjs`). `&demo=wired|wired-closed` (dev only) pre-wires the bench.
- The ink look on every canvas (#69): the hero's pen-ink draw-on reveal (#74), and Muse Code's restyle of every screen (#73).
- One dev server for the user's testing: `MODE=fixtures FIXTURE_DIR=fixtures/recorded/2026-10-27-note1-v2 bun run dev` (web :5173 plus API :8787).

## The user's verdict (Oct 29)
"Not impressed at all." When asked, the user picked three problems:
- it doesn't feel alive;
- the 3D looks cheap;
- it's hard or confusing to use.

Layout, phone and speed were *not* picked.

## What the user wants now (their words, condensed)
- **Mimic the real exam.**
  - The student opens the app and selects the practical or question to solve.
  - The question and instructions are **read out**: use browser `speechSynthesis` (there is no Meta TTS).
  - The apparatus is laid out, the parameters are not given, and the student must connect it, with **a voice guiding them**.
- **A demo mode.** The system connects itself, takes the readings and plots the graph, end to end, following the question's instructions.
- **A practice mode.** The student then does everything they saw "and sees if they get the correct answer".
- "If it means changing the whole app, I'm down for it."
- **Decisions already made:**
  - Polish the metre-bridge hero too (yes, both).
  - A **near-isometric** camera (narrow FOV from farther back, a fixed 3/4 angle, a tight compact bench).
  - Keep the lesson title "Ohm's law (V–I)".

## Open question to put to the user in the plan (hard rule conflict)
AGENTS.md says to "never show the student the expected result". The demo shows readings and a slope, and practice wants "the correct answer". **Proposal:**
- The demo runs on a **different seeded bench** (a different wire, cells and zero error), so its numbers never reveal her bench's answers.
- Practice shows accuracy (her slope against the wire's true resistance, and per-reading checks) **only after she hands in**.

This needs the user's explicit OK, and then an AGENTS.md change.

## Reference: Backcountry 101 (backcountry-101.vercel.app), seen side by side on Oct 29
- **It auto-plays each step.** Objects animate into place (stones drop into a ring, kindling falls into a teepee). Tags on leader lines name each piece as it lands. It has play/pause, prev, speed and a progress bar ("2/6"), plus a sub-step checklist with thumbnails and checkmarks in the right panel, and illustrated thumbnails on the bottom step bar.
- **Its look:**
  - A near-isometric, close camera; a few big chunky objects fill the frame.
  - Thick ink outlines.
  - Warm, textured, illustrated materials (bark, stone, enamel).
  - Soft contact shadows.
  - A decorated topographic-map ground with ink trees.
- **Ours, by contrast:** small parts spread across a large empty desk, a far camera, thin lines, flat colours, no shadows, a static bench with a paragraph of text, and 7 leads to find at once.

## Reference: the real WAEC question (waeconline.org.ng e-learning)
- **The question page:** `https://www.waeconline.org.ng/e-learning/Physics/Phys327mq3B.html`. It is WASSCE (SC) 2018 Physics Paper 3, Question 3B: exactly our V–I question. Its "Observation" (expected response) is for the R against I⁻¹ variant (I to 1 d.p., I⁻¹ to 3 s.f.; slope and intercept; the shunt vs multiplier difference). Precautions it accepts: key opened between readings, tight connections, parallax avoided on the ammeter, clean terminals, repeated readings, zero error noted or corrected.
- **Weaknesses** (`Phys327mw.html`): candidates cannot read instruments (metre rule, ammeter, voltmeter…) to the required accuracy, use the right d.p./s.f., approximate values for plotting, start the graph from the origin when required, determine slope and intercept, express themselves in acceptable language, or compute and evaluate properly.
- **General comments** (`Phys327mc.html`): the domains are setting up the experiment, carrying out the procedure, theoretical background, collecting and analysing data, and making deductions. The mean was 28/50 (SD 7.62) across 728,924 candidates.

## Research in flight (background agents, Oct 29 night)
1. **How Dilum Sanjaya** (dilum.dev/lab/engineering, Backcountry 101's author, who says "Most of what I build these days, I build with AI") makes his 3D: AI tools and models, workflow, stack per experiment, his repeated visual recipe.
2. **A technical teardown of the Backcountry 101 production bundle:** renderer and camera, the ink pass, materials and textures, procedural geometry, ground, the animation and step system, UI, and performance. The output is a parameterised top-10 "replicate in R3F" list. It studies techniques only, never his code. Scratch files go in the session scratchpad `bc101/`.

## Next steps (lead)
1. When both reports arrive, write `docs/plans/exam-redesign.md`:
   - **the flow:** pick a practical → question read aloud → demo (auto-play) → guided practice → exam mode;
   - the voice guide;
   - the new look recipe;
   - the hero polish;
   - the hard-rule decision;
   - cut lines;
   - parallel slices (worktrees, at most 4 writers);
   - a day plan to the **Nov 2 23:59 freeze**.
2. Ask the user to approve the plan, including the hard-rule proposal, before writing any code.
3. User-side items still open: a real phone test, the backup video, and the Fly deploy (postponed; steps in PR #47).

## Research report 1: Dilum Sanjaya's tools and the Backcountry 101 recipe (Oct 29)
Key: [S] stated by him or a source; [B] measured from the BC101 bundle; [I] inferred.
- **Process [S]: image first, then code.** He generates the UI or scene mockup as an image (Nano Banana, GPT Images 2, Midjourney), then has a code model (Gemini 3.x Pro, Claude Opus 4.6/5/5.5, others; he switches per post) build to that picture. Some lab pieces use image-to-3D meshes (Hunyuan3D, Tripo). BC101 is fully procedural.
- **BC101 stack [B]:** vanilla three.js r186 (our version), Vite. No R3F, drei, postprocessing or GLTF. Fonts: Barlow, Barlow Condensed, DM Mono.
- **Camera [B]:**
  - **Orthographic**, fixed azimuth 45°, elevation 41°, distance 60, about 108 px per world unit.
  - Optional OrbitControls: damping 0.12, polar angle ≤ 85°, zoom 0.3–4×.
- **Renderer [B]:**
  - `alpha:true`, a transparent canvas over a cached paper or topographic backdrop texture.
  - No tone mapping.
  - PCF shadows at 2048 with `autoUpdate=false` (re-rendered on demand).
  - RoomEnvironment PMREM (sigma 0.04).
- **Lights [B]:**
  - Hemisphere #fff6e8 / #5a4a3c at 1.45.
  - Key directional #fff0dc at 3.9, position (-5,11,4), shadow frustum ±9, bias -6e-4, normalBias 0.025, radius 4.
  - Fill #fff4e8 at 0.45, position (6,3,1).
  - A ShadowMaterial ground catcher (#5b4027, opacity 0.12–0.26) plus soft blob shadows.
- **Materials [B]:** MeshStandardMaterial with roughness 0.85–1, flatShading on organic parts, vertex colours, seeded procedural canvas textures, merged or batched geometry.
- **Ink pass [B]:**
  - Colour, normal+id and depth targets; 8 taps at 2.1–2.6 px.
  - Silhouette: depth step 0.04–0.05, or an id change.
  - Crease: normal dot passed through smoothstep(0.16, 0.34), weight 0.35–0.4.
  - Per-object `userData.ink` strength, plus `inkThin`, `inkFlat` and per-vertex `inkSubId`.
  - Warm-black ink #1f160f.
  - Grade: saturation 1.1, a tint, and a fade toward paper #f2e8d5 for unfocused props.
- **Palette [B]:**
  - Paper #f2e8d5, card #f7f1e3.
  - Forest #2c4a37, sidebar #2e392c.
  - Accent orange #e8692b, ink #1f2421.
  - Greys #8d877e / #6f6961; terrain #e5dcbd, #c4b892, #bcb99c.
- **Motion [B]:**
  - A hand-written, scrubbable timeline. Tweens are clamped to about 0.4 s, with inOut-cubic, outBack and outBounce easing; objects arc in and bounce on landing. Step tabs, 1× speed.
  - CSS easings: cubic-bezier(.22,1,.36,1) and (.34,1.56,.64,1).
- **UI [B]:**
  - A dark-green collapsible sidebar, uppercase condensed tracked labels, and chips on leader lines with ringed markers.
  - A loading screen with a bobbing badge.
  - Reduced-motion support. No sound.
  - Thumbnails baked to webp by a script.
- **Takeaways for us:**
  1. Go orthographic at 41°/45°.
  2. Add a crease term and per-part ink strength to our ink pass, and warm the ink colour.
  3. Use the hemisphere + key + fill rig with real soft shadows and a shadow catcher.
  4. Use roughness ≈ 0.9 vertex-coloured materials and seeded canvas textures.
  5. Keep tweens short with arcs and bounces.
  6. **Use an image-first design step:** generate a target mockup of the bench and UI before coding, then have each slice build to it.

## Research report 2: Backcountry 101 bundle teardown (Oct 29)
Key: [C] confirmed in the bundle; [I] inferred. Text copies of the bundle are in the session scratchpad `bc101/`, never executed. We copy techniques and numbers only, never code.

- **Stack [C].** Vanilla three r186 plus OrbitControls, ConvexGeometry, mergeGeometries and FullScreenQuad. No EffectComposer, no postprocessing library, no GLTF.
- **Renderer [C].**
  - `{antialias:false, alpha:true}`, sRGB output, NoToneMapping, no fog.
  - PCF shadows with autoUpdate off.
  - Sun: #fff0dc ×3.9 at (−5,11,4), a 2048² map, ortho ±9, bias −6e-4, normalBias .025, radius 4.
  - Fill: #fff4e8 ×.45 at (6,3,1).
  - Hemisphere: #fff6e8 / #5a4a3c ×1.45.
  - The RoomEnvironment PMREM (σ .04) goes **only on glossy materials**; `scene.environment` is never set.
  - The pixel ratio steps down [2, 1.5, 1.25, 1] when more than 60 of 90 frames take over 25 ms.
  - Renders on demand. The frame delta is clamped to 50 ms, and shaders are warmed with compileAsync.
- **Camera [C].**
  - Orthographic, azimuth 45°, elevation fixed at 41°, distance 60.
  - 1 unit = 108 px × zoom × (viewport height / 941).
  - The view offset puts the subject in the free area between the panels.
  - Each step has a named shot {focus, zoom 1.1–2.1}, followed with k = 1 − e^(−8dt).
  - Dragging turns azimuth only: .006 rad/px, inertia decaying at e^(−5dt).
- **Ink pass, three passes [C].**
  - (A) colour into a HalfFloat target.
  - (B) the layer-0 meshes swap to one shared ShaderMaterial whose onBeforeRender sets per-object uniforms. Output: RG = view normal, B = ink strength (+2 if thin), A = object id. Nearest filtering, Float DepthTexture.
  - (C) the composite takes 8 taps on a circle of radius thickness × DPR (×0.55 if thin):
    - **Silhouette:** a neighbour's id differs and the neighbour isn't nearer, or the depth jump passes smoothstep(thr, 2·thr).
    - **Crease:** smoothstep(.16, .34, 1 − n·n′) within one id, times the weight.
    - Ink only where an id exists, so lines sit inside silhouettes.
  - Values: thickness 2.1 px, depthThreshold .05, crease .4, ink #1f160f, saturation 1.1.
  - **Per-object controls:**
    - ink opacity (tinder .65, rope .55, pot interiors 0);
    - `inkThin`;
    - `inkFlat`: dFdx facet normals give the chiselled rock creases;
    - a silhouette-only mode.
  - **Focus mode:** the other props fade 45% toward paper and their ink halves, over .3 s.
  - No grain, hatching or vignette.
- **Materials [C].**
  - MeshStandard, roughness .8–.95, metalness 0; rocks flat-shaded; MeshPhysical with clearcoat for glass.
  - The warmth comes from warm lights, no environment map on matte surfaces, and the grade. **It is not toon shading.**
  - Each object gets a seeded jitter from its palette.
  - Seeded Canvas2D textures (mulberry32 plus simplex fbm):
    - bark 512×1024, also used as bumpMap at scale 5;
    - rings 256²;
    - rock: a 7×7 Voronoi at 512², pre-baked to webp (~235 KB each) with a live fallback.
  - Anisotropy 8, cached.
- **Geometry [C].**
  - Rocks: ConvexGeometry of 15–21 jittered Fibonacci points, superellipse-normalised (p 2.6–2.9), flat base, about 30 triangles.
  - Logs: a 44×36 cylinder with simplex radial displacement.
  - Sticks: 7-sided and tapered, with a sine wobble.
  - Tinder: about 150 CatmullRom ribbons with vertex colours and a per-strand inkSubId, merged into one mesh.
  - Rope: a 120×10 tube on a sag curve. Pots: a 48-segment lathe.
  - Static meshes are merged across frames and keep per-vertex ids, so outlines survive the merge.
- **Ground [C].**
  - A 240² shader plane in its own scene, rendered to a target only when the camera moves. Lines use fwidth for anti-aliasing.
  - Patches: blobs + fbm (#e5dcbd, edge #c4b892).
  - Contours: #c8b99a, 1.1 px, faded at the centre.
  - Grid: every .366 units (#c4b292 at .36), on paper #f2e8d5.
  - Trees: Canvas2D icons in a 2048 atlas, drawn as one instanced billboard mesh with no ink.
  - Shadows: a ShadowMaterial catcher (#5b4027 at .26) plus a radial blob under each prop.
- **Animation [C].**
  - Tracks {at, dur, ease, update}, with dur clamped to 0.4 s.
  - A step is run(tl): it holds 1 s, then auto-advances. Speeds 1×, 1.5×, 2×.
  - **Jumping resets the scene and finishes every earlier step**, so the replay is deterministic.
  - Easings: quad, cubic inOut (default), outBack, outBounce.
  - Helpers:
    - **drop:** falls 2.2–2.4 with outBounce over .4 s. It casts no shadow until impact (36% in), where a dust puff fires.
    - **pop:** scale .01 → 1 with outBack.
    - **move:** lerp + slerp + sin(πt)·arc.
    - **stagger:** .025–.1 s.
  - Intro: the props drop 1.8 units over .38 s each, staggered across .75 s.
- **Callouts [C].**
  - DOM labels with anchors projected every frame. The label sits at (+72, −135) × scale and flips to avoid other tags.
  - SVG leader: #fffaf0 at 2.2 px over a 4.2 px shadow, ending 11 px short of a 22 px ring.
  - A damped spring blends anchor changes.
- **UI [C].**
  - A fixed 1728×996 design scaled by `--ui`, with modes wide, compact, short and portrait.
  - Layout: a sidebar #2e392c, a player pill, a guide card and a bottom step strip.
  - Fonts: Barlow Condensed 500–700 uppercase, Barlow, DM Mono.
  - Colours: bg #f2e8d5, brand #2c4a37, green #215d3f, orange #e8692b, ink #1f2421, card #f7f1e3, line #ddd3c0.
  - Thumbnails: the same scene builders rendered offline to 160² webp, with a live fallback.
