---
paths:
  - "packages/engine/**"
  - "packages/rules/**"
---
# Engine and rules code (loads only when these files are touched)

- Pure functions only. No I/O, no `Math.random`, no `Date.now`, no globals that change. Same input → same output, always. If a simulation needs noise, take a seed argument.
- Units in names: `volumeCm3`, `concMolDm3`, `angleDeg`, `angleRad`. Convert degrees to radians in one place, at the boundary.
- Physics steps at a fixed 120 Hz (`dt = 1/120`), independent of frame rate.
- Metre bridge: 3-node Kirchhoff solve (doc 07 §4.2), re-solved only when an input changes; the galvanometer needle is a damped oscillator at 120 Hz, clamped at full scale. Guard the singular case (jockey off the wire). The wire never glows.
- Titration pH: one charge-balance solve by bisection (docs/07 §2). Mole ratio comes from the balanced equation as written, parsed deterministically, never from the model.
- Glass block: Snell's law; lateral displacement d = t·sin(i−r)/cos r; handle total internal reflection and i = 0.
- Rules work on `text_as_written`, not on the parsed number: "57" fails 1 d.p. and "24.5" fails 2 d.p. PRECAUTIONS checks the exact wording, including tense ("the key was opened", not "open the key"). Graph checks compare her points, triangle and slope against her own table, never against the true value.
- Concordance tolerance is a config value (default 0.20 cm³, praise ≤ 0.10). Accuracy is a separate check against the teacher's titre.
- Each marking rule has an id from docs/07 §5 (e.g. `CHEM-BUR-2DP`), returns the evidence (which cell, which box), and has a test.
- Every science test states its expected value and source in a comment, e.g. `// WAEC Chem P3 2023 report: titres to 2 d.p.`. Compare floats with a tolerance (`toBeCloseTo`), never with `toBe`.
- After a change here, ask the `science-verifier` agent to check it.
