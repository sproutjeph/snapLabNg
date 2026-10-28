import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BlueprintSchema } from "./blueprint";
import { Experiment, SnapExperiment } from "./common";
import { MarkSheet } from "./marks";
import { OhmsLawRecord } from "./ohmsLaw";

const m = (text: string, value: number | null, unit: string | null = null) => ({
  value,
  unit_as_written: unit,
  text_as_written: text,
});

const record = {
  experiment: "ohms_law_vi",
  mode: "practice",
  length_xy: m("75.0 cm", 75, "cm"),
  headers: { R: "R/Ω", I: "I/A", V: "V/V" },
  rows: [
    { R: m("0", 0), I: m("0.84", 0.84), V: m("2.60", 2.6) },
    { R: m("1", 1), I: m("0.66", 0.66), V: m("2.05", 2.05) },
  ],
  graph: {
    sheet: { width_cm: 18, height_cm: 24 },
    x: {
      label_as_written: "I/A",
      scale_as_written: "2 cm to 0.1 A",
      units_per_cm: 0.05,
      origin_value: 0,
    },
    y: {
      label_as_written: "V/V",
      scale_as_written: "2 cm to 0.2 V",
      units_per_cm: 0.1,
      origin_value: 0,
    },
    points: [{ x_cm: 16.8, y_cm: 26 }],
    line: { p1: { x_cm: 0, y_cm: 0 }, p2: { x_cm: 17, y_cm: 23 } },
    triangle: null,
    delta_y_as_written: null,
    delta_x_as_written: null,
    slope_as_written: null,
  },
  precautions: ["The key was opened between readings."],
  law_as_written: null,
  length_calc_as_written: null,
};

describe("OhmsLawRecord", () => {
  it("accepts a typed table exactly as she wrote it", () => {
    expect(OhmsLawRecord.parse(record).rows[1]?.V.text_as_written).toBe("2.05");
  });

  it("rejects a record for any other experiment", () => {
    expect(OhmsLawRecord.safeParse({ ...record, experiment: "meter_bridge" }).success).toBe(false);
  });

  it("rejects engine extras such as a true resistance", () => {
    expect(OhmsLawRecord.safeParse({ ...record, true_xy_ohm: 3.1 }).success).toBe(false);
  });

  it("converts to a JSON schema (for the later snap flow)", () => {
    expect(z.toJSONSchema(OhmsLawRecord).type).toBe("object");
  });
});

describe("ohms_law_vi in the shared enums", () => {
  it("is an Experiment, so MarkSheets can carry it with the V–I rule codes", () => {
    const item = {
      id: "PHYS-2DP:I",
      rule: "PHYS-2DP",
      outcome: "earned",
      marks_earned: 1,
      marks_available: 1,
      evidence: [{ box: null, text_as_written: "0.84" }],
      annotation: "tick",
      correction: null,
      fix_en: "",
      fix_pcm: null,
      source: null,
    };
    const sheet = {
      experiment: "ohms_law_vi",
      question_label: "Ohm's law (V–I)",
      earned: 1,
      available: 1,
      items: [item],
      setup_issues: [],
      teacher_mode: false,
    };
    expect(MarkSheet.parse(sheet).experiment).toBe("ohms_law_vi");
    expect(Experiment.options).toContain("ohms_law_vi");
  });

  it("is not a snap experiment yet, so Spark can never return it", () => {
    expect(SnapExperiment.options).not.toContain("ohms_law_vi");
    expect(BlueprintSchema.shape.experiment.safeParse("ohms_law_vi").success).toBe(false);
  });
});
