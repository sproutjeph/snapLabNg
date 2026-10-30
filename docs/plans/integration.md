# Plan: Integration, lean: the Ohm's law practical end to end, with E2E

Replaces the Integration wave of `docs/plans/exam-redesign.md`. MUST work (cut lines there). Gates follow the lean rules in `docs/plans/wave-2-lean.md` "Gates".

## Goal
From the home page, the student opens the Ohm's law practical, reads (or hears) the question while the apparatus drops onto the bench, then picks **Watch**, **Practise** or **Exam** on the page. She hands in and sees her Results: marks, the reading check against her own meters, her slope against the wire's resistance, and "Watch again" / "Try again on a new bench". Four E2E scripts prove it. Source: `exam-redesign.md` "The experience" 1–6 and "Done-criteria" 1–4, 8.

## Where we are (survey, Oct 30, main a5e49bd)
- Already wired: the home picker (`home/links.ts` → `/?practical=ohms-law&mode=…`); Watch, Practise and Exam by URL (Exam: no caption, hints, rings or Show me; elapsed timer); `markOhmsLaw` on hand-in into `MarkPanel`; demand frameloop and shadow dirty flags; no legacy `InkLights`/`PaperDesk`/OrbitControls on the live page.
- Built but not on the live page: `paper/QuestionPaper.tsx` (only on `?paper=1`); `results/Results.tsx`, `results/handIn.ts`, `checkReadingsAgainstBench` (only on `?results=1`).
- Missing: the paper as the page's first screen; an on-page mode choice; the entrance tied to the read-aloud; Watch ending on the demo's mark sheet; a new-seed retry; every E2E script; two director fixes from the Wave 1 handoff notes.

## Out of scope
- The beauty-pass backlog (`wave-2-lean.md` Progress), except the phone bench crop below. The hero (2c). The viva. Changes to `packages/engine`, `packages/rules` or `packages/contracts`. New lesson copy.

