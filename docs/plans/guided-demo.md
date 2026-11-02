# Guided demo: one Ohm's law flow (Nov 2)

## Goal
Before deploy and the demo video, the app opens into one guided flow that anyone understands in under 2 minutes:
home (welcome voice) → **Watch** on Ohm's law → the question is read aloud in a right-docked panel → the app solves the
practical by itself (identify, wire, readings + table, graph + slope, conclusion) → Replay.
**Practise and Exam stay and must work end to end** so judges can wire the circuit themselves or sit the practical.
Metre bridge and titration show "Coming soon". This plan overrides older direction where they differ (the user's call, Nov 2).
User decisions: a **live 3D bench on the Ohm's law card** (realistic stills for the other two); a **~2-minute solve**.

Source question: WASSCE (SC) 2018 Physics Paper 3 Q3B, already in `apps/web/src/learn/paper/ohmsLawQuestion.ts` word for word.
The user's scan of the diagram shows E, K, A, R only; the question measures "V across the wire", so our diagram
(`learn/wiring/diagram.ts`, adds wire XY with V across it) stays.

## Gap analysis (Chrome walk + code maps, Nov 2)
| Target | Today | Change |
|---|---|---|
| Welcome voice + mute | none on `home/HomePage.tsx` | voice on load or first tap, visible mute (Muse) |
| Three practicals | Ohm's Watch/Practise/Exam; metre bridge Snap/demo; titration Coming soon; flat SVG art | Ohm's keeps 3 buttons, Watch → guided, live 3D bench; other two "Coming soon" with realistic stills |
| Watch opens practical | paper, then a mode choice | `mode=guided`: read-aloud starts at once |
| Read-aloud panel | exists: right dock, sentence + word highlight, parts drop as named | follow-scroll, **Skip**, auto-dismiss → Watch starts |
| Identify | one caption naming everything | each part labelled on the bench, one at a time |
| Wiring | exists: 7 leads one per beat | keep |
| Readings + table | exists: 7 rows via `script/actor.ts` into the notebook | read-only `ReadingsBoard` on screen; rows 1–2 slow, 3–7 fast |
| Graph + slope | Practise drawer with form fields; no slope shown | read-only `GraphBoard`: points, best-fit line, slope triangle, slope meaning |
| Conclusion | demo marks sheet ("one mark short") | `ConclusionCard` with Replay and Home |
| Controls | exist: restart, back, pause, next, speed, mute | keep; Replay at the end |
| Bug | deep link `?practical=ohms-law&mode=watch` showed an empty bench 13 s+ | fix |

Hidden **only while `mode=guided` plays**: the left rail, toolbar icons not needed to watch, "Compare with diagram", the paper's
mode choice, Show me / Hand in, Results. Practise and Exam keep everything (hint, targets, undo, clock, hand-in, 21-mark Results).

## Contracts (code against these; the lead merges this file first)
1. **Route.** `?practical=ohms-law&mode=guided`. `mode=watch|practice|exam` keep working unchanged (E2E uses them).
2. **`GraphBoard`** — `apps/web/src/learn/graph/GraphBoard.tsx`
   ```ts
   import type { OhmsLawGraph } from "@snaplab/contracts";
   export interface GraphBoardProps {
     /** The demonstration's sheet so far, built by the Watch actor with learn/graph/model.ts ops. Read-only. */
     graph: OhmsLawGraph;
     /** One plain line under the slope working, e.g. "The slope is the resistance of wire XY." null hides it. */
     meaning: string | null;
   }
   ```
   Big read-only graph paper (no form fields, no tool buttons), axis labels and scales from `graph.x/y`, tick values from
   `units_per_cm` and `origin_value`. New points pop in as `graph.points` grows; the line draws in when `graph.line` appears;
   the triangle with `delta_y_as_written`, `delta_x_as_written`, `slope_as_written` shows when `graph.triangle` appears.
   No maths of its own beyond sheet-cm ↔ SVG units (reuse `viewBoxFor`, `MARGIN`, `fmtTick` from `learn/graph/model.ts`).
3. **`ReadingsBoard`** — `apps/web/src/learn/readings/ReadingsBoard.tsx`
   ```ts
   import type { OhmsLawRecord } from "@snaplab/contracts";
   export interface ReadingsBoardProps {
     /** Headers and rows as the actor wrote them; shows `text_as_written` of each cell. */
     record: Pick<OhmsLawRecord, "headers" | "rows" | "length_xy">;
     /** Row index to highlight (the newest); null for none. */
     highlight: number | null;
   }
   ```
   Read-only table R/Ω, I/A, V/V (+ length XY above it when set). Rows appear one by one; the highlighted row is inked.
4. **`ConclusionCard`** — `apps/web/src/learn/end/ConclusionCard.tsx`
   ```ts
   export interface ConclusionCardProps {
     title: string;
     /** 3–5 short lines, each one sentence. */
     lines: readonly string[];
     onReplay(): void;
     onHome(): void;
   }
   ```
   Buttons `data-testid="conclusion-replay"` and `"conclusion-home"`; the card `data-testid="conclusion"`.
5. **Home 3D slot.** Muse's `home/HomePage.tsx` renders `<Bench3DSlot />` from `home/Bench3DSlot.tsx` inside the Ohm's card's art
   area. Muse ships it as a stub that renders the existing `OhmsLawArt` SVG. The lead's slice C replaces only that file's body
   with a lazy `HomeBench3D`.
6. **Home images.** `apps/web/public/home/meter-bridge.webp`, `titration.webp`, `ohms-law-poster.webp` (poster for the live card),
   1600×1100, baked by the lead. Until they land, cards fall back to the SVG art (`<img onError>`).
7. **Styling.** Ink-and-paper tokens already in `learn/learn.css` and `home/` CSS. Fonts: the existing Tinos paper face.

## Slices
| Slice | Owner | Paths | After |
|---|---|---|---|
| A `claude/guided-flow` | lead (implementer) | `learn/LearnPage.tsx`, `learn/PracticalPage.tsx`, `learn/paper/**`, `learn/player/**`, `learn/script/**`, `learn/lessons/ohms-law/script.ts`, `learn/shell/**` | this doc |
| C `claude/home-3d` | lead (Opus) | `home/HomeBench3D.tsx`, `home/Bench3DSlot.tsx` (after Muse), `apparatus/titration/**`, `public/home/**` | this doc |
| E `claude/practise-exam-pass` | lead (subagent) | Practise/Exam-only paths it finds; fixes inside A's paths wait for A | this doc |
| Muse `muse/guided-home` | Muse Code | `home/**` except `HomeBench3D.tsx` | this doc |
| Gemini `gemini/watch-boards` | Gemini Argon | the three new files above, their CSS and tests | this doc |
| B `claude/identify-labels` | lead (Opus) | Identify beats in `script.ts`, `learn/stage/**`, camera | A |
| D `claude/guided-wire` | lead | mount Gemini's boards and card in guided mode | A, Gemini |
| Muse 2 `muse/guided-e2e` | Muse Code | `apps/web/scripts/e2e/watch.mjs`, new `guided.mjs` | D |

### Muse: guided home
1. On first load speak "Welcome to SnapLab. Your practicals come to life." with `createVoice` (`learn/voice/createVoice.ts`).
   Browsers block autoplay sound: if it is blocked or fails, speak on the first pointerdown or keydown instead. Speak once per visit.
2. A visible mute button (top right, `data-testid="home-mute"`, aria-pressed). Muting stops speech at once; the choice is kept in
   localStorage key `snaplab.muted` (reads and writes wrapped in try/catch).
3. Cards: Ohm's law — Watch (primary) → `?practical=ohms-law&mode=guided`, Practise and Exam as today, art = `<Bench3DSlot />`.
   Metre bridge and Titration — "Coming soon", `<img>` from `/home/*.webp` with the SVG as fallback. Drop only the metre bridge
   Snap/demo links (`?flow=1` stays reachable by URL).
4. Tests: mute persistence, first-tap fallback, the Watch link's href.

### Gemini: watch boards
Build contracts 2–4 as pure components with their CSS and Vitest tests (point growth, line, triangle text, highlight row,
Replay/Home callbacks). Do not edit `App.tsx` or `LearnPage.tsx`; ask for a preview switch under "Needs from lead".
Style to match `learn/graph/GraphSheet.tsx` and `learn/readings/OhmsLawNotebook.tsx`.

## Done criteria
- Guided: welcome voice (or first tap) and mute on home; Watch → paper reads with highlight and follow-scroll; Skip works; panel
  closes → parts labelled → 7 leads → table rows → points, line, slope + meaning → conclusion → Replay restarts, Home returns.
  Pause/Back/Next work at every stage; solve ≈ 2 min at 1×; laptop and phone.
- Practise and Exam from the home card: wire by hand, 7 readings, plot, slope, hand in → Results with marks; Exam clock runs.
- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build` green; `practise.mjs`, `exam.mjs`, `noleak.mjs` pass unchanged;
  `watch.mjs` updated and `guided.mjs` pass.
- Home card fps ≥ 50 on laptop; poster on low tier.

## Process
Lead orchestrates; subagents write in worktrees. Each PR: four checks, the lead's Chrome check with screenshots to the user,
one code review, at most one fix round, squash-merge. No deploy. No Claude or Gemini attribution; Muse credits itself.

## Progress
- Nov 2: plan approved; this doc is the first PR (#115).
- Nov 2: merged #116 stills, #117 boards (Gemini), #118 home voice (Muse), #119 guided flow, #120 live 3D card, #121 phone Practise fix, #122 hero home, #123 guided polish, #124 drop-on-name and in-page Watch, #125 Practise/Exam fixes. Open: Muse `muse/guided-e2e` (guided.mjs).

## Practise / Exam bug list (slice E)
Nov 2 walk on `claude/practise-exam-pass`: Practise and Exam at laptop 1440×900 and phone 390×844, real pointer and touch on
the canvas and DOM (no `e2e=1`), from the paper's "Practise with a guide" and `?mode=exam`. Both reach Results with marks on
both sizes (laptop Practise 19/21, phone Practise 17/21). No console errors. Shots: `.shots/e2e-pass/` (L* laptop Practise,
X* laptop Exam, P* phone). E2E before: watch, exam, noleak pass at both sizes; practise passes on laptop, fails on phone
(see 9). After the fix, run one script at a time: all four pass at both sizes.

**Fixed in this slice** (`learn/learn.css`)
1. blocker — phone: once a hint shows, leads can't be made. The note sat mid-bench over the cells, key, ammeter and box nuts
   and swallowed every tap (P11: only V+, V−, X, Y connected). Cause: since B3 the canvas (and `.ol-stage`) ends at the strip,
   but the portrait/short note and close-up bar still add `--sh-bar`, counting the strip twice. Fix: `pointer-events: none`
   on `.ol-note`; phone note and close-up bar placed from the canvas foot (`--ol-foot`, just above the caption). P22–P24.
2. bad — phone: the metre-rule close-up bar covered the tick marks under X and Y, so the length could not be read
   (P05/P06). Same cause and fix as 1 (P20).

**Fixed on `claude/practise-exam-fixes` (Nov 2)** — items 3, 4, 5, 6, 7, 8 and 10 below; 9 (flaky E2E) is still "run one at a time".
- 3: the wrong-lead line is kept with its lead and goes when that lead is off the bench (remove, undo, reset): `LearnPage.tsx`.
- 4: a bench note shows only for the circuit it was written for (leads, key, plugs); any change to them hides it: `LearnPage.tsx`.
- 5: Hand in (Practise and Exam) opens an in-page dialog first, "Hand in now? You can't change your answers after this."
  with Keep working (focused, Escape) and Hand in: `player/Player.tsx`, `player.css`. The E2E scripts hand in through the
  `window.__snaplab` hook, so they are unchanged.
- 6: a Practise beat whose `done` already holds is not read out and is passed at once: `script/createDirector.ts`.
- 7: the laptop close-up bar and the float-open toolbar and note no longer add `--sh-bar` (`learn.css`; `shell.test.tsx` pins `bottom: 16px`).
- 8: a meter's dial, ring and glass carry `partHit`, and the nuts' tap targets (`TerminalNut`, `TerminalHits`) yield to them,
  as they yield to a lead: `apparatus/ohms-law/Meter.tsx`, `TerminalNut.tsx`, `learn/wiring/TerminalMarks.tsx`. Checked on the bench shot
  at 390×844 and 1440×900: taps over the ammeter and voltmeter dials all open the close-up (phone 0 misses; laptop 1 point on the dial's rim).
- 10: phone, steps R = 1 Ω and Repeat: a "Box close-up" button (portrait only, `ol-boxview`) takes the box-alone shot
  (`stage/shots.ts` "box", from above, plugs ~32 px apart at 390×844); "Whole bench" goes back to the box and key shot
  (key and meters). The box chip now anchors at the box's front edge, not over the plugs (`stage/Choreo.tsx`).
  Still open: the chip was not re-shot in Practise; the box and key shot (default) still has the plugs ~12 px apart.

**Waiting for slice A** (its files; proposed change)
3. bad — Practise: the wrong-lead line stays after the lead is gone ("…Tap the wire to remove it." through the rest of the
   run, P23/L24). `LearnPage.tsx:549` is cleared only by the next lead (`:613`). Clear it on Undo lead (`:843`), the Tools
   undo/reset (`:868–869`) and LeadRemove (`:956`): e.g. `setWrongLine(null)` beside each `bench.undo()/reset()/removeLead()`.
4. bad — Practise: a bench note stays for the whole run after its cause is fixed ("The cells are short-circuited…" through
   wiring and readings, L10, P25; later "Key K has stayed closed…" with the key open, P28). `LearnPage.tsx:745–746` shows
   `bench.notes`' last entry forever. Show it only for its circuit: e.g. keep a `dismissedNoteId` set on every lead/key/plug
   change (bench.subscribe) and hide a note whose id is dismissed.
5. bad — Exam: one tap on Hand in ends the exam with no confirm (phone: a stray tap at 0:13 gave 0/21, P41/P42; Exam allows
   one hand-in). `player/Player.tsx:98–103` / `LearnPage.tsx:836`: in Exam, ask "Hand in now? You can hand in once." first.
6. polish — Practise: the guide lags her by several beats (all 7 leads made while the caption still says "Tap the second
   terminal of the plug key…", ~20 s to catch up, L10). `script/createDirector.ts`: skip a waiting beat's line when its
   `done` already holds.
7. polish — laptop: the base `.ol-loupe` (`learn.css:109`) and `.ol-float-open` rules still add `--sh-bar` (bar sits ~130 px
   high, harmless). `shell/shell.test.tsx:402` pins `var(--sh-bar)` in `.ol-loupe`, so the CSS and that test change together.

**For the lead** (outside A's paths, but apparatus/stage code)
8. bad — tapping a meter's dial to read it starts or ends a lead. The nut targets are tall ellipsoids
   (`learn/wiring/TerminalMarks.tsx:238`, `0.02 * HIT_TALL` up), which cover the lower dial from the bench camera and sit in
   front of it. Laptop: an ammeter-dial tap then a voltmeter-dial tap made a wrong lead A+→V− (L24). Proposed: tag the
   dial/glass meshes in `apparatus/ohms-law/Meter.tsx` (`userData.partHit`) and let `TerminalHits.down` yield to them, as it
   already yields to `leadHit`.
9. bad (test rig) — E2E `practise.mjs` is flaky when run beside other headless runs: phone failed at the "Undo lead" click
   (Playwright's stability wait) or the 15 s hint wait in 3 runs, and laptop once, all while other agents' servers and E2E ran
   (load average 12–19); one script at a time it passes at both sizes. The first failure came before this slice changed any file. Frames on swiftshader at
   phone size take seconds under load. Run the E2E scripts one at a time, or give the hint/Undo waits 30 s.
10. bad — phone R = 1 Ω and Repeat: the box-and-key shot (`learn/stage/shots.ts:52`, `box: "boxKey"`, four parts) leaves the
    plugs ~12 px apart, cut at the left edge, and the "Resistance box, R = …" chip covers half of them (P28/P29). Plugs can be
    pulled only with exact taps. Slice B (stage/camera): a box-only phone shot, or the chip anchored off the plugs.

**Polish, any slice**
11. Practise: the table headings show "R/Ω, I/A, V/V" as placeholders (`readings/OhmsLawNotebook.tsx:75`), so the table looks
    headed while the guide waits for "Head the R column…" (L06, P09).
12. Graph sheet: the zoom "−" and "+" glyphs sit at the left edge of their buttons (`graph/graph.css:178`, `.gs-icon`),
    laptop and phone (L30, P31).
13. phone: on Measure XY the camera holds the wire board; a lead made then (or a wrong one) is off screen while the hint says
    "Tap the wire to remove it" (P04).
