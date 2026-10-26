# Metre bridge engine

## Goal
The deterministic science behind the hero (docs/07 §4.2, docs/15 §3): a 3-node Kirchhoff solve of the metre bridge, the centre-zero galvanometer as a damped needle that slams at full scale, the plug resistance box, the key with Leclanché polarisation, and the scrape a dragged jockey leaves on the wire. The kit (`apps/web/src/apparatus/meter-bridge`) draws what this computes. The UI never shows the balance point or X.

## Out of scope
- Wiring the engine to the kit, the render loop and the Zustand store (next plan, `apps/web`).
- Current-flow particles (they read `branchCurrentsA` from here later), sounds.
- Temperature rise and potentiometer mode (COULD).
- Graph least squares and every mark: `packages/rules`.
- Interchange of R and X as a UI action. The solver already supports any R and X, and end corrections are tested.

## Files (all in `packages/engine/src/meter-bridge/`, lead writes)
- `constants.ts`: default parameters with sources: constantan resistivity, wire diameter → Ω per cm, Leclanché emf and internal resistance, galvanometer coil resistance and full scale, end resistances, the scrape factor, plug contact resistance. `DT_S = 1 / 120`.
- `wire.ts`: `wireOhm(fromCm, toCm, wire)`. The integral of the resistance per cm, where any segment covered by a scrape has its resistivity raised by `scrapeFactor`. Overlapping scrapes do not stack.
- `plugBox.ts`: `boxOhm(valuesOhm, plugsIn, contactOhm)`. The sum of the coils whose plug is out, plus the contact resistance (never exactly 0).
- `circuit.ts`: `solveCircuit(c: CircuitInputs): CircuitSolution`. Nodal analysis with C as ground and unknowns V_A, V_B, V_J. A 3×3 Gaussian elimination on the symmetric, diagonally dominant conductance matrix (no pivoting needed); no allocation beyond the result.
- `galvanometer.ts`: `stepNeedle(n: NeedleState, currentA, g: GalvoParams, dt): NeedleState`. θ'' + 2ζω₀θ' + ω₀²θ = ω₀²·S·I, so the steady deflection is S·I. Semi-implicit Euler. At ±fullScaleDeg it clamps, reverses velocity × restitution, and flags `slammed` when the impact speed is above a threshold.
- `cell.ts`: `stepCell(s: CellState, currentA, p: CellParams, dt): CellState`. First-order polarisation. While current flows (which needs the key closed), emf sags toward `emfPolarisedV` and r rises toward `rPolarisedOhm`, at a rate ∝ |I|/I_ref. With the key open, both recover toward rest with τ_recover.
- `simulation.ts`: `createMeterBridge(params?)` returns the initial `MeterBridgeState`. `stepMeterBridge(state, inputs, dt = DT_S)` returns the next state (the parameters live in the state). It re-solves the circuit only when an input or the cell state changed, and steps the cell and needle at 120 Hz. `addScrape(state, fromCm, toCm)` records a dragged segment. All pure: state in, new state out.
- `index.ts` re-exports. `packages/engine/src/index.ts` re-exports `./meter-bridge`.
- Tests beside each module (below).

## Contracts (exact; the web wiring plan consumes these)
```ts
export interface WireParams { ohmPerCm: number; endAOhm: number; endCOhm: number; scrapeFactor: number }
export interface CircuitInputs {
  emfV: number; internalOhm: number; keyClosed: boolean;
  rOhm: number;            // resistance box, left gap
  xOhm: number;            // unknown, right gap
  wire: WireParams;
  scrapesCm: ReadonlyArray<readonly [number, number]>;
  jockeyCm: number | null; // null = jockey not touching the wire
  galvoOhm: number; protectOhm: number;
}
export interface CircuitSolution {
  nodeV: { A: number; B: number; J: number };                 // C = 0 V
  branchCurrentsA: { cell: number; rArm: number; xArm: number; wireAJ: number; wireJC: number; galvo: number };
  // Conventional current. cell: out of + into A. rArm: A→B. xArm: B→C. wireAJ: A→J. wireJC: J→C. galvo: B→J (0 when the jockey is up).
}
export interface MeterBridgeInputs {
  plugsIn: boolean[]; boxValuesOhm: number[]; xOhm: number;
  keyClosed: boolean; jockeyCm: number | null;
}
export interface MeterBridgeState {
  params: MeterBridgeParams;          // wire, cell, galvo, protectOhm, plugContactOhm
  inputs: MeterBridgeInputs | null;   // last solved inputs
  solvedScrapeCount: number;
  scrapesCm: Array<[number, number]>;
  cell: { emfV: number; internalOhm: number };
  needle: { thetaDeg: number; omegaDegPerS: number; slammed: boolean };
  solution: CircuitSolution;
  timeS: number;
}
```
The kit's `needleDeg` is `state.needle.thetaDeg`, with +θ to the right when current flows B→J.

