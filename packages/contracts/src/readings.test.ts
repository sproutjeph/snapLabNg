import { describe, expect, it } from "vitest";
import { type Readings, ReadingsSchema } from "./readings";

const box = { x0: 0.1, y0: 0.5, x1: 0.2, y1: 0.55 };

// G1: docs/15 §5 and docs/11 §2.
const l = ["25.3", "39.8", "50.2", "57", "62.4"];
const cell = (
  row: string,
  column: "R" | "l" | "l_inv",
  header: string,
  text: string,
): Readings["cells"][number] => ({
  row,
  column,
  column_header_as_written: header,
  text_as_written: text,
  value: Number(text),
  unit_as_written: null,
  box,
  legibility: "clear",
});

const g1 = (): Readings => ({
  table_found: true,
  cells: [
    ...l.map((_t, i) => cell(String(i + 1), "R", "R (Ω)", `${i + 1}.0`)),
    ...l.map((t, i) => cell(String(i + 1), "l", "l (cm)", t)),
    cell("3", "l_inv", "l⁻¹", "0.02"),
  ],
  average_as_written: null,
  graph: {
    x_label_as_written: "R⁻¹ (Ω⁻¹)",
    y_label_as_written: "l⁻¹",
    points: [
      { x: 1.0, y: 0.0395 },
      { x: 0.5, y: 0.0251 },
      { x: 0.333, y: 0.02 },
      { x: 0.25, y: 0.0175 },
      { x: 0.2, y: 0.016 },
    ],
    line_drawn: true,
    triangle: {
      p1: { x: 0.2, y: 0.016 },
      p2: { x: 0.25, y: 0.016 },
      p3: { x: 0.25, y: 0.0175 },
    },
    slope_as_written: "s = (0.0175 − 0.0160) ÷ (0.250 − 0.200) = 0.030",
    intercept_as_written: "c = 0.010",
    result_as_written: "X = s/c = 0.030 ÷ 0.010 = 3.0 Ω",
    box: { x0: 0.05, y0: 0.6, x1: 0.5, y1: 0.9 },
  },
  precautions: [
    "Avoid parallax error when reading the metre rule.",
    "I slid the jockey gently along the wire to find the balance point.",
  ],
  other_marks: [],
});

describe("Readings", () => {
  it("accepts the G1 readings with graph and precautions", () => {
    expect(ReadingsSchema.safeParse(g1()).success).toBe(true);
  });

  it("keeps '57' as the string '57' in text_as_written after parsing", () => {
    const parsed = ReadingsSchema.parse(g1());
    const c = parsed.cells.find((x) => x.column === "l" && x.row === "4");
    expect(c?.text_as_written).toBe("57");
    expect(c?.value).toBe(57);
  });

  it("accepts graph: null and average_as_written: null", () => {
    expect(
      ReadingsSchema.safeParse({ ...g1(), graph: null, average_as_written: null }).success,
    ).toBe(true);
  });

  it("rejects legibility 'maybe'", () => {
    const r = g1();
    const bad = { ...r, cells: [{ ...r.cells[0], legibility: "maybe" }] };
    expect(ReadingsSchema.safeParse(bad).success).toBe(false);
  });

  it("keeps precautions word for word, including 'Avoid parallax error'", () => {
    const parsed = ReadingsSchema.parse(g1());
    expect(parsed.precautions[0]).toBe("Avoid parallax error when reading the metre rule.");
    expect(parsed.precautions[1]).toBe(
      "I slid the jockey gently along the wire to find the balance point.",
    );
  });
});