## Files
**I1, the page** (Opus subagent, worktree `claude/integration-page`, port 5177):
- I1 also owns `learn/shell/**` and `learn/player/**` for the paper pop-up and the mode choice (Gemini has no open slice).
- `learn/LearnPage.tsx`: with no `mode` in the URL, open on the **question paper** in a pop-up over the stage (the shell's question pop-up); its three choices set the mode in page state (and `history.replaceState` the `mode` param); `?mode=` still deep-links past the paper. Hand-in renders `results/Results.tsx` (via `results/handIn.ts`) in place of `MarkPanel`. "Watch again" → Watch, from beat 0, same seed; "Try again on a new bench" → Practise (or Exam, whichever she was in) with a new seed. Watch's last beat opens the demo's mark sheet (the actor's record through `handIn`), labelled "Demonstration bench".
- `learn/stage/Choreo.tsx`: the entrance plays while the paper is open (on every mode's first load, not only Watch), and when "Read it to me" reaches the apparatus list each part drops as it is named (fallback: the 0.9 s timed drop if speech is unavailable or muted).
- `paper/QuestionPaper.tsx`: the existing `onItemRead` drives the drops; only the testids are added.
- `results/handIn.ts`, `results/Results.tsx`: the engine is the supervisor (AGENTS.md hard rule; D1 in `exam-redesign.md`): keep `teacherXyOhm` = the bench's own wire, so the sheet stays 21 marks. Fix only what the live page needs.
- `learn/script/types.ts`: the `benchState` JSDoc (keep the same `record` object until she edits, or the hint ladder never fires). `learn/script/createDirector.ts`: emit the Show me "lead" event only when the lead count went up.
- `learn/stage/shots.ts`: the phone bench shot crops the bench's sides (resume-point backlog item marked Integration).
- `learn/e2e.ts` (new): the test hook below, active only with `?e2e=1`.

**I2, the E2E scripts** (Muse Code, `../SnapLabNG-muse`, branch `muse/integration-e2e`, port 5176), against the hook contract, so it runs in parallel with I1:
- `apps/web/scripts/e2e/{lib.mjs,watch.mjs,practise.mjs,exam.mjs,noleak.mjs}`: Playwright Chromium (already a root devDependency, used the same way as `scripts/shot.ts`), phone 390×844 and laptop 1440×900, a `--base` flag (default `http://localhost:5173`); exit code 1 with a one-line reason on failure; fail on any console error.

**Lead (seam, before both start):** this plan; AGENTS.md "Who owns what" rows for I1 and I2; Muse's worktree on a fresh branch from `origin/main`.

## Contracts (frozen until both merge; amended Oct 30 after I1's first round: `play`, `setR`, `key`, `checkOk`, nullable `meters`)
The E2E hook, `apps/web/src/learn/e2e.ts`, installed by `LearnPage` only when the URL has `e2e=1`:
```ts
// window.__snaplab, present only with ?e2e=1
interface SnaplabE2E {
  /** "paper" until a mode is chosen, then the mode; "results" after hand-in. */
  screen(): "paper" | "watch" | "practice" | "exam" | "results";
  /** Director progress: beat index, beat count, finished. */
  progress(): { beat: number; beats: number; done: boolean };
  /** Terminal ids that a correct next connection needs (Practise only; [] otherwise). */
  targets(): string[];
  /** The same as her tapping that terminal on the stage. */
  tap(terminalId: string): void;
  /** Type into the notebook cell (row, column key), the same as her typing. */
  type(row: number, col: string, value: string): void;
  /** Same as tapping Start / play. */
  play(): void;
  /** Set the resistance box as her plugs would. */
  setR(ohms: number): void;
  /** Close or open the key. */
  key(closed: boolean): void;
  /** The bench's current meter readings (ammeter A, voltmeter V), as the meters show them; null fields while a needle is still moving. */
  meters(): { i: number | null; v: number | null };
  /** The wire's true resistance in ohms (the answer her slope is checked against). For noleak only. */
  wireOhm(): number;
  handIn(): void;
  /** After hand-in: total and max from markOhmsLaw, the reading-check row count and how many rows are ✓. */
  result(): { total: number; max: number; checkRows: number; checkOk: number } | null;
}
```
- With `e2e=1`: the voice is silent and uses its estimated durations; `speed` also accepts 4 and 8 (still 1/1.5/2 in the UI).
- DOM hooks: `data-testid` on `paper-choice-watch|practice|exam`, `paper-read`, `hand-in`, `results`, `results-check` (the reading-check table), `results-watch-again`, `results-new-bench`, `callout-chip`, `hint`, `show-me`.

## Tests
- I1 (Vitest, `learn/` and `results/`): `with no mode the page opens on the paper`; `a paper choice sets the mode and the URL`; `?mode= skips the paper`; `the reading check and slope appear only after hand-in`; `new bench changes the seed, watch again keeps it`; `show me on a full terminal emits no lead event`; `the e2e hook is absent without e2e=1`.
- I2 (E2E):
  - `watch.mjs`: `?practical=ohms-law&mode=watch&e2e=1&speed=8&seed=7`: calls `play()`, plays to `done` (about 3 minutes at speed 8), a chip appeared during the lead beats, and the demo mark sheet shows `total === max`.
  - `practise.mjs`: wires the circuit by tapping `targets()` (one deliberate wrong tap first: a `hint` appears and contains no digit), then per row `setR` → `key(true)` → wait for `meters()` non-null → `type` I and V (and R if the notebook needs it) → `key(false)`; hands in: `checkRows === rows` and `checkOk === rows` (the length, graph and precautions are not filled, so not `total === max`).
  - `exam.mjs`: no `callout-chip`, `hint` or `show-me` ever in the DOM; elapsed timer visible; one hand-in, then `results`.
  - `noleak.mjs`: in Practise and Exam, before hand-in, `results-check` is absent and the page text never contains `wireOhm()` (to 1, 2 or 3 s.f.); after hand-in the check and the slope comparison appear.

## Done-criteria
1. `/` → Ohm's law card → the paper over the stage, parts dropping as named; each choice opens its mode. Proof: one phone and one laptop shot (lead), then **the user signs off in Chrome**.
2. `bun apps/web/scripts/e2e/watch.mjs`, `practise.mjs`, `exam.mjs`, `noleak.mjs` all exit 0 on phone and laptop sizes against the merged main.
3. `bun run typecheck`, `lint`, `test`, `build` green on each branch; the web test count does not fall (810 now).
4. `?quality=low` holds 30 fps or better on `?practical=ohms-law` (visual-qa's fps line, one run).

## Implementer
- **Seam: lead** (docs and AGENTS.md only).
- **I1: Opus subagent**, `isolation: "worktree"`, high effort; brief: "Read AGENTS.md and docs/plans/integration.md, slice I1."
- **I2: Muse Code**, one line: "Read AGENTS.md, then docs/plans/integration.md, slice I2. Work in your worktree; open a PR." If Muse is unavailable, `implementer` (Sonnet) in a worktree.
- **Gates (lean):** the four checks per PR; one fresh `code-reviewer` on I1; no science-verifier (no engine or rules change); one fix round at most; then the E2E scripts run against merged main. Polish goes to the beauty pass.
- Rough cost: I1 about 0.5M tokens, gates about 0.1M; Muse runs on its own account.

## Risks
1. **The read-aloud sync is fragile** (speechSynthesis boundary events are missing on some browsers). Fallback: drop each part at its sentence's estimated time; the timed drop if muted.
2. **I1 changes a DOM hook that I2 relies on.** The contract above is frozen; a needed change goes through the lead, who updates both briefs.
3. **The demo record does not score full marks** (a rounding or scale edge on some seed). `watch.mjs` pins seed 7 and logs the lost rule; a rules fix is then a lead decision, not a test change.

## Progress
- [x] Plan approved by the user (Oct 30)
- [x] Seam (AGENTS.md rows, Muse worktree)
- [ ] I1 merged
- [ ] I2 merged, E2E green on main
- [ ] The user signs off in Chrome
