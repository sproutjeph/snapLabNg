# Rule engine: metre bridge marking

## Goal
`markMeterBridge(readings, opts) → MarkSheet`: the WAEC scheme for the metre bridge question (docs/15 §4), marked positively, item by item, from what she **wrote** (docs/07 §5.1). It must give G1 **15½/21** with exactly the answer key in docs/11 §2, and G2 **21/21** (22/22 in teacher mode with 3.0 Ω). Same page, same score.

## Out of scope
Titration and glass-block rules, Pidgin fix texts (`fix_pcm` stays null for now), examiner prose (`/api/mark`), and scale-choice checks that need axis-scale data Wonder doesn't give us yet (the "no multiples of 3" part of GRAPH-SCALE is earned when a graph exists, and the item says so).

## Files (`packages/rules`, lead)
- `src/text.ts`: rules over `text_as_written`, never the parsed number:
  - `decimalPlaces("57") = 0` and `decimalPlaces("57.0") = 1`;
  - `sigFigs("0.02") = 1`, `sigFigs("0.0395") = 3` and `sigFigs("1.00") = 3`;
  - `hasUnit(header)`, for a bracketed unit or a unit word.
- `src/precautions.ts`: `judgePrecaution(text) → { accepted, matched: PrecautionId | null, reason }`. A precaution is accepted when it matches a docs/15 accepted precaution and is stated as something done (past tense: "was opened", "were", "was avoided", "was noted"). It is refused when it is an instruction (starts with a base verb such as "Avoid", "Ensure", "Open"), or when it describes the penalised action ("slid"/"dragged" the jockey "along the wire" without a negation).
- `src/meterBridge.ts`: `markMeterBridge(r: Readings, opts: { teacherXOhm: number | null }) → MarkSheet`, with the items and marks of docs/15 §4:
  - **PHYS-1DP** (2½): ½ for each of five `l` values with ≥ 1 d.p.
  - **PHYS-3SF** (5): ½ for each of five `R_inv` and five `l_inv` values with ≥ 3 s.f.
  - **PHYS-TABLE** (1½):
    - ½ for all four quantities present;
    - ½ for units on R and l;
    - ½ for units on R⁻¹ and l⁻¹.
  - **GRAPH-AXES** (1½): ½ for each axis labelled with its quantity, plus ½ when both labels carry a unit.
  - **GRAPH-SCALE** (1½):
    - ½ when the graph box covers ≥ 1/3 of the page (area);
    - 1 for scales and origin, earned when a graph exists (see out of scope).
  - **GRAPH-POINTS** (1½): her plotted points against her own table (R⁻¹, l⁻¹ as she wrote them), within 2% of each axis span. Five correct earn 1½, four earn 1, three earn ½.
  - **GRAPH-LINE** (1½): `line_drawn`.
  - **GRAPH-SLOPE** (2):
    - 1 when the triangle's horizontal leg is ≥ half of her points' R⁻¹ span ("large");
    - 1 when `slope_as_written` matches her own triangle within 5%.
  - **GRAPH-INTERCEPT** (1): `intercept_as_written` within 10% of the least-squares intercept of her plotted points.
  - **PHYS-EVAL** (1): `result_as_written` equals her s ÷ her c within 2%.
  - **PHYS-ACCURACY** (1, teacher mode only): her X is within ±10% of `teacherXOhm`.
  - **PRECAUTIONS** (2): 1 for each of up to two accepted precautions.
- Each item carries evidence boxes from the readings, an annotation (circle a bad value, strike a refused precaution, box the graph, tick an earned item), a `correction` where one is obvious ("57.0", or "0.0200" from her own l), the English fix text and a WAEC source label.
- `src/index.ts`: re-exports.
- Tests: `text.test.ts`, `precautions.test.ts`, `meterBridge.test.ts`, with G1 and G2 built from docs/11 §2–3 exactly.

## Contracts
`Readings` in, `MarkSheet` out (`@snaplab/contracts`). It doesn't change.

## Tests (each cites docs/11, docs/15 or a WAEC report)
- G1 → 15½ / 21. The lost items are exactly: PHYS-1DP "57" −½, PHYS-3SF "0.02" −½, PHYS-TABLE −½, GRAPH-AXES −½, GRAPH-SCALE −½, GRAPH-SLOPE −1, PRECAUTIONS −1 −1. PHYS-EVAL is earned.
- G2 → 21 / 21, and 22 / 22 in teacher mode with 3.0 Ω (2.88 is within 10%).
- In teacher mode with 2.5 Ω, G2 loses PHYS-ACCURACY (2.88 is 15% off).
- `decimalPlaces` and `sigFigs` on "57", "57.0", "0.02", "0.0200", "0.0395", "1.00", "0.500" and "25.3".
- Precautions:
  - accepted: "The key was opened between readings", "The jockey was not dragged along the wire", "Parallax was avoided when reading the metre rule";
  - refused: "Avoid parallax error…" (instruction), "I slid the jockey gently along the wire…" (penalised action), "Ensure tight connections" (instruction).
- Same input gives a deep-equal output (determinism).
- The sheet passes `MarkSheet.parse`.

## Done-criteria
The four checks pass, science-verifier: PASS, code-reviewer: SHIP.

## Implementer
Lead (packages/rules).

## Risks
- Wonder's evidence boxes and axis labels vary. Unsure cells go to the student's confirmation step (docs/06 §5.3) before marking.
- The tense heuristic is English-only. Pidgin precautions come later, with the examiner.
