# Contracts: Lab Blueprint and Page Readings (step 3)

## Goal
Write the two Meta output contracts from docs/04 §4.1 and §4.2, with doc 15 §7's metre bridge additions. Each is a zod v4 strict schema plus the strict JSON Schema generated from it, so web, api and the Meta `text.format` share one source (`.claude/rules/contracts.md`).

## Out of scope
- The SSE event-stream schema (§4.3). It comes later, with `/api/snap`.
- The `text.format` wrapper and any Meta call (step 2, after kickoff).
- Validator tests against recorded Meta fixtures. `.claude/rules/contracts.md` requires them, but no fixtures exist before kickoff. Add them in step 2.
- Any parsing of `text_as_written` into marks. That belongs to `packages/rules`.

## Design decisions (lead)
1. **One name for written text.** Every value read off the page carries `text_as_written`, in both contracts. Doc 04 §4.1 says `as_written` for blueprint values; we unify the name to avoid two spellings of one idea.
2. **Boxes** are `{x0,y0,x1,y1}` numbers in 0–1 page coordinates, for blueprint components and every readings box (`.claude/rules/contracts.md`).
3. **Component `kind`** is one enum covering all experiments. Strict schemas can't switch enums per experiment, and `oneOf` is not allowed by Meta. Per-experiment lists are exported as constants for web and engine.
4. **Nullables:**
   - Primitives use zod `.nullable()`, which emits `type: ["string","null"]`, matching the rule file.
   - Nullable objects come out as `anyOf: [{...}, {type:"null"}]`. Meta allows `anyOf` below the root (dev.meta.ai/docs/structured-output, checked by api-verifier on Oct 22).
   - Meta acceptance of `type: [..,"null"]` is UNVERIFIED. Check it with one live call at kickoff (step 2) before relying on it.
5. Nothing is optional. Every key is required, and "absent" is `null` or `[]`.

## Files (all in `packages/contracts`)
- `package.json`: add the dependency `zod@^4.6.7` (`bun add zod` inside the package).
- `src/common.ts`:
  - `Box`: a strict object of 4 numbers, each `.min(0).max(1)`.
  - `Measured`: a strict object with `value: number|null`, `unit_as_written: string|null`, `text_as_written: string`.
  - `Experiment` enum: `meter_bridge | titration | glass_block | unknown`.
  - `Confidence` enum: `low | medium | high`.
  - `Legibility` enum: `clear | unsure`.
- `src/blueprint.ts`: `ComponentKind` enum, `COMPONENT_KINDS` per experiment, the `Blueprint` schema, and `type Blueprint = z.infer<...>`.
- `src/readings.ts`: `ReadingColumn` enum, the `Readings` schema and its type.
- `src/json-schema.ts`: `blueprintJsonSchema = z.toJSONSchema(Blueprint)` and `readingsJsonSchema = z.toJSONSchema(Readings)`. Both use the default draft-2020-12 and no post-processing.
- `src/index.ts`: re-exports everything above. It replaces `export {}`.
- `src/blueprint.test.ts`, `src/readings.test.ts`, `src/json-schema.test.ts`.

## Contracts (exact; key order is significant, all objects `z.strictObject`)

