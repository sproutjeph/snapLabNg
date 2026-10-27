# Teacher mode and teacher notes

## Goal
A teacher can enter the true value of the unknown X, so PHYS-ACCURACY (±10%) can be marked (docs/15 §4: "Teacher mode only; never shown to students otherwise"). A teacher-notes panel shows the equations and assumptions the bench uses (docs/07 §1, principle 6), so a teacher can trust what the lab computes.

## Rules this must keep
- The teacher's value is **never shown** in student view: not in the UI, a URL, a log or the drawer. It is kept in this browser only (`localStorage`, with try/catch), and entering teacher mode needs a deliberate step.
- Nothing here computes marks. It only provides `teacherXOhm` to the lead's code, which passes it to `markMeterBridge`.

## Out of scope
Accounts, PINs or passwords (no accounts in this app), classes, syncing, titration and glass block, and wiring into the flow page (lead).

## Files
All under `apps/web/src/teacher/`. Owner: **Muse Code**, branch `muse/teacher-mode`, worktree `~/Desktop/SnapLabNG-muse`.
- `teacherStore.ts`: pure-ish helpers around one storage key, `snaplab.teacher.v1`.
  - `loadTeacher(): { enabled: boolean; xOhm: number | null }`
  - `saveTeacher(state)`
  - `clearTeacher()`
  - Every read and write is wrapped in try/catch: storage can be missing or blocked, and then it behaves as disabled.
  - `parseOhms(text)` accepts "3", "3.0", "3.0 Ω", "3 ohms" and "3,0"; rejects ≤ 0, > 10,000 and non-numbers; returns `number | null`.
- `useTeacher.ts`: a React hook returning `{ enabled, xOhm, enable(), disable(), setX(text): boolean }`. `xOhm` is exposed **only while `enabled`**, and is null otherwise.
- `TeacherPanel.tsx`: a small "For teachers" button that opens a panel.
  - It explains, in one sentence, that the value is kept on this device only and used to mark accuracy.
  - A field for "True value of X (Ω)" with validation messages, and Save, Turn off teacher mode and Clear buttons.
  - While on, a subtle "Teacher mode on" badge.
- `TeacherNotes.tsx`: a read-only panel with the metre bridge model in plain language and simple notation, taken from docs/07 §4.2 and docs/15 §4. Include:
  - R/X = l/(100 − l);
  - l⁻¹ = (X/100)·R⁻¹ + 1/100, so s = X/100, c = 1/100 and X = s/c;
  - the end corrections, and what interchanging R and X does (the corrected wording in docs/07 §4.2);
  - Leclanché polarisation changes sensitivity, not the balance point;
  - a dragged jockey scrapes the wire;
  - the constantan wire never glows.
  Cite docs/07 and the WAEC reports listed in docs/15 §9 as plain text, with no WAEC logos or styling.
- `TeacherPreview.tsx`: a page for `?teacher=1` showing the panel and the notes, and a line printing `xOhm` **only when teacher mode is on**, to prove the hook.
- `teacher.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?teacher=1` switch, keeping all the others.

## Tests
- `parseOhms`: "3" → 3, "3.0 Ω" → 3, "3 ohms" → 3, "3,0" → 3; "0", "-2", "abc" and "20000" → null.
- The store: save then load round-trips. With `localStorage` throwing on access, load returns `{ enabled: false, xOhm: null }` and save doesn't throw.
- The hook logic, tested through a small pure reducer: `xOhm` is null while disabled, even when a value is stored.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass, after `bun install` following any merge of `main`. The teacher code is lazy.
- On port 5176, `bun run shot -- --route "/?teacher=1" --base http://localhost:5176` renders on phone and laptop with no console errors.
- In student view (teacher mode off), the stored value appears nowhere on the page, as checked in the preview.
- The PR body starts with `_Built with Muse Code, Meta's coding agent._` and has checked counts. Commits end with "Built with Muse Code (Meta)".

## Implementer
Muse Code (fresh session). The lead wires `useTeacher().xOhm` into the flow's `markMeterBridge` call.

## Risks
- A student opens teacher mode → it's practice software with no stakes: the value stays hidden unless teacher mode is on, and turning it on shows a clear badge.
- Shared school computers → "Clear" removes the value, and the panel says the value stays on this device.