## Tests (Vitest; every science test cites its source in a comment; floats with toBeCloseTo)
`circuit.test.ts` (end resistances 0 unless stated):
- R = X = 3 Ω, jockey at 50.0 cm → galvo current ≈ 0 (|I_g| < 1e-9 A). Source: Wheatstone bridge balance R/X = l/(100 − l), Nelkon & Parker, *Advanced Level Physics*, metre bridge.
- X = 3.0 Ω and R = 1, 2, 3, 4, 5 Ω → I_g ≈ 0 at l = 25.0, 40.0, 50.0, 57.1 (57.142…), 62.5 cm. Source: docs/07 §4.2 golden values, l = 100R/(R + X).
- The sign of I_g flips either side of balance (jockey at 45 and 55 cm for R = X).
- Kirchhoff's current law holds at A, B and J for a random-looking but fixed set of inputs, within 1e-12 A.
- With end resistances e₁ = 0.05 Ω and e₂ = 0.08 Ω (as end lengths α = e/ρ), the measured balance l₁ satisfies R/X = (l₁ + α₁)/(100 − l₁ + α₂). Source: Nelkon & Parker, end corrections.
- Interchanging R and X and averaging l₁ with (100 − l₂) gives 100k/(1 + k) + (k − 1)(α₁ + α₂)/(2(1 + k)), k = R/X: the unequal part cancels exactly, and for R = X the mean is 50.0 cm even though l₁ alone is not. (Corrected while building: averaging does not cancel α in general; docs/07 §4.2 now says so.)
- R = 0 (all plugs in, contact 0.005 Ω): I_g has the same sign at every jockey position from 0.5 to 99.5 cm, so there is no balance on the wire. Source: docs/07 §4.2.
- Key open → every current is 0. Jockey up → I_g = 0 and the matrix is not singular.
`wire.test.ts`:
- `wireOhm(0, 100)` with no scrapes = 100·ρ + nothing else (end resistances are separate). The default ρ for 0.50 mm constantan is 0.025 Ω/cm within 2%. Source: constantan resistivity 4.9×10⁻⁷ Ω m (Kaye & Laby, NPL).
- A 3% scrape over 0–20 cm moves the R = X balance from 50.0 to 49.7 cm (±0.05). That is "a few mm", per docs/07 §4.2.
- Overlapping scrapes don't double-count.
`plugBox.test.ts`:
- Values [1, 2, 2, 5, 10]: all plugs in → contact resistance only. Only the "5" plug out → 5 Ω + contact. All out → 20 Ω + contact.
`galvanometer.test.ts`:
- A constant current gives a steady θ = S·I within 0.5% after 3 s. Underdamped (ζ < 1) overshoots first.
- A current giving S·I = 4× full scale clamps θ at +fullScaleDeg and sets `slammed` on impact (a per-step flag, true on the step the needle hits the stop fast).
- It is deterministic: the same inputs over 360 steps give an identical end state.
`cell.test.ts`:
- Rest emf is 1.5 V. Source: Leclanché cell emf ≈ 1.5 V (Nelkon & Parker; any WAEC physics text).
- With the key closed for 60 s, emf falls and r rises. After 120 s open, both recover to within 1% of rest.
- Polarisation changes sensitivity, not balance: after 60 s closed, I_g at the R = X jockey position 45 cm is smaller in magnitude than at t = 0, and I_g at 50.0 cm is still ≈ 0. Source: docs/07 §4.2.
`simulation.test.ts`:
- A far-from-balance tap (R = 1, X = 3, jockey at 90 cm, no protective resistor) slams the needle within 0.5 s. With a 1 kΩ protective resistor, the same tap stays on scale.
- `stepMeterBridge` doesn't re-solve when the inputs are unchanged and the key is open (the solution object is the same reference).

## Done-criteria
- `bun run --filter @snaplab/engine test` passes all of the above. Repo-wide `bun run typecheck` and `bun run lint` pass.
- No `Math.random`, `Date.now`, I/O or mutable module state in `packages/engine`.
- The `science-verifier` agent reviews formulas, units, sources and tolerances: PASS.
- Fresh-context `code-reviewer`: SHIP. PR `claude/meter-bridge-engine` → `main`.

## Implementer
Lead (packages/engine). The science-verifier checks it.

## Risks
- Galvanometer constants have no single textbook value. They are tuned so a tap 5 cm off balance (R = X = 3 Ω) deflects about half scale, and 20 cm off slams. The constants file states this, and the tests check behaviour, not those numbers.
- Polarisation rates are illustrative (no WAEC value). Only the qualitative behaviour is tested, and the teacher-notes panel will say so.
- The R = 0 behaviour depends on contact resistance being smaller than the A-end resistance. Both are documented constants, and the test guards it.