```ts
// common.ts
Box      = { x0: num01, y0: num01, x1: num01, y1: num01 }
Measured = { value: number|null, unit_as_written: string|null, text_as_written: string }

// blueprint.ts
ComponentKind = enum [
  // meter_bridge
  "bridge_wire","resistance_box","unknown_resistor","galvanometer","jockey","cell","key",
  "protective_resistor","connecting_wire",
  // titration
  "burette","pipette","conical_flask","retort_stand","white_tile","funnel","beaker",
  // glass_block
  "glass_block_outline","normal","incident_ray","refracted_ray","emergent_ray","pin",
  // any
  "other"
]
COMPONENT_KINDS: Record<"meter_bridge"|"titration"|"glass_block", readonly ComponentKind[]>
  // the three groups above; "other" is valid for every experiment but not listed in the groups

Blueprint = {
  experiment: Experiment,                 // FIRST key
  confidence: Confidence,
  components: Array<{ kind: ComponentKind, label_as_written: string|null, approx_box: Box }>,
  values: {
    meter_bridge: null | {
      resistances: Measured[],                  // the R values used
      unknown_label_as_written: string|null,    // e.g. "X"
      cell_type_as_written: string|null,        // e.g. "Leclanché cell"
      galvanometer_type_as_written: string|null // e.g. "centre-zero galvanometer"
    },
    titration: null | {
      acid_as_written: string|null,
      base_as_written: string|null,
      acid_concentration: Measured|null,
      base_concentration: Measured|null,
      pipette_volume: Measured|null,
      indicator_as_written: string|null,
      equation_as_written: string|null          // the engine derives the mole ratio from this (doc 07 §2.3)
    },
    glass_block: null | {
      length: Measured|null,
      width: Measured|null,
      angles_of_incidence: Measured[]
    }
  },
  setup_issues: Array<{ description: string, rule_code: string|null }>,
  notes: string
}

// readings.ts
ReadingColumn = enum ["R","l","R_inv","l_inv","initial","final","volume_used","i","r","d","tan_i","tan_r","other"]

Readings = {
  table_found: boolean,
  cells: Array<{
    row: string,                          // as written: "1", "rough", "1st"
    column: ReadingColumn,
    column_header_as_written: string|null, // e.g. "l (cm)", "l⁻¹" (PHYS-TABLE checks the unit here)
    text_as_written: string,              // exactly as written: "57" stays "57"
    value: number|null,
    unit_as_written: string|null,
    box: Box,
    legibility: Legibility
  }>,
  average_as_written: null | { text_as_written: string, value: number|null, rows_averaged: string[] },
  graph: null | {
    x_label_as_written: string|null,
    y_label_as_written: string|null,
    points: Array<{ x: number, y: number }>,  // in axis units, as plotted
    line_drawn: boolean,
    triangle: null | { p1: {x:number,y:number}, p2: {x:number,y:number}, p3: {x:number,y:number} }, // axis units
    slope_as_written: string|null,
    intercept_as_written: string|null,
    result_as_written: string|null,           // e.g. "X = 3.0 Ω"
    box: Box
  },
  precautions: string[],                       // word for word
  other_marks: Array<{ description: string, text_as_written: string|null, box: Box|null }>
}
```

Call sites: none yet. web (`apps/web`) and api (`apps/api`) will import `@snaplab/contracts` from step 2 / later stages. Run `bun run typecheck` across the whole repo.

## Tests (Vitest; behaviour names)
Sample data: build G1 sample objects from doc 15 §5 (Amina's flawed metre bridge page): R 1.0–5.0, l "25.3","39.8","50.2","57","62.4", l⁻¹ "0.02" in row 3, the two flawed precautions word for word, `values.titration` and `values.glass_block` null.

`blueprint.test.ts`
- `it("accepts the G1 metre bridge blueprint with titration and glass_block null")`
- `it("rejects an unknown top-level key")`
- `it("rejects an extra key inside a component")`
- `it("rejects experiment 'pendulum'")`
- `it("rejects a box coordinate above 1")`
- `it("requires every key: a blueprint missing setup_issues fails")`
- `it("accepts experiment 'unknown' with all three value blocks null")`

`readings.test.ts`
- `it("accepts the G1 readings with graph and precautions")`
- `it("keeps '57' as the string '57' in text_as_written after parsing")`
- `it("accepts graph: null and average_as_written: null")`
- `it("rejects legibility 'maybe'")`
- `it("keeps precautions word for word, including 'Avoid parallax error'")`

`json-schema.test.ts`, which walks every node, including `anyOf` branches, `items` and `properties`:
- `it("sets additionalProperties: false on every object in both schemas")`
- `it("lists every property in required on every object in both schemas")`
- `it("puts experiment as the first property of the blueprint schema")`
- `it("has an object (not anyOf) at the root of both schemas")`
- `it("emits the experiment enum as meter_bridge, titration, glass_block, unknown")`

## Done-criteria
1. `bun run --filter @snaplab/contracts test` passes all the tests above.
2. Repo-wide `bun run typecheck` exits 0.
3. `bun run lint` exits 0.
4. `z.infer` types are exported and named `Blueprint` and `Readings`, with the schemas exported as `BlueprintSchema` and `ReadingsSchema`.

## Implementer
`implementer`. All design decisions are fixed above. If zod's emitted JSON breaks an invariant test, stop and report; do not loosen the test.

## Risks
1. **Meta rejects `type: [..,"null"]` or `minimum`/`maximum`.** Fallback: a small `toMetaSchema` normaliser in `json-schema.ts`, decided at kickoff from a live call.
2. **zod emits `$defs`/`$ref` for the reused `Box`/`Measured`.** Meta allows `$ref` without cycles. The invariant walker must resolve `$ref` into `$defs`.
3. **One flat `ComponentKind` enum lets Spark label a burette on a metre bridge page.** The engine ignores kinds outside `COMPONENT_KINDS[experiment]`. That check lives in the engine, not here.
