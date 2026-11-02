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
- Nov 2: plan approved; this doc is the first PR.

## Practise / Exam bug list (slice E)
_(filled by slice E)_
