# Plan: the exam practical lab: question → Watch → Practise → Exam, in a look that stops people

Status: **APPROVED by the user on Oct 29 (night)**, with D1 = (a)–(d), D2 = (a) Muse Image and D3 = viva as a COULD. Wave 0 starts on Oct 30 in a fresh lead session.
Inputs:
- `docs/plans/exam-redesign-brief.md`: the user's words, the WAEC question and examiner pages, and both research reports.
- `docs/plans/ohms-law-vi.md`: the V–I practical as it stands.
- `docs/07` §4.4: the science and the DRAFT scheme.
- `docs/06`: Meta APIs.
- `docs/09`: cut lines.

## Progress (update at the end of every wave; a fresh session reads this first)
- [x] Decisions D1–D3 answered: D1 demo bench plus reveal after hand-in (21 marks, with the engine as supervisor); D2 Muse Image targets (≤ 12 images, ≤ ₦170); D3 viva as a COULD
- [x] Design targets: 9 Muse Image targets in `docs/design/exam-redesign/` ($0.12); **direction approved by the user on Oct 29** (cream graph-paper desk, blue-black ink #1d2430, wood, brass and bakelite). Best references: `golden-frame`, `watch-mode`, `materials-closeup`. `metre-bridge` is weak (a knife-like jockey, screws instead of plugs), so W2-hero must not copy those parts.
- [x] Wave 0: seams and contracts (lead) merged (`claude/exam-seams`: science PASS ×2, verifier green, code review SHIP after one fix round)
- [x] Wave 1: paper and picker (#79), director and voice (#80), apparatus v2 (#81), look (#82) merged; **golden frame approved by the user** on Oct 29 with three tweaks, then re-checked in real Chrome beside BC101 after the anti-aliasing fix (renders: `docs/design/exam-redesign/golden-render-{phone,laptop}.jpg`)
- [ ] Wave 1b: the asset pass (`docs/plans/asset-pass.md`) and the Backcountry page layout (see "Page layout" below), run in parallel at max effort (the user opted in to ultracode)
- [ ] Wave 2: Watch script, guided Practise, callouts and motion, hero look merged
- [ ] Integration: the practical page end to end, E2E green
- [ ] Beauty pass and bug bash; freeze at 23:59 on Nov 2

## Goal
A student opens the app, picks a WAEC practical (WASSCE (SC) 2018 Physics Paper 3, Q3B, "Ohm's law (V–I)") and hears the question read aloud while the apparatus lands on the bench as each item is named.
- **Watch:** the lab performs the whole practical by itself. It wires the circuit lead by lead, closes the key, reads the meters, fills the table, plots the graph, finds the slope and answers part (b), with a voice, captions and callouts. Play/pause, step and speed controls.
- **Practise:** she does every action herself on her own bench, with a voice guiding her one action at a time and a specific correction for every mistake.
- **Exam:** she sits it unaided.

After hand-in she sees her marks and, only then, how her readings compare with her own meters. The bench looks hand-inked and alive: Backcountry 101 quality, as measured in the brief's two research reports.
**The principle stays: the engine decides every number, and marks come only from `packages/rules`.**

## Out of scope
- A Watch or Practise mode for the metre bridge. The hero gets the new look only, and its snap flow is unchanged.
- The titration engine and marking.
- Variant B (R against 1/I).
- A snap of her handwritten V–I table.
- Drag-to-wire. Tap–tap stays.
- Model files (everything stays procedural) and any new dependency, apart from what Wave 0 lists.
- Live Meta calls in development (fixtures only). The optional viva, D3, gets a naira quote first.

## Decisions the user must make (D1–D3)
- **D1. The expected-result rule.** The Watch bench shows its readings and slope; that is the point of a worked demonstration. Proposal:
  - (a) Watch always runs on a **different bench**: `demoSeedFor(practiceSeed)` guarantees the wire's resistance differs by at least 20%. Copying the demo table therefore fails the accuracy check.
  - (b) In Practise and Exam, nothing from her bench is shown before hand-in, which is unchanged.
  - (c) After hand-in, the results show, per row, what her meters read beside what she wrote, plus her slope against the wire's resistance.
  - (d) The accuracy mark (`PHYS-ACCURACY`, ±10%, which exists today in teacher mode only) is awarded on the simulated bench against the engine's own meters, the way a supervisor's values are used. That makes 21 marks.
  - AGENTS.md then reads: "Never show the student the expected result before she hands in. On a snapped page, accuracy is judged against a teacher-entered value; on a simulated bench, the engine's own meters are the supervisor's values."
- **D2. Image-first design targets.** The research found that Backcountry 101's author designs by first generating a mockup image, then building to it. Options:
  - (a) The lead generates about 8 targets with Meta's Muse Image (`muse-image-1.0`, $0.01 per image, about ₦14; ≤ 12 images, ≤ ₦170 in total), saved to `docs/design/exam-redesign/`.
  - (b) The user makes them in their own tool from prompts the lead writes.
  - (c) No images; the golden-frame sign-off is the only target.
  - Either way, **the user approves a golden frame (a real render) before Wave 2.**
- **D3. Meta AI in the practical.** At present the V–I lab uses no Meta model. Recommendation: a COULD-level **viva** after the results. The examiner asks two questions from `OHMS_LAW_QUESTIONS` aloud; she answers by voice or typing; Muse Spark judges each answer against the rubric points; marks stay in rules. It reuses the hero's examiner voice loop and is built against fixtures. Alternatively, skip it.

## The experience (what "done" looks like to a student)
1. **Pick** (home). "Choose a practical" lists ink-drawn cards:
   - Ohm's law (V–I), with Watch, Practise and Exam;
   - Metre bridge, with "Snap my practical" (the existing hero) and "Try a demo page";
   - Titration, coming soon.
   - Each card shows "WASSCE-style · Physics Paper 3", in our own typesetting with no WAEC logo or scan.
2. **Question paper.**
   - The question is typeset like an exam paper, with our corrected circuit diagram.
   - "Read it to me" speaks it, highlighting words where the browser supports it (sentences elsewhere).
   - As the voice reads "You are provided with an ammeter, a voltmeter, …", **each item drops onto the bench with a bounce and a name tag.**
   - Then three choices: **Watch it done · Practise with a guide · Exam conditions**.
3. **Watch** (about 3 minutes at 1×). The director plays the script on the demonstration bench, labelled "Demonstration bench: your own bench will give different readings".
   - Each instruction of the question is a stage.
   - A pen-nib cursor travels to each terminal and taps; leads **draw themselves in** one by one, with a callout ("Lead 3 of 7: ammeter − to resistance box").
   - The plug arcs into the key, the needles swing, the loupe zooms on the scale, and the reading is written into the demo notebook in hand.
   - Rows R = 5 Ω to 60 Ω run as a 2× montage. The graph is plotted point by point, then the line, the triangle and the worked slope.
   - The precautions and part (b) are written out, and it ends with the demo's mark sheet (20/20).
   - Controls: play/pause, previous/next stage, speed 1× / 1.5× / 2×, a progress bar, and a checklist of the stage's actions in the panel.
4. **Practise.** Her own bench, the same stages.
   - For each action the voice gives one instruction, the camera frames just the parts involved, and both target terminals are ringed and tagged.
   - Wrong tap: a gentle shake, plus a specific spoken and captioned correction built from the bench's procedure notes and diagram issues. **It never contains a value.**
   - Hint ladder when she is idle or stuck: 20 s → repeat; 40 s → highlight; "Show me" → the actor performs that one action. Show me is allowed for setup actions only (leads, plugs, key), never readings or the graph.
   - Readings: the loupe opens, she types into the highlighted cell, and the step ticks when its `done()` holds.
5. **Exam.** The question paper, the bench, the notebook and the graph. The only voice is the question read aloud. No rings, callouts, hints or Show me. Elapsed time is shown.
6. **Results** (Practise and Exam, after hand-in):
   - marks from `markOhmsLaw`, grouped by rule as today;
   - **"Check against your apparatus"**: each row shows what she wrote beside what her meters showed, ✓ within one division and ✗ otherwise, with a parallax hint;
   - her slope against the wire's resistance (D1);
   - "Watch the demonstration again" and "Try again on a new bench" (a new seed).

## The look (shared by the V–I lab and the hero; numbers from research report 2)
- **Camera.**
  - Orthographic, azimuth 45°, elevation 41°.
  - Each shot is `{focus, spanM}`; the zoom fits `spanM` into the canvas area not covered by panels (`setViewOffset`).
  - It follows with k = 1 − e^(−8dt). Dragging turns azimuth only (±25°, inertia e^(−5dt)).
  - Reduced motion snaps between shots.
- **Light.**
  - Hemisphere #fff6e8 / #5a4a3c ×1.45.
  - Key #fff0dc ×3.9 from the upper left-front; fill #fff4e8 ×.45.
  - **Real soft shadows:** `shadows="percentage"` (PCFSoft is removed in r186), 2048 on high and 1024 on mid, radius 4, bias −6e-4, normalBias .025. `autoUpdate` is off; shadows are re-rendered only when something moves.
  - A ShadowMaterial catcher (#5b4027 at about .22) plus a blob shadow under each part.
  - NoToneMapping. Environment light only on glossy parts (meter glass, brass), not on everything as today.
- **Ink.** Keep our postprocessing Effect, and add:
  - a per-object **ink strength** channel;
  - an `inkFlat` facet-crease option;
  - a crease weight of .4 within one id;
  - silhouettes only where the neighbouring id is not nearer;
  - ortho depth in world units (postprocessing's `getViewZ` handles ortho);
  - 2.1 px × DPR;
  - saturation 1.1;
  - **focus fade**: parts outside the current shot fade 45% toward paper and their ink halves, over .3 s.
  - Ink colour: our blue-black #1d2430 by default; warm black #1f160f is decided at the golden frame.
- **Ground.** A paper desk drawn by a shader: a faint graph-paper grid anti-aliased with fwidth, plus an answer booklet, a pencil, an eraser and a calculator as ink props at the edges. It is cached to a target while the camera rests (SHOULD).
- **Apparatus v2.**
  - Every box becomes a rounded, bevelled box (`RoundedBoxGeometry`).
  - Chunkier terminals (×1.3).
  - Seeded Canvas2D textures from one materials kit: mahogany grain for the resistance box, pine for the wire board, speckled bakelite for the meter cases, brushed brass, a printed paper label. Roughness .85–.95 and per-part colour jitter.
  - **A compact layout:** the board at the back and the other parts in a front arc, so that a shot fills the frame.
  - Hit targets grow on phones.
- **Motion** (timeline helpers, tweens ≤ .4 s):
  - drop: a 2.2 fall with outBounce, the shadow switched on at impact, and a dust puff;
  - pop: outBack;
  - move: an arc;
  - stagger: .025–.1 s;
  - a lead's draw-on grows along its curve.
- **Sound.** Four WebAudio-synthesised sounds, with no files: lead snap, plug, key, page. They are muted together with the voice.
- **Performance.**
  - `frameloop` switches to "demand" when nothing moves (`setFrameloop`). While the engine or an animation runs, it is "always".
  - A DPR ladder [2, 1.5, 1.25, 1] steps down on slow frames.
  - `compileAsync` warm-up and a 50 ms frame-delta clamp.
  - Low tier: hull outlines, no shadow map, blob shadows only, 30 fps or better.

## Architecture: one script drives all three modes
- A **Script** is a list of **Beats** grouped by the question's stages (the existing 11 `Step.key`s).
  - Every beat has narration (`say`, Watch), one instruction (`instruct`, Practise), a shot and callouts.
  - It may also have an **actor action** (what Watch performs) and a `done(state)` check (what Practise waits for; this reuses `lessons/ohms-law/checks.ts`).
- **The actor uses the same public bench API a student does:**
  - `tapTerminal` twice per lead;
  - `togglePlug` until the box shows R;
  - `toggleKey`.
  - It writes into a demo `OhmsLawRecord` through `readings/record.ts` and `graph/model.ts`.
  - So Watch is also a live proof that the practical works, and the demo's record is marked by the real rules (it must score 20/20).
- **Readings in Watch** come from a new engine function that inverts `meterTargetDeg` (the needle's displayed value, zero error included), rounded as a careful candidate would. The components never compute it.
- **The director** is a renderer-free state machine with play, pause, next, prev, seek, speed and showMe.
  - **Seek is deterministic.** It resets the bench and applies every earlier beat's action instantly, settling the engine headless at 120 Hz. This is the same pattern as Backcountry 101's "jump finishes every earlier step".
  - A beat ends when the voice ends *and* the action's tween ends. The voice has an estimated-duration fallback, because `onend` is unreliable in Chrome after about 15 s, and sentences are chunked.
- **Where bench truth lives.** `bench.supervisor` exposes the bench's own truth:
  - the displayed readings;
  - a log of settled readings at each box setting while the key was closed;
  - the effective resistance R_XY ∥ R_V.
  - Only `learn/script/**` (Watch, on the demo bench) and `learn/results/**` (after hand-in) may import it; a test enforces that.

## Files
**Wave 0: lead, branch `claude/exam-seams`**
- `packages/engine/src/ohms-law/meter.ts`: `displayedValue(m, needleDeg, trimDeg)`, the exact inverse of `meterTargetDeg`.
- `packages/engine/src/ohms-law/params.ts`: `demoSeedFor(practiceSeed)`.
- `packages/engine/src/index.ts`: the export lines.
- `packages/rules/src/ohmsLawBench.ts` (new): `checkReadingsAgainstBench`, plus its tests.
- `packages/rules/src/index.ts`: the export line.
- `apps/web/src/learn/wiring/bench.ts`: additive `supervisor` (readings, log, effectiveOhm).
- `apps/web/src/learn/types.ts`: `OhmsLawBench.supervisor`; `PracticalMode`.
- `apps/web/src/learn/script/types.ts`, `learn/voice/types.ts`, `learn/callouts/types.ts`, `learn/results/types.ts`, `scene/look/types.ts`: the contracts below, frozen for Waves 1–2.
- Stubs with fixed props:
  - `learn/script/createDirector.ts`, `learn/voice/createVoice.ts`, `learn/player/Player.tsx`;
  - `learn/callouts/Callouts.tsx`, `learn/paper/QuestionPaper.tsx`, `learn/results/Results.tsx`;
  - `scene/look/{LookCamera,LookLights,LookGround,BlobShadow}.tsx`;
  - `learn/PracticalPage.tsx`.
- `apps/web/src/App.tsx`: `?practical=ohms-law[&mode=watch|practice|exam][&seed=]`, plus the preview switches `?look=ohms-law|meter-bridge`, `?director=1`, `?paper=1` and `?results=1`. `?learn=ohms-law` stays as an alias.
- Docs:
  - AGENTS.md: the D1 rule wording, ownership rows for each slice, ports.
  - `docs/09`: the cut lines below.
  - `docs/07`: the supervisor values and the 21-mark practice scheme.
  - This file's Progress section.
- `.gitignore`: nothing new. The E2E scripts move to tracked `apps/web/scripts/e2e/` (in Integration).
- If D2(a): `scripts/design-targets.ts` (Bun; reads `MODEL_API_KEY` from the server env and never prints it), outputs to `docs/design/exam-redesign/*.webp`.

**Wave 1: four writers in parallel worktrees, Oct 30**

| Slice | Agent | Owns (only these) |
|---|---|---|
| W1-look | `shader-artist` (Opus) | `scene/ink/**`, `scene/look/**`, additive `quality/tier.ts` (DPR ladder; shadows on mid, which also fixes today's mismatch), the `?look=` preview |
| W1-apparatus | `apparatus-modeller` | `apparatus/ohms-law/**`, new `apparatus/materials/**`, `layout.ts` v2 (the same `TerminalId`s and the same component props; additive only: `Lead.drawn` 0..1), a `PenNib` cursor prop |
| W1-director | `general-purpose` (Opus) | `learn/script/**` (except `types.ts`), `learn/voice/**` (except `types.ts`; a speech queue over `examiner/speak.ts` with rate, word callbacks, chunking, fallback timer and mute; `sfx.ts`), `learn/player/**`, additive `learn/timeline.ts` (outBounce, quad; drop, pop and arc helpers), the `?director=1` preview |
| W1-paper | `ui-builder` | `home/**` (the picker), `learn/paper/**`, `learn/results/**`, the `?paper=1` and `?results=1` previews |

**Wave 2: four writers, Oct 31** (they start only after Wave 1 has merged and the golden frame is approved)

| Slice | Agent | Owns |
|---|---|---|
| W2-watch | `circuit-engineer` (Opus) | `learn/lessons/ohms-law/script.ts` (+ test): every beat, actor action, shot and callout; the narration in WAEC wording |
| W2-guide | `circuit-engineer` (Opus) | `learn/lessons/ohms-law/{guide.ts,checks.ts}` (instructions, mistake → voice lines, the hint ladder, which beats allow Show me), `learn/wiring/**` (bigger hit targets, hover highlight, both target terminals ringed, wrong-tap shake; and the Wave 0 review's note: `supervisor.test.ts` counts each needle's settle separately) |
| W2-callouts | `ui-builder` | `learn/callouts/**` (one DOM overlay; anchors projected per frame without drei `Html`; leader lines; a spring; label flip), `learn/stage/**` (the entrance drop, the focus set → ink focus-fade uniform) |
| W2-hero | `shader-artist` (Opus) | `lab/LabBench.tsx` (camera, lights, shadows), `apparatus/meter-bridge/**` (bevels and the materials kit). The reveal still works, and golden marks are unchanged. |

**Integration: a fresh Opus `general-purpose` integrator in its own worktree, Nov 1. The lead gates it.**
- `learn/PracticalPage.tsx`: phases paper → mode → Watch, Practise or Exam → results. It owns the seeds and the director per mode. `LearnPage.tsx` becomes its bench view.
- In Practise and Exam it passes the director a wrapper of her bench **without** `supervisor` (Wave 0 review: `Omit<>` hides it in the type only).
- Wiring Callouts, Stage, Player, LookCamera, LookLights and LookGround into the canvas.
- `apps/web/scripts/e2e/{watch,practise,exam,noleak}.mjs`.

**Beauty pass, Nov 2.** `visual-qa` compares the current state with the golden frame and the targets and returns at most 10 fixes. Two fix writers (look, UI) take them in parallel. Then the bug bash and the freeze.

## Contracts (Wave 0 writes these exactly; frozen until Integration)
```ts
// packages/engine: ohms-law/meter.ts and params.ts
/** The value the needle points at on the scale (zero error included): the inverse of meterTargetDeg. */
export function displayedValue(m: MeterParams, needleDeg: number, trimDeg: number): number;
/** A demonstration bench whose wire resistance differs from the practice bench's by at least 20%. */
export function demoSeedFor(practiceSeed: number): number;

// packages/rules: ohmsLawBench.ts
export interface BenchLogEntry { boxOhm: number; iShown: string; vShown: string }
export interface ReadingCheck {
  row: number; boxOhm: number; col: "I" | "V";
  wrote: string; meterShowed: string | null; ok: boolean; // ok: within one scale division
}
export function checkReadingsAgainstBench(
  record: OhmsLawRecord, log: readonly BenchLogEntry[],
  divisions: { ammeterA: number; voltmeterV: number },
): ReadingCheck[];
// Accuracy mark: the existing markOhmsLaw(record, { teacherXyOhm }) receives supervisor.effectiveOhm()
// in Practise and Exam after hand-in (D1(d)). No change to markOhmsLaw's signature.

// apps/web/src/learn/types.ts (additive)
export type PracticalMode = "watch" | "practice" | "exam"; // UI word: "Practise"
export interface BenchSupervisor {
  reading(meter: "ammeter" | "voltmeter"): string | null; // 2 d.p.; null while the needle moves
  lengthText(): string;                                    // XY in cm to 1 d.p.
  log(): readonly BenchLogEntry[];
  effectiveOhm(): number;                                  // R_XY ∥ R_V
}
// OhmsLawBench gains: readonly supervisor: BenchSupervisor

// apps/web/src/scene/look/types.ts
export interface LookShot { id: string; focus: readonly [number, number, number]; spanM: number; azimuthDeg?: number }
export interface Covered { left: number; right: number; top: number; bottom: number } // CSS px
export interface LookCameraProps { shot: LookShot; covered: Covered; drag?: boolean; reducedMotion?: boolean }
export interface LookLightsProps { shadowsDirty: React.MutableRefObject<boolean> }
export interface InkFocus { ids: ReadonlySet<number> | null } // null = everything in focus

// apps/web/src/learn/callouts/types.ts
export interface CalloutSpec { anchor: PartId | TerminalId; label: string; sub?: string; kind: "name" | "do" | "reading" }

// apps/web/src/learn/script/types.ts
export type RecordField =
  | { kind: "length" } | { kind: "header"; col: "R" | "I" | "V" }
  | { kind: "cell"; row: number; col: "R" | "I" | "V" }
  | { kind: "precaution"; index: number } | { kind: "law" } | { kind: "lengthCalc" }
  | { kind: "graph"; part: "axisX" | "axisY" | "scaleX" | "scaleY" | "deltaY" | "deltaX" | "slope" };
export type ValueSource = { from: "ammeter" | "voltmeter" | "rule" } | { text: string };
export type ActorAction =
  | { kind: "enter"; parts: readonly PartId[] }
  | { kind: "lead"; from: TerminalId; to: TerminalId }
  | { kind: "plug"; ohm: number }
  | { kind: "key"; closed: boolean }
  | { kind: "loupe"; target: "ammeter" | "voltmeter" | "rule" | null }
  | { kind: "write"; field: RecordField; value: ValueSource }
  | { kind: "plot"; row: number } | { kind: "line" } | { kind: "triangle" }
  | { kind: "wait"; s: number };
export interface Beat {
  id: string; stage: string;          // Step.key
  say: string;                        // Watch narration; never a practice-bench value
  instruct: string;                   // Practise: the one instruction she hears
  shot: string;                       // LookShot.id
  callouts?: readonly CalloutSpec[];
  focus?: readonly PartId[];
  act?: ActorAction;
  done?: (s: BenchState) => boolean;  // Practise waits for this
  showMe?: boolean;                   // setup actions only
}
export interface Script { lessonId: "ohms_law_vi"; shots: readonly LookShot[]; beats: readonly Beat[] }
export interface DirectorState {
  mode: PracticalMode; beat: number; playing: boolean; speed: 1 | 1.5 | 2;
  caption: string; waiting: boolean; hint: 0 | 1 | 2 | 3; finished: boolean;
}
export interface Director {
  readonly state: DirectorState;
  readonly demoRecord: OhmsLawRecord;          // Watch only
  play(): void; pause(): void; next(): void; prev(): void; seek(beat: number): void;
  setSpeed(s: 1 | 1.5 | 2): void; showMe(): void;
  advance(dtS: number): void;                  // from useFrame
  subscribe(fn: () => void): () => void; dispose(): void;
}

// apps/web/src/learn/voice/types.ts
export interface VoiceGuide {
  say(text: string, opts?: { onWord?: (charIndex: number) => void; onEnd?: () => void }): void;
  stop(): void; readonly speaking: boolean; muted: boolean; rate: number; // rate default 0.95
}
```

**Wave 0 as built (the committed types.ts files are the source of truth)**
- `displayedValue(m, needleDeg)` takes 2 args. The trim moves the needle itself, the same as the engine's test-helper `dialReading`.
- New `effectiveXyOhm(p)` and `DEMO_MIN_OHM_DIFFERENCE`.
- `DirectorState` gains `act`, `actT` and `loupe`. New `DirectorOptions`.
- New contract files `learn/paper/types.ts` (`PracticalQuestion`, `QuestionPaperProps`) and `learn/results/types.ts` (`ResultsProps`). Also `CalloutsProps`, `LookGroundProps`, `BlobShadowProps` and `VoiceOptions`.
- `learn/results/handIn.ts` is the only place hand-in reads the supervisor.
- `checkReadingsAgainstBench`'s third argument gains an optional `ammeterZeroErrorA` (default 0): an I cell is ok within one division of the shown value or of shown − zero error (the nearer), so a hand-corrected zero error is not penalised. `meterShowed` stays the dial's value; V is unchanged. `handIn` passes `params.ammeter.zeroError`.
- Her bench's truth never reaches the director: `DirectorOptions` is a union on `mode`. Watch gets the demonstration `OhmsLawBench`; Practise and Exam get `Omit<OhmsLawBench, "supervisor">`.
- The supervisor reads a meter only after its needle has stayed below 0.5°/s for 0.25 s of consecutive 120 Hz steps (`NEEDLE_SETTLED_HOLD_S`), so an overshoot's turning point is never read or logged. The ammeter's floor is −(|zeroError| + division/2), so a −1 division zero error at rest reads "-0.02".
- Leak guard as built (`apps/web/src/boundary.test.ts`): code with comments stripped may name `supervisor` (member, destructuring or bracket key) only in `learn/script/**`, `learn/results/**`, `learn/wiring/bench.ts`, `learn/types.ts` and tests.
- Deferred §Tests: `a careful candidate's reading` waits for a shared reading formatter (today only the supervisor's `toFixed(2)` formats a reading). The Director, Voice, Script, Guide and E2E tests belong to their waves (W1-director, W2-watch, W2-guide, Integration).

## Tests (by name, with expected values and sources)
- **Engine** (science-verifier):
  - `displayedValue inverts meterTargetDeg`: a round trip over readings 0, 0.25, 0.5, 0.75 and 1.0 A, and 0, 1 and 3 V, with a zero error of ±0.02, to within 1e-9.
  - `a careful candidate's reading`: displayed 0.5534 A → "0.55"; 1.6662 V → "1.67". Readings to 2 d.p. per the WAEC Chief Examiner's report (WASSCE 2018 Physics 3, weaknesses: "read … to the required accuracy of each instrument").
  - `demoSeedFor keeps the wires 20% apart`: for seeds 1–2000, |R_demo − R_practice| / R_practice ≥ 0.20, and the demo seed never equals the practice seed.
- **Rules** (science-verifier):
  - `a reading within one division is accepted`: wrote "0.56", showed "0.55", division 0.02 A → ok.
  - `a reading off by more than one division is flagged`: "0.60" against "0.55" → not ok.
  - `a voltmeter reading is checked against the voltmeter division`: 0.05 V.
  - `an empty cell is flagged with what the meter showed`.
  - `a row at a box setting never logged gives meterShowed null`.
  - `copying the demonstration table loses the accuracy mark`: the demo record marked with the practice bench's `effectiveOhm` loses PHYS-ACCURACY (its slope is ≥ 20% off, beyond the 10% tolerance).
- **Bench** (`learn/wiring/bench.test.ts`): `supervisor logs a settled reading per box setting while the key is closed`; `supervisor.reading is null while the needle moves`.
- **Director** (W1-director):
  - `seek(n) gives the same bench and record as playing to n`;
  - `Practise waits for done() and never runs act`;
  - `speed 2 halves beat time`;
  - `a beat ends on the voice fallback when onEnd never fires`;
  - `Show me runs only on showMe beats`;
  - `Exam ignores beats`.
- **Voice:** `long text is chunked by sentence`; `muted speaks nothing but still ends beats`.
- **Script** (W2-watch):
  - `Watch on the demo bench scores 20/20` (headless: director plus bench plus `markOhmsLaw`), and 21/21 with its own `effectiveOhm`;
  - `every beat has a shot and narration`;
  - `no narration contains a number that is not in the question` (question numbers: 0, 1, 5, 10, 20, 40 and 60 Ω; 0.2 mm; 7 Ω; 8.8 × 10⁻⁷ Ω m; π = 22/7);
  - `the Watch script performs exactly the seven leads of DIAGRAM_LEADS`.
- **Guide** (W2-guide): `each wrong tap yields a spoken correction with no digits in it`; `every non-exam beat has done() or is narration-only`; `Show me never covers readings or the graph`.
- **Leak guard:** `only learn/script and learn/results import supervisor` (a source scan in Vitest).
- **E2E** (Integration, Playwright through the real page):
  - `watch.mjs`: Watch completes at 2×, the demo mark sheet reads 20/20, no console errors.
  - `practise.mjs`: guided wiring through bench taps, then the notebook and graph by keyboard; hand in; results show the reading check.
  - `exam.mjs`: no rings, callouts or hints are present.
  - `noleak.mjs`: before hand-in, no supervisor value of her bench appears in the DOM in Practise or Exam; in Watch, only demo-bench values appear.

## Done-criteria (each with its proof)
1. From `/`, the picker opens the practical; the question is read aloud with highlighting, and the parts drop in as named. Proof: `/verify-3d` on `/?practical=ohms-law` at 390×844 and 1440×900, plus a 6-frame strip of the entrance.
2. Watch performs the whole practical and ends on 20/20. Proof: `bun apps/web/scripts/e2e/watch.mjs`, plus the script test.
3. Practise guides one action at a time and corrects mistakes without values. Proof: `practise.mjs` and the guide tests.
4. Exam has no guidance. Results show marks and, after hand-in only, the reading check. Proof: `exam.mjs` and `noleak.mjs`.
5. The look matches the recipe: ortho camera, soft shadows, upgraded ink, bevelled textured apparatus, paper ground. The **user approves the golden frame** (Wave 1), and `visual-qa` passes against it in the beauty pass.
6. Performance: `?quality=low` at 30 fps or better; laptop at 60 fps. Proof: visual-qa's fps line.
7. The hero, `?flow=1&golden=note1`, has the same look, the reveal works, and golden marks are unchanged. Proof: the hero E2E and the golden tests.
8. `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` are all green; no console errors; the test count does not fall.

## Implementer
- **Wave 0: lead.** It covers the engine, the rules, the contracts and the docs. science-verifier reviews the engine and rules.
- **Waves 1–2:** the agents in the tables, each with `isolation: "worktree"`, ports 5177–5180, and its plan section as the brief.
- **Integration:** a fresh Opus integrator subagent, so the lead's context stays clear. The lead runs every gate.
- **Beauty:** two fix writers.
- The lead never writes slice code. If a slice fails twice, it goes to `debugger`.

## Context management (the user asked for this explicitly)
The aim is that no lead session runs past about 40% of its context, because a full context degrades the work.
1. **State lives in files, not chat.** Before any slice starts, this plan holds the Progress checklist, the contracts and every slice's scope. Each wave ends with Progress ticked, a BUILD_LOG line and the `resume-point` memory updated (one line).
2. **One lead session per wave.** At the end of each wave I say "Ready for `/clear`". You run it, and the start hook prints the latest plan. I then read only **Progress** and the next wave's section. Five sessions in total: W0, W1, W2, Integration, Beauty.
3. **Writers start fresh.** Each slice is a new subagent in its own worktree, and the brief is about 10 lines: "Read `docs/plans/exam-redesign.md` §<slice> and AGENTS.md; own only these paths; port N; the four checks; commit on your branch; report in ≤ 15 lines." The writer reads the code itself, so the lead never loads source files. Fix rounds go through `SendMessage` to the same writer, so its context grows, not mine.
4. **Gates return verdicts, not logs:**
   - `verifier`: failures only;
   - `science-verifier`: ≤ 20 lines;
   - `visual-qa`: ≤ 8 lines, PASS/FAIL;
   - `code-reviewer`: findings only, ≤ 25 lines.
   - The lead looks at a maximum of 2 screenshots per slice, at scale ≤ 0.6, and only for sign-off.
5. **The lead never reads** a file over 150 lines, a diff, a bundle, a test log or a transcript. It asks an agent instead.
6. **A tripwire.** If `/context` passes 50% mid-wave, I stop launching work, write Progress, and ask for `/clear`.
7. **Optional, decided in Wave 0:** run each wave's gates as one background Workflow (≤ 10 agents), so even the verdicts arrive as a single summary. I'll read the workflow-authoring guide once and dry-run it on Wave 0 first. If its worktree or permission behaviour gets in the way, we keep the Agent-tool gates above.
8. **Your approvals.** Push, PR and merge prompts come to about 3 per slice, or about 30 in all. To cut that, I can merge each wave's PRs in one sitting.

## Cut lines (they replace docs/09's Day 5–8 rows for this work)
- **MUST (by the end of Nov 1):**
  - the picker; the question paper with read-aloud and the entrance;
  - Watch end to end, with player controls and callouts;
  - guided Practise end to end;
  - the results with the reading check (D1);
  - the look recipe on the V–I lab (camera, lights, shadows, ink, apparatus v2, ground);
  - the E2E scripts.
- **SHOULD (Nov 2):**
  - Exam polish (timer display);
  - the hero look (W2-hero);
  - sounds;
  - the DPR ladder and the demand frameloop;
  - the cached ground;
  - baked step thumbnails (with an ink-icon fallback).
- **COULD:**
  - the D3 viva with Muse Spark;
  - the "as printed" diagram beside ours;
  - merged static geometry;
  - focus fade on the hero.
- **Later:** metre-bridge Watch/Practise, titration, Variant B.

## Schedule
| Day | Lead session | Writers |
|---|---|---|
| Thu Oct 29, night | This plan, D1–D3 | none |
| Fri Oct 30, AM | **W0** seams → gates → merge → `/clear` | none |
| Fri Oct 30, PM | **W1** launch, then gates as each slice reports; merge; **golden frame to the user** → `/clear` | W1-look, W1-apparatus, W1-director, W1-paper |
| Sat Oct 31 | **W2** launch, gates, merge → `/clear` | W2-watch, W2-guide, W2-callouts, W2-hero |
| Sun Nov 1 | **Integration** gates, E2E, phone check → `/clear` | the integrator |
| Mon Nov 2 | **Beauty** pass, bug bash, SHOULD items, **freeze 23:59** | 2 fix writers |
| Nov 3–4 | You: phone test, video (Watch mode at 1× is its backbone), Fly deploy, submission | none |

## Risks
1. **The ortho camera and the compact layout disturb the hero's reveal and the existing poses.** The hero moves last (W2-hero) and on its own branch. Fallback: the hero keeps its perspective camera and takes only the lights, shadows, ink and materials.
2. **`speechSynthesis` is unreliable:** iOS needs a gesture, Chrome cuts off after about 15 s, and an en-NG voice may be missing. Captions are always on screen; text is chunked by sentence; every beat has an estimated-duration fallback; the first speech starts from the "Read it to me" or "Watch" tap; there is a mute button. The director never waits on `onend` alone.
3. **Scope against four days.** The MUST list is the product. W2 cannot start until the golden frame is approved, so the look is settled once, not argued slice by slice. If a slice slips, the beauty day absorbs it and the SHOULD items drop first.

## Wave 1 handoff notes (for Wave 2 and Integration; from the writers' reports and reviews)
- **Paper (#79):** `QuestionPaper` needs a parent with a definite height (it scrolls inside and pins its actions). An idle reader's `start()` no longer clears the shared voice queue, so nothing else may be speaking when "Read it to me" starts (or make `start()` call `voice.stop()`). The serif face is a system stack via `--f-serif`; a self-hosted `@fontsource` font is a beauty-pass item. `?paper=1&read=1` uses a scripted voice.
- **Apparatus v2:** `Lead.drawn` (0..1) and `<PenNib target tap quality />` still have to be wired into the bench (W2-callouts `learn/stage/**` or Integration). Apparatus should adopt the look's per-mesh `userData.inkStrength` / `inkFlat`. Open: tray materials, cable jag at footprint ramps (`floorAt`), meter glass. Lesson camera poses are derived from `OHMS_LAW_LAYOUT`.
- **Director:** the page steps the bench, not the director; don't step the Watch bench twice. Call `director.play()` from a tap (iOS speech). `createDirector` returns a `DirectorHandle` (Director plus `script`, `voice`, `beatProgress()`, `onEvent()`). Scene helpers in `script/timing.ts`: `leadPhase(actT)`, `partsEnteredBefore(script, beat)`. Pass `playerCovered(w, h)` to LookCamera's `covered`. `{from:"rule"}` is the length plus " cm", or ΔV, ΔI and s from the actor's own triangle. Seek is not digit-deterministic (the cells polarise and the wire warms), so a meter-write beat's first text is cached for instant seeks. `voice/` builds its own utterances (it reuses only `pickVoice` from `examiner/speak.ts`). `DirectorPreview` sets `visual.ring`, which belongs to the page.
- **W2-watch:** the writer found the scales "2 cm to 0.1 A" and "1 cm to 0.2 V" fit every demo seed 1–300 (first row 0.51–0.84 A, 2.02–2.61 V). science-verifier must confirm before the script relies on them.
- **Look:** canvases that use the look wrap in `<LookTier.Provider value={tier}>` and set `shadowsDirty.current = true` whenever something moves. The stage's focus set must include nut ids (100+) and lead ids (140+). Shadow normalBias is 0.0025 m (not .025: that detaches the shadows of 1 cm terminals). The demand frameloop belongs to the canvas owner (Integration). Camera stands front-right (key light from front-left), pending the user's golden-frame approval.
- **Director, Integration fixes (#80 review):** add a JSDoc to `benchState` in `learn/script/types.ts`: the page must keep the same `record` object until she edits, or the hint ladder never fires. A Show me tap on a full terminal still emits the "lead" event (a snap sound); emit it only when the lead count went up.
- **`?learn=ohms-law` on the phone:** the legacy perspective camera still clips part of the resistance box. The look's `fitShot` framing replaces it at Integration.
- **Mid-tier shadows (W1-look grant):** `SETTINGS` now casts shadows on mid, which also turns them on for `LearnPage.tsx` and `LabBench.tsx`. Those pages still re-render the shadow map every frame. W2-hero (LabBench) and Integration (the bench view) must set `shadowMap.autoUpdate = false` and use `shadowsDirty`.
- **For W2-hero:** a thin part lying on another inked part (the metre-bridge wire on the plank) can still ink fully dark; this predates Wave 1. A fix: discount the neighbour's own slope with one more read in the same direction when the ids match. The hero's other parts sit about 3 cm above its desk.
- **Golden frame (Oct 29):** the user saw the real `?look=ohms-law` render beside `golden-frame.webp` and approved it with three tweaks, made in W1-look round 3 before merge: ink lines about 3 px, stronger soft cast and contact shadows, and a portrait phone camera (steeper, with the bench's long side running up the screen, filling the frame). Kept: the 45° iso camera from front-right, the desk props (answer booklet, pencil, eraser, calculator), and ink #1d2430.

## Backcountry motion, watched in real Chrome (Oct 29): what Watch and Practise must feel like (the user: "that's exactly what I want")
Seen in BC101's fire lesson (autoplay, steps 1 → 4 in about 8 s). Wave 2 (W2-watch, W2-callouts, W2-guide) builds to this, and the director already has the hooks for it:
1. **A fixed stage.** The camera does not move between steps. The scene builds up in place: each step adds to the same composition, and earlier objects stay where they were. Framing is at BC101 scale (hero objects about 150–250 px on a laptop), so the bench is framed close enough for its parts to read. The only camera move we keep is the meter loupe for a reading; it eases in, then returns to the same frame. Per-beat LookCamera shots that cut or pan between parts are dropped in favour of this.
2. **One visible physical action per instruction.** Parts arc in and settle with a small bounce, one at a time (timeline `drop`/`arc`/`pop`, tweens ≤ 0.4 s, outBack and outBounce). Leads draw from terminal to terminal (`Lead.drawn`), the pen nib taps, needles swing and settle, readings are written into the table. Nothing changes off-screen.
3. **One label at a time.** A single chip on a leader line names the active object ("AMMETER", "RESISTANCE BOX R = 2 Ω"), and it moves to the next object on the next action. No clutter of labels.
4. **Everything stays in step.**
   - The side panel's instruction checklist highlights the active sub-step (orange) and ticks finished ones.
   - The bottom step tabs (thumbnails and names) tick off.
   - A progress count reads "3/6".
   - The caption always matches the action on screen.
5. **It plays itself, under her control.** Autoplay with pause, restart, 1× speed and previous/next. She can just watch, or step through. In Practise, the same stage and the same checklist apply, but she performs each action and the chip and checklist follow her.

## Page layout: Backcountry's (the user, Oct 29: "that looks amazing… exactly what I want")
The practical page (Watch, Practise and Exam) takes BC101's layout, in our palette (paper, ink #1d2430, orange accent). **The user opted in to max effort and to ultracode (Workflow orchestration) for this layout and for the asset pass.** Measured in real Chrome at 1728×907 (BC101 `?lesson=fire`):
- **Stage:** the 3D canvas is full-bleed behind everything (x 67 → right edge, full height). All the UI floats over it on paper cards. There are no boxed panes.
- **Left rail:** 67 px, full height, dark (BC101 #2e392c; ours the ink #1d2430), with an icon nav from y 114 and a faint motif at the foot. Shadow `1px 0 0 rgba(0,0,0,.08)`.
- **Brand, top left:** at (89, 15), 423×76. The title is in a condensed face at 48.5 px/600 with a small tracked uppercase subtitle (ours: "SNAPLAB NG", then "WATCH · PRACTISE · EXAM").
- **Player, top centre-right:** at (976, 31), 244×49. Card rgba(245,237,221,.97), radius 10, shadow `0 2px 6px rgba(60,45,25,.06)`. Buttons 34×36, radius 8: restart, info, previous, play/pause, 1×.
- **Status card, top right:** at (1234, 16), 478×78, the same card style: the practical's name, a progress bar, "3/11", and the brand credit.
- **Guide panel, right:** at (1246, 109), 467×494, the same card. Tabs (Instructions / Why it works / Precautions) 440×64. Then the step title, a short description, and the sub-step checklist (404×173): an icon per row, the active row in orange with ›, done rows ticked, and an expand control.
- **Step bar, bottom:** from y 758, 149 high, across the stage. A "PRACTICAL: OHM'S LAW (V–I)" selector, then one tab per stage with a baked thumbnail and a numbered name; the active tab outlined in orange; done tabs ticked; previous/next arrows at the right end.
- **Callout chip:** a condensed face at 18 px/500, uppercase, letter-spacing .9 px, on the dark ink, radius 3, shadow `0 2px 6px rgba(40,30,20,.12)`, on a leader line to a ringed dot.
- **Fonts:** BC101 uses Barlow, Barlow Condensed and DM Mono. We self-host Barlow and Barlow Condensed (`@fontsource`; it works offline in the PWA), which settles the paper slice's font request. Adding the dependency is the lead's job.
- **Phone layout:** not measured yet. The layout writer measures BC101 at 390×844 in Chrome first and copies how it stacks.
- **Mapping:** this layout replaces where the W1 Player puts its controls (the stage chip and ticks become the status card and the step bar; the caption stays a pill over the stage). It also replaces where the W2 callouts sit and the Integration page shell. The director contracts don't change. Plan the layout slice to run alongside the asset pass on disjoint paths (`learn/shell/**`, `learn/player/**`, CSS), under its own row in "Who owns what".
