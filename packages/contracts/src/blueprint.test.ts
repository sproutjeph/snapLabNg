import { describe, expect, it } from "vitest";
import { type Blueprint, BlueprintSchema } from "./blueprint";

const box = { x0: 0.1, y0: 0.1, x1: 0.4, y1: 0.3 };

// G1: docs/15 §5, docs/11 §2. The key K is deliberately missing.
const g1 = (): Blueprint => ({
  experiment: "meter_bridge",
  confidence: "high",
  components: [
    { kind: "bridge_wire", label_as_written: "AC", approx_box: box },
    { kind: "resistance_box", label_as_written: "R", approx_box: box },
    { kind: "unknown_resistor", label_as_written: "X", approx_box: box },
    { kind: "galvanometer", label_as_written: "G", approx_box: box },
    { kind: "jockey", label_as_written: "J", approx_box: box },
    { kind: "cell", label_as_written: "E", approx_box: box },
  ],
  values: {
    meter_bridge: {
      resistances: [1, 2, 3, 4, 5].map((n) => ({
        value: n,
        unit_as_written: "Ω",
        text_as_written: `${n}.0`,
      })),
      unknown_label_as_written: "X",
      cell_type_as_written: "Leclanché cell",
      galvanometer_type_as_written: "centre-zero galvanometer",
    },
    titration: null,
    glass_block: null,
  },
  setup_issues: [{ description: "No key drawn in the circuit", rule_code: null }],
  notes: "",
});

describe("Blueprint", () => {
  it("accepts the G1 metre bridge blueprint with titration and glass_block null", () => {
    expect(BlueprintSchema.safeParse(g1()).success).toBe(true);
  });

  it("rejects an unknown top-level key", () => {
    expect(BlueprintSchema.safeParse({ ...g1(), extra: 1 }).success).toBe(false);
  });

  it("rejects an extra key inside a component", () => {
    const b = g1();
    const bad = { ...b, components: [{ ...b.components[0], extra: 1 }] };
    expect(BlueprintSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects experiment 'pendulum'", () => {
    expect(BlueprintSchema.safeParse({ ...g1(), experiment: "pendulum" }).success).toBe(false);
  });

  it("rejects a box coordinate above 1", () => {
    const b = g1();
    const bad = {
      ...b,
      components: [{ ...b.components[0], approx_box: { ...box, x1: 1.2 } }],
    };
    expect(BlueprintSchema.safeParse(bad).success).toBe(false);
  });

  it("requires every key: a blueprint missing setup_issues fails", () => {
    const { setup_issues: _omit, ...rest } = g1();
    expect(BlueprintSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts experiment 'unknown' with all three value blocks null", () => {
    const b: Blueprint = {
      ...g1(),
      experiment: "unknown",
      values: { meter_bridge: null, titration: null, glass_block: null },
    };
    expect(BlueprintSchema.safeParse(b).success).toBe(true);
  });
});
