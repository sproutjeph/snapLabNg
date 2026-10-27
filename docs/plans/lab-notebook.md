# Lab notebook (the readings she takes on the virtual bench)

## Goal
While she finds null points on the 3D metre bridge, a small notebook panel lets her record each reading: the plug-box R she set and the jockey position l where the needle stayed still. The table looks like the one WAEC wants (R, l, R⁻¹, l⁻¹), so she practises recording before she writes it in her exercise book. docs/09 Day 4 ("Lab notebook of readings"), docs/04 §2 ④.

## Rules this must keep
- **Never show the true balance point or X**, and never a "correct" l. The notebook records only what *she* set and where *she* tapped (AGENTS.md hard rules).
- It computes nothing about physics. R⁻¹ and l⁻¹ are shown only when she taps "Work out R⁻¹ and l⁻¹", and they are formatted to 3 s.f. as WAEC expects. That's plain arithmetic on her own numbers, labelled as such.
- Lengths are shown to 1 d.p. in cm, because the metre rule is read to 1 mm.

## Out of scope
Wiring to the engine (the lead passes in her current R and jockey position), marking, saving between visits, plotting the graph.

## Files
All under `apps/web/src/notebook/`. Owner: **Muse Code**, branch `muse/lab-notebook`, worktree `~/Desktop/SnapLabNG-muse`.
- `types.ts`:
  ```ts
  export interface Reading { id: string; rOhm: number; lCm: number }
  export interface NotebookProps {
    /** What the bench shows now; null while the jockey is up or the key is open. */
    current: { rOhm: number; lCm: number } | null;
    readings: Reading[];
    onRecord(reading: { rOhm: number; lCm: number }): void;
    onDelete(id: string): void;
  }
  ```
- `format.ts`: pure helpers, unit-tested.
  - `formatLength(lCm)`: 1 d.p., e.g. 57 → "57.0".
  - `formatSig3(x)`: 3 s.f., e.g. 1/50.2 → "0.0199", 1 → "1.00", 0.25 → "0.250".
  - `formatOhm(r)`: 1 d.p.
  - `reciprocalRow(reading)`: returns `{ rInv: string; lInv: string }`, both 3 s.f.
- `LabNotebook.tsx`: a paper-styled panel (ruled lines, the same blue biro look as the page).
  - A "Record reading" button, disabled while `current` is null.
  - The table: R (Ω) | l (cm) | R⁻¹ (Ω⁻¹) | l⁻¹ (cm⁻¹), with units in every header. The last two columns stay empty until "Work out R⁻¹ and l⁻¹" is pressed.
  - A delete (×) on each row.
  - A gentle note when the same R is recorded twice ("You already have a reading for R = 2.0 Ω").
  - Readable at 390 px wide, and keyboard accessible.
- `NotebookPreview.tsx`: a page for `?notebook=1` with fake `current` values from a "Set R / Set l" form (no engine), so the panel can be tried alone.
- `format.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?notebook=1` switch, keeping the others.

## Tests
- `formatLength(57) === "57.0"`, `formatLength(25.34) === "25.3"`, `formatLength(62.45)` rounds half up to `"62.5"`. Floating-point care: use a decimal-safe rounding, not plain `toFixed` on 62.45.
- `formatSig3(1/50.2) === "0.0199"`, `formatSig3(1) === "1.00"`, `formatSig3(0.25) === "0.250"`, `formatSig3(1/3) === "0.333"`.
- `reciprocalRow({ rOhm: 4, lCm: 57 })` gives `{ rInv: "0.250", lInv: "0.0175" }` (docs/15 §5, the G1 row 4 values).

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass (after `bun install`). The notebook is lazy.
- On port 5176, `bun run shot -- --route "/?notebook=1" --base http://localhost:5176` renders on phone and laptop with no console errors.
- No text anywhere suggests a correct or expected l or X.
- The PR body starts with `_Built with Muse Code, Meta's coding agent._` and lists only what is in the branch, with checked counts.

## Implementer
Muse Code. The lead wires it to the live bench afterwards (current R from the plugs, l from the jockey when the needle is still).

## Risks
- Rounding at .x5 boundaries → decimal-safe rounding, tested.
- Students expect l⁻¹ computed for them → the button says "Work out R⁻¹ and l⁻¹" and the table header explains it's arithmetic from her numbers.
