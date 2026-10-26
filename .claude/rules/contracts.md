---
paths:
  - "packages/contracts/**"
---
# Shared contracts (loads only when these files are touched)

- One source per contract: the zod type and the strict JSON schema sent to Meta must describe the same shape. Change both in the same edit, plus a validator test against a recorded fixture.
- Strict schema rules: `additionalProperties: false` on every object; every property listed in `required`; optional means nullable (`type: ["string", "null"]`), not missing.
- Experiment type is the first property, so streaming clients can start building the bench early.
- Boxes are objects `{x0, y0, x1, y1}` in 0–1 page coordinates, never arrays.
- Every reading keeps `text_as_written` next to the parsed `value`.
- A contract change affects web and api. List both call sites in the plan, and run `bun run typecheck` across the whole repo, not one package.
