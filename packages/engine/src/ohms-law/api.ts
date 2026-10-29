// The Ohm's-law (V–I) bench API (docs/07 §4.4, docs/plans/ohms-law-vi.md). The four signatures
// are frozen; the bodies live in their own modules:
//   paramsFromSeed(seed): OhmsLawParams                       params.ts
//   createOhmsLaw(params): OhmsLawState                       bench.ts
//   stepOhmsLaw(s, inputs, dtS = DT_S): OhmsLawState           bench.ts
//   compareWithDiagram(leads): DiagramComparison               compare.ts
// plus wireLengthFromResistanceM for part (b)(ii), used by the rules (partB.ts), and for the
// exam practical (docs/plans/exam-redesign.md): displayedValue, what a candidate reads off a
// dial (meter.ts), demoSeedFor, the Watch bench for a practice bench (params.ts), and
// effectiveXyOhm, the supervisor's value for the accuracy mark (supervisor.ts).
export { createOhmsLaw, stepOhmsLaw } from "./bench";
export { compareWithDiagram } from "./compare";
export { displayedValue } from "./meter";
export { DEMO_MIN_OHM_DIFFERENCE, demoSeedFor, paramsFromSeed } from "./params";
export { wireLengthFromResistanceM } from "./partB";
export { effectiveXyOhm } from "./supervisor";
