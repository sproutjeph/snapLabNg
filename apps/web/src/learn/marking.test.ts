import type { MarkSheet } from "@snaplab/contracts";
import { compareWithDiagram, DIAGRAM_LEADS } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { OHMS_LAW_LESSON } from "./lessons/ohms-law/lesson";
import { halves, stepStatuses } from "./marking";
import { emptyOhmsLawRecord, setCell, setLength, setPrecaution } from "./readings/record";
import type { BenchState, LessonMode } from "./types";

const joint = { tightened: true, clean: true };
const diagramLeads = DIAGRAM_LEADS.map(([a, b], i) => ({
  id: `L${i}`,
  a,
  b,
  jointA: joint,
  jointB: joint,
}));

function stateWith(over: Partial<BenchState> = {}): BenchState {
  return {
    comparison: compareWithDiagram([]),
    keyClosed: false,
    boxSettingOhm: 0,
    record: emptyOhmsLawRecord("practice"),
    identified: new Set(),
    ...over,
  };
}

const statusOf = (
  s: BenchState,
  key: string,
  sheet: MarkSheet | null = null,
  mode: LessonMode = "practice",
  leads = 0,
) =>
  stepStatuses(OHMS_LAW_LESSON, s, sheet, mode, leads)[
    OHMS_LAW_LESSON.steps.findIndex((st) => st.key === key)
  ];

describe("V–I step status", () => {
  it("marks a step done when she did it, not when it is right", () => {
    let record = setLength(emptyOhmsLawRecord("practice"), "57");
    record = setCell(record, 0, "R", "0");
    record = setCell(record, 0, "I", "0.3");
    record = setCell(record, 0, "V", "1");
    const s = stateWith({ record });
    expect(statusOf(s, "measure-xy")).toBe("done");
    expect(statusOf(s, "r0")).toBe("done");
    expect(statusOf(s, "r1")).toBe("todo");
  });

  it("needs two written precautions", () => {
    let record = setPrecaution(emptyOhmsLawRecord("practice"), 0, "The key was opened.");
    expect(statusOf(stateWith({ record }), "precautions")).toBe("todo");
    record = setPrecaution(record, 1, "Parallax was avoided.");
    expect(statusOf(stateWith({ record }), "precautions")).toBe("done");
  });

  it("confirms the wiring in practice mode but only counts leads in exam mode", () => {
    const wrong = stateWith({ comparison: compareWithDiagram(diagramLeads.slice(0, 6)) });
    expect(statusOf(wrong, "connect")).toBe("todo");
    const right = stateWith({ comparison: compareWithDiagram(diagramLeads) });
    expect(statusOf(right, "connect")).toBe("done");
    // Exam mode never says whether her circuit matches: seven leads made is "done".
    expect(statusOf(wrong, "connect", null, "exam", 7)).toBe("done");
  });

  it("shows a lost mark on the step it belongs to", () => {
    const sheet = {
      items: [{ rule: "PRECAUTIONS", outcome: "lost" }],
    } as unknown as MarkSheet;
    expect(statusOf(stateWith(), "precautions", sheet)).toBe("lost");
  });

  it("writes half marks the way an examiner does", () => {
    expect(halves(15.5)).toBe("15½");
    expect(halves(0.5)).toBe("½");
    expect(halves(20)).toBe("20");
  });
});
