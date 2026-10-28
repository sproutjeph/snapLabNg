# Plan: Ohm's law (V–I), a hands-on practical (`?learn=ohms-law`)

Approved by the user on Oct 28 (Day 3). The look is in `docs/plans/ink-look.md`. Lead: Claude. Built in waves by parallel subagents, each in its own git worktree (`.claude/worktrees/`), on disjoint paths.

## Goal
A student on a phone, unaided:
- identifies every item;
- wires the circuit from the diagram;
- sees a mistake and fixes it;
- takes all seven readings with parallax handled;
- types her table;
- plots V against I and finds the slope;
- states two precautions in the reported tense.

The engine decides every number; `packages/rules` marks what she wrote. Exam mode (`&mode=exam`) is the same bench with every hint off. It runs at ≥30 fps on the low tier with no console errors, and never shows an expected value: not I, V, R_XY or the slope.

## The question (the student follows it)
> You are provided with an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary materials.
> 1. Measure and record the length XY of the resistance wire provided.
> 2. Connect the circuit as shown in the diagram.
> 3. With R = 0 Ω, close the key K. Read and record the current I and the corresponding voltage drop V across the wire.
> 4. Set R = 1 Ω, close the key, read and record I and V.
> 5. Repeat for five other values of R = 5, 10, 20, 40 and 60 Ω. Tabulate.
> 6. Plot V (vertical) against I (horizontal).
> 7. Determine the slope s.
> 8. State two precautions.
>
> (b)(i) Mention and state the law on which the experiment is based.
> (b)(ii) A wire of diameter 0.2 mm and resistance 7 Ω has resistivity 8.8 × 10⁻⁷ Ω m. Calculate its length (π = 22/7).

- **The circuit for this practical** is the corrected diagram: E → K → A → R → X–Y → back to E, with V across X and Y (`DIAGRAM_LEADS` in `packages/engine/src/ohms-law/types.ts`). The source sketch showed only E, K, A and R.
- **Both diagrams are our own SVG.** No WAEC scan appears anywhere, because the hackathon rules ban scans and logos.
- **The source's "observation" scheme is not used.** It belongs to the R-against-I⁻¹ practical, a later Variant B.

**Decided (user, Oct 29):** the lesson keeps the title "Ohm's law (V–I)" in the header and rail, although it names the law that (b)(i) asks for.

