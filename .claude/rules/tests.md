---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
---
# Test files (loads only when these files are touched)

- Vitest. Name tests by behaviour: `it("fails CHEM-BUR-2DP when a titre is written as 24.5")`.
- Never weaken, skip (`.skip`, `.todo`), focus (`.only`) or delete a test to get green, and never change an expected value unless the plan says the old value was wrong and cites the source.
- Science and rules tests: expected value plus its source in a comment. Floats via `toBeCloseTo`.
- API tests run against `fixtures/`, never the live Meta API.
- Golden-page tests (G1, G2 metre bridge; G3 titration) assert the exact item-by-item marks from docs/11 and docs/15.