## Out of scope
- Variant B, `r_vs_inverse_i`.
- Part (b) with a micrometer measurement.
- The snap flow for this experiment.
- Live Spark judging of the examiner answers (COULD).
- The titration engine and marking (COULD; the user chose Ohm's law first).

## Physics decisions (science-verifier checks each)
- **Ammeter range.** R_XY is seeded at **2.8–4.5 Ω** of constantan (ρ = 4.9×10⁻⁷ Ω m, the engine's existing constant). **Pick the gauge first, then the length**, so the resistance and the length she measures agree: SWG 28 (4.41 Ω/m) at 63.5–100 cm; SWG 29 (≈5.24 Ω/m) at 53–86 cm; SWG 30 (6.29 Ω/m) at 45–72 cm. With fresh cells (E ≤ 3.2 V) and r ≥ 0.6 Ω for the pair, I(R=0) stays ≤ 0.92 A on the 0–1 A meter (0.02 A divisions), and V stays ≤ 2.8 V on the 0–3 V meter (0.05 V divisions). The brief's 1.5–3 Ω range would reach 1.46 A. At R = 60 Ω, I ≈ 0.046–0.050 A (about 2.4 divisions) and V ≈ 0.13–0.22 V. Both read to 2 d.p. by half-division estimate, which matches the dials.
- **Heating.** Constantan's α is 8×10⁻⁶ K⁻¹ (the value docs/07 already uses). At R = 0 the wire warms by tens of kelvin, but ΔR/R stays ≤ 0.1 % (about 0.003 V, far below a half-division), so heating is modelled honestly and stays invisible. The visible cost of leaving K closed is cell polarisation (`stepCell`, with cited dry-cell values). The precaution "key opened between readings (to avoid heating)" is still credited: WAEC credits the action.
- **Rows.** All seven rows the student writes are checked. The "at least five rows" items are earned when five or more rows pass. Note that the metre bridge marks the *first* five (`packages/rules/src/meterBridge.ts:137`).
- **Physics of the bench.** V/I = R_XY ∥ R_V ≈ R_XY for every R, so the slope s is about the resistance of XY and the line passes near the origin.
- **(b)(ii).** A = πd²/4 = (22/7)(0.2×10⁻³)²/4 = 3.143×10⁻⁸ m², so L = RA/ρ = 7 × 3.143×10⁻⁸ / 8.8×10⁻⁷ = **0.25 m**.
- **(b)(i), Ohm's law.** The current through a metallic conductor is directly proportional to the potential difference across its ends, provided temperature and other physical conditions stay constant.

## Contracts (Wave 0, frozen; ask the lead to change one)
- **`packages/contracts`**
  - `Experiment` gets `ohms_law_vi`.
  - `SnapExperiment` (without it) is used by `BlueprintSchema` and `SnapEvent`, so the Spark schema and fixtures are unchanged.
  - `RuleCode` gets `PHYS-2DP`, `PHYS-TREND`, `PHYS-LAW` and `PHYS-CALC`.
  - `OhmsLawRecord` (`ohmsLaw.ts`) holds everything she typed or drew, as written.
- **`packages/engine/src/ohms-law/types.ts`**
  - `TerminalId`, `PartId`, `PART_TERMINALS`, `MAX_LEADS_PER_TERMINAL`, `Lead`, `JointState` and `DIAGRAM_LEADS`.
  - `METER_ZERO_DEG = -40`, `METER_FULL_DEG = 40` and `METER_STOP_DEG = 45`.
  - `OhmsLawParams`, `OhmsLawInputs`, `OhmsLawReadout`, `OhmsLawState`, `DiagramIssue` and `DiagramComparison`.
  - Slams are monotonic counters (`ammeterSlams`, `voltmeterSlams`), so a frame that runs several 120 Hz steps never misses one; parts compare with the count they last saw.
  - The engine may add internal fields to its params and state, but never removes or renames one.
- **`packages/engine/src/ohms-law/api.ts`:** frozen signatures `paramsFromSeed`, `createOhmsLaw`, `stepOhmsLaw` and `compareWithDiagram`. The current bodies are stubs.
- **`apps/web/src/learn/types.ts`**
  - `PartId` (the circuit parts plus leads, nuts, sandpaper, paper, micrometer and rheostat), `LeadColour` and `BenchLead`.
  - `OhmsLawVisualState`, the ref the bench controller writes and `useFrame` reads.
  - `Terminal`, `TerminalRegistry`, `CameraPose`, `Callout`, `IdentifyCard`, `ProcedureNote`, `BenchState`, `Step`, `Lesson` and `LessonMode`.
- **`apps/web/src/learn/terminals.tsx` and `terminalRegistry.ts`:** `TerminalProvider`, `useTerminalRegistry` and `useTerminal(id, part, label, ref)`.
- **`apps/web/src/learn/timeline.ts`:** `createTimeline().add(at, dur, update, {ease}).seek(t)` and `ease.{linear,inOut,outCubic,outBack}`.
- **`apps/web/src/apparatus/ohms-law/layout.ts`:** `OHMS_LAW_LAYOUT`, `TERMINAL_LABELS`, `TERMINAL_PART`, `INK_IDS` (fixed ink ids per part, nut and lead), `PartProps` and `tapOnly`. The loop runs leftward along the back (cells → K → A → R), then X (front left) → Y (front right) → cells. K1, A+ and R1 are on each part's right.
- **Stub components with frozen props:** `CellHolder`, `KeyK`, `Meter`, `ResistanceBox`, `WireBoard`, `Lead`, `TerminalNut` and `Tray`. `KitPreview` (`?kit=ohms-law`, with `&part=`, `&leads=1`, `&deg=` and `&quality=`) is lead-owned.
- **`apps/web/src/scene/ink/`:** `inkTag`, `readInk`, `nextInkId`, `<InkGroup id thin>`, the `<InkComposer quality reveal>` stub and the `<PaperDesk>` stub (see ink-look.md).
- **Shared metre-bridge parts:** `PlugBox`, `PlugKey` and `Galvanometer` take `Pick<MeterBridgeVisualState, …>`, and `PlugBox` takes an optional `width`.

## Ports (one dev server per slot)
- Lead: 5173. Gemini: 5174. Lead reviews: 5175. Muse Code: 5176.
- Wave slots 1–4: **5177, 5178, 5179, 5180**, in the order of each wave's table.

## Every slice brief
1. **First commands, in the worktree:** `git branch -m claude/<slice>`, then `bun install`.
2. **Read:** this plan, AGENTS.md, and the `.claude/rules/*.md` files for the paths you touch.
3. **Paths:** edit only the paths your slice owns. Import the contracts and never change them. If you need a change outside your paths, stop and list it under "Needs from lead".
4. **Visual work:**
   - Run `bun run dev --port <slot> --strictPort` in `apps/web` (in the background).
   - Shoot with `bun run shot -- --route "<route>" --base http://localhost:<slot>`.
   - Open the PNGs and look at them before claiming anything.
5. **Before reporting,** all four must pass in your worktree: `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build`.
6. **Commit** small commits on your branch, files staged by name, with no AI attribution. Never push, merge or touch `main`.
7. **Report (≤ 300 words):** files changed, commands with results, shot paths, open questions, and Needs from lead.

## Wave 1 (Day 4, Oct 29)
| Slot | Slice | Agent | Owns |
|---|---|---|---|
| 1 | Circuit engine | `circuit-engineer` (Opus) | `packages/engine/src/circuit/**`; `packages/engine/src/ohms-law/**` except `types.ts` |
| 2 | Ink look | `shader-artist` (Opus) | see ink-look.md |
| 3 | Apparatus 1 | `apparatus-modeller` | `apps/web/src/apparatus/ohms-law/{CellHolder,Key,Meter,ResistanceBox}*.{ts,tsx}` |
| 4 | Apparatus 2 | `apparatus-modeller` | `apps/web/src/apparatus/ohms-law/{WireBoard,Lead,TerminalNut,Tray}*.{ts,tsx}` |

### Slot 1: circuit engine
- **`circuit/mna.ts`:** general modified nodal analysis. Resistors, EMFs with internal resistance, and switches (open = no element). Dense Gaussian elimination with partial pivoting for ≤ 12 nodes. Guard floating nodes with a tiny leak conductance to ground and report them. Reuse buffers: no allocation in the step path.
- **`ohms-law/netlist.ts`:** union-find the terminals her leads join into nodes, then add each part's body.
  - Cells: two in series, each with its own `stepCell`.
  - Key: `keyContactOhm` when closed, open otherwise.
  - Ammeter: R_A ≈ 0.1 Ω. Voltmeter: ≈ 1 kΩ/V × 3 V.
  - Box: `boxOhm(coils, plugsIn)`, coils 1, 2, 2, 5, 10, 20, 20, 50.
  - Wire XY: `ohm × (1 + α·rise)`.
  - Each lead end adds a joint resistance: tight and clean ≈ 0; loose or dirty adds ohms with a **deterministic** flicker, a function of (seed, t, lead id). No `Math.random`.
- **`ohms-law/bench.ts`:**
  - 120 Hz fixed step: re-solve when the inputs or cells change.
  - `stepCell` for each cell.
  - `stepMeter`: the `stepNeedle` dynamics mapped to dial degrees (zero at −40°, full scale at +40°, stops at ±45°), adding 1 to the slam counter on each hard hit. A reversed meter deflects below zero, reaching the −45° stop only above 1/16 of full scale (leave it to the physics; never script it). Over-range slams at +45°.
  - The seeded zero error offsets the rest angle; `zeroTrimDeg` cancels it.
  - Wire heating: I²R in, Newton cooling out, constantan α cited.
  - `cellDrain01` and `shortCircuit` come from the cell state and the external resistance.
- **`paramsFromSeed`:** a pure PRNG (mulberry32) within the cited ranges: dry cell EMF 1.5–1.6 V, r 0.3–0.6 Ω each, R_XY 2.8–4.5 Ω by choosing the SWG (28, 29 or 30) and then a length in that gauge's range above, `startCm` so the wire sits on the rule, and an ammeter zero error of 0 or ±1 division.
- **`compareWithDiagram`:** electrical equivalence, not exact pairs.
  - Series order is free. The key and box are non-polar. A+ must face E+ along the loop, and V+ must be on X's side.
  - Fill `issues`. Return `missing` and `extra` against `DIAGRAM_LEADS` only when it does not match.
- **Tests (each cites its source; floats use `toBeCloseTo`):**
  - Series circuit and Ohm's law values (Nelkon & Parker, *Advanced Level Physics*; Anyakoha, *New School Physics*).
  - Polarity sign.
  - Ammeter across XY with the loop closed by a lead at R = 0: over range, short-circuit flag, and the cells drain faster.
  - Voltmeter in series: I ≈ 1.07 mA, and the voltmeter reads ≈ the emf, at or past full scale.
  - Open loop: zero everywhere.
  - Loose joint: the reading flickers but stays deterministic for one seed.
  - V/I equals R_XY ∥ R_V within 1 % for all 7 R values, and the intercept is ≈ 0.
  - A seed sweep (≥ 200 seeds): I(R=0) ≤ 0.95 A and V ≤ 2.9 V for every seed.
  - Same seed, same bench.
  - (b)(ii) = 0.25 m (a helper used by rules).
- **Done:** all tests pass and `science-verifier` passes.

### Slots 3–4: apparatus (both slices)
- **Look.** Procedural three.js only, with no model files. Merge static geometry with `mergeGeometries`, use `InstancedMesh` for repeats, and add a small seeded colour jitter. Materials are matte (roughness ≥ 0.6) and suit the ink look.
- **Ink tags.** Tag every mesh with `<InkGroup>` or `inkTag`, using the part's block in `INK_IDS` (body = the block's first id, sub-parts the next ones; nuts `nutBase + TERMINAL_IDS index`, leads `leadBase + index`). Nested groups keep their own tag. Give small parts (needle, screws, plugs) `thin`.
- **Terminals.** Each terminal is a `<TerminalNut>` with the frozen ids. Read `state.current` only inside `useFrame`.
- **Frame rules.** No `new` in `useFrame`. Dispose what you create. Textures ≤ 1024 px (canvas dials are fine).
- **Low tier.** Fewer segments, and no per-frame canvas redraws.
- **Shots.** `?kit=ohms-law` and `&part=<slot>` at phone and laptop size. Use `&deg=` to check needles and `&leads=1` to check leads.

**Slot 3: apparatus 1**
- **Cell holder:** two cells with brass cap + and zinc base −, printed "1.5 V", and + and − screw terminals. Drain shown subtly from `readout.cellDrain01`, with no glow.
- **Key K:** brass blocks on an ebonite base and a removable plug. May wrap `PlugKey`.
- **Meter, for both kinds:**
  - The dial is painted from `fullScale` and `division`, with major numbers, so 0–1 A in 0.02 A divisions and 0–3 V in 0.05 V divisions.
  - A mirror strip under the scale, a black knife-edge needle *above* the dial (so parallax is real), a zero-adjust screw, red + on the right and black − on the left, and "A" or "V" on the face.
  - The needle angle is read from the readout; the slam gives a small shake.
- **Resistance box:** rebuilt from the metre bridge's `PlugBox` dimensions (matte, ink-tagged, instanced plugs; 0.30 m wide for 8 coils) with labels 1, 2, 2, 5, 10, 20, 20, 50 Ω and R1/R2 nuts. It shows plugs out only; it never shows an "R =" readout.

**Slot 4: apparatus 2**
- **Wire board:**
  - A wooden board with brass strips at X and Y and bare, taut constantan between them, placed from `wire.startCm` to `startCm + lengthCm` with `cmToX`.
  - A metre rule alongside, with cm numbers and mm ticks readable in the loupe.
- **Lead:**
  - A sagging tube on a Catmull-Rom curve (follow `TubeWire`'s in-place update pattern), with banana plugs at the ends.
  - Two of the spares carry crocodile clips.
  - `to = "pointer"` gives the rubber band.
  - The tap target is a fatter invisible tube.
- **Terminal nut:** knurled brass, with an optional red or black cap. Untightened is shown slightly raised; tightened is seated. The pulsing dashed ink ring appears when `state.ring === id`. The hit target is ≥ 44 px at bench zoom.
- **Tray:** spare leads, the sandpaper strip, a rheostat (Identify only) and a micrometer screw gauge (Identify only, COULD detail).

## Wave 2 (Day 5, Oct 30)
Started Oct 28 night, while the ink slice was still open. Ports: wiring 5177, shell 5179, readings 5180 and rules 5181 (the ink slice keeps 5178). The shared controller interface is `OhmsLawBench` in `apps/web/src/learn/types.ts`: the wiring slice builds it, and readings, shell and the lesson page code against it. In its own preview, each UI slice drives a fake that satisfies the interface.

| Slot | Slice | Agent | Owns |
|---|---|---|---|
| 1 | Wiring | `circuit-engineer` (Opus) | `apps/web/src/learn/wiring/**` |
| 2 | Readings | `implementer` | `apps/web/src/learn/readings/**` |
| 3 | Shell | `ui-builder` | `apps/web/src/learn/shell/**` |
| 4 | Rules | `circuit-engineer` (Opus) | `packages/rules/src/ohmsLaw*.ts`; additive edits to `precautions.ts`, `examiner.ts` and `index.ts` |

- **Wiring**
  - `createOhmsLawBench`, a renderer-free controller like the metre bridge's `createBenchController`. It runs the 120 Hz engine loop and writes `OhmsLawVisualState`.
  - Tap–tap leads: a terminal takes ≤ 3; colours cycle red, black, yellow; tap a lead to remove it.
  - Undo and reset.
  - Current-flow dots on leads and parts from `leadCurrentsA` and `partCurrentsA` (`flowRate` from `lab/flow.ts`).
  - The corrected-diagram SVG (`data-part`, `data-lead`), with the "Compare with diagram" toggle. A made lead turns its diagram line from dashed pencil to solid ink.
  - Guided hints come from `compareWithDiagram`; there are none in exam mode.
  - The modelled mistakes behave as in the brief's 4C. The over-range sound and cell drain are visible.
- **Readings**
  - Meter loupe: a close-up camera pose with an eye slider of ±30°, like `lab/loupe.ts`. The needle above the dial plus its mirror image shows parallax.
  - Ruler loupe for XY.
  - The typed notebook: XY, the column headers, and 7 rows of R, I and V, exactly as typed into `OhmsLawRecord`. Nothing auto-fills.
  - Procedure notes: key closed too long, eye off the mirror line, loose joint. Never a value.
- **Shell**
  - Left rail: Home · Metre bridge · Titration · Ohm's law (V–I) · Notebook · About.
  - Header with wordmark.
  - Right panel with the tabs Instructions / Why it works / Precautions / Examiner asks.
  - Bottom step bar with numbered ink icons and ✓/✕ from `done()` and the rules. Progress chip. Identify-mode frame.
  - On phones the panel becomes a bottom sheet. Targets ≥ 44 px. Tokens from `styles/tokens.css`. No glassmorphism.
- **Rules (DRAFT)**
  - `markOhmsLaw(record, opts): MarkSheet`.
  - **Items:**
    - `PHYS-1DP`: XY in cm to 1 d.p.
    - R in Ω.
    - `PHYS-2DP`: I and V to 2 d.p. with units in the headers, earned if ≥ 5 rows pass.
    - `PHYS-TREND`: I and V both fall as R rises.
    - `PHYS-TABLE`: a composite table.
    - `GRAPH-AXES`: V vertical, I horizontal, labelled with units.
    - `GRAPH-SCALE`: points cover ≥ ⅓ of the sheet each way (our interpretation; a config value).
    - `GRAPH-POINTS`: checked against her own table, within half a small square.
    - `GRAPH-LINE`: best fit.
    - `GRAPH-SLOPE`: triangle ≥ ½ of the line's span (our interpretation; a config value), and s evaluated with the unit Ω.
    - `PRECAUTIONS`: two in the reported tense.
    - `PHYS-LAW`: named, stated, with the condition.
    - `PHYS-CALC`: working and 0.25 m.
  - **Precaution topics** (additive; the metre-bridge list and G1/G2 marks are unchanged): wire kept straight, and plugs pushed in firmly. "Meters connected correctly" is procedure, not a WAEC precaution, so it isn't scored. Clarify P2/P7, which share one topic (see the lesson-draft CHECK list).
  - **Examiner bank:** V–I questions picked from her lost marks.
  - **Golden tables (tests):** good, a 1 d.p. slip, axes swapped, small triangle, wrong tense, fewer than 5 rows, s without a unit.
  - The UI and docs/07 §4.4 and §5.2 label it **DRAFT: needs a physics teacher's check**.

**Deferred from Wave 2 (SHOULD):** current-flow dots inside the parts (leads only for now), Tab/Enter terminal navigation, zero-adjust screw, tightening and sandpaper.

**Integration A (lead, Day 5)**
- `LearnPage` composes one canvas (`InkComposer`, `PaperDesk`, apparatus, wiring, readings) inside the shell, and builds the record.
- Guided mode works end to end through step 8 and (b), with the table, precautions and (b) marked.

## Wave 3 (Day 6, Oct 31)
Started Oct 29, a day early. Ports: graph 5177, lesson content 5179, and the hero draw-on reveal 5178 (after the ink look merges). The lead wires the graph sheet, the poses and the Identify cards into `LearnPage` in Integration B.

| Slot | Slice | Agent | Owns |
|---|---|---|---|
| 1 | Graph and slope sheet | `ui-builder` | `apps/web/src/learn/graph/**` |
| 2 | Lesson content, Identify cards, camera poses | `lesson-writer` | `apps/web/src/learn/lessons/ohms-law/**` |
| 3 | Hero draw-on reveal | `shader-artist` | see ink-look.md |
| — | Restyle the existing screens | Muse Code (`../SnapLabNG-muse`, port 5176) | `docs/plans/ink-restyle.md` |

- **Graph sheet:**
  - SVG graph paper, 2 mm squares.
  - She types the axis labels and chooses her scales, taps to plot, drags a transparent ruler for the line and a slope triangle, and types ΔV, ΔI and s.
  - The sheet writes `OhmsLawRecord.graph` in sheet cm.
- **Lesson content:** starts from the reviewed draft (scratchpad `ohms-law-lesson-draft.md`, copied into the brief) after `science-verifier` has checked it. Every step gets one plain line, and every one of the 11 items gets an Identify card.

**Integration B (lead, Day 7, Nov 1)**
- Exam mode: no ring, hints, notes or Identify cards.
- The graph in the flow, and the Examiner asks tab.
- The no-leak check: a Playwright script steps all 7 R values with K closed and asserts that no engine I, V, R_XY or slope value appears in the DOM outside her inputs.
- `visual-qa` on the routes below, then the full gate.

## Cut lines
- **MUST (Oct 30):** Waves 0–2 and Integration A.
- **SHOULD (Oct 31 – Nov 1):**
  - Graph and slope.
  - Identify cards, the other tabs, and exam mode.
  - Callouts on leader lines.
  - Tightening nuts, sandpaper, and the zero error with its zero-adjust screw.
  - Two-way diagram↔bench highlight; Tab/Enter terminal navigation.
  - The `&step=`/`&paused` deep links and the pose-copy dev key.
- **COULD (Nov 2 only if green):**
  - Baked `.webp` thumbnails.
  - Drag-from-tray leads.
  - Rheostat and micrometer detail.
  - The "as printed" sketch.
  - A no-WebGL learn fallback.
  - Live examiner judging.

## Verification
- **Per slice:** the slice's four checks and shots → lead `verifier` → `science-verifier` (engine, rules, lesson text) → `visual-qa` against `.shots/ref/` → `code-reviewer` on `gh pr diff` → squash merge → BUILD_LOG line.
- **Routes:**
  - `?learn=ohms-law` at 390×844 and 1440×900.
  - `&mode=exam`.
  - `?kit=ohms-law`.
  - Regressions: `?kit=meter-bridge`, `?kit=titration`, `?flow=1&golden=note1`.
  - `?quality=low` ≥ 30 fps.

## Risks
- **Sonnet apparatus quality.** Gated on shots; after two failed rounds it goes to `debugger` or the lead.
- **The ink pass on low-end phones.** The fallback is chosen by measurement.
- **Hero regressions.** Baseline shots are in `.shots/ref/`.
- **Agent types load at session start.** If a new type is missing, use `general-purpose` with the agent file's text in the brief.
