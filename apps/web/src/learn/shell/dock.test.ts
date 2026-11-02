import { describe, expect, it } from "vitest";
import { dockedCovered, dockForStage, dockWidth } from "./dock";

// The guided demonstration's docked panels (docs/plans/guided-demo.md): what each covers of the
// stage, so the camera frames the bench in the rest. Layout, not science.

const base = { left: 0, right: 0, top: 68, bottom: 0 };

describe("dockForStage", () => {
  it("docks the table on the readings stages, the graph on Plot and Slope, and a card of lines after", () => {
    for (const s of ["r0", "r1", "repeat"]) expect(dockForStage(s)).toBe("readings");
    for (const s of ["plot", "slope"]) expect(dockForStage(s)).toBe("graph");
    for (const s of ["precautions", "law", "length"]) expect(dockForStage(s)).toBe("notes");
    for (const s of ["identify", "measure-xy", "connect", undefined]) {
      expect(dockForStage(s)).toBeNull();
    }
  });
});

describe("dockedCovered on a laptop", () => {
  it("leaves the base alone with nothing docked", () => {
    expect(dockedCovered(base, null, 1440, 900)).toBe(base);
  });

  it("covers a column down the right, the paper's being its 520 px sheet", () => {
    expect(dockWidth("paper", 1440)).toBe(520);
    const c = dockedCovered(base, "paper", 1440, 900);
    expect(c.right).toBeGreaterThanOrEqual(520);
    expect(c.right).toBeLessThan(560);
    expect(c.bottom).toBe(0);
    expect(c.top).toBe(68);
  });

  it("gives the graph the widest column and the table a narrow one", () => {
    expect(dockWidth("graph", 1440)).toBeGreaterThan(dockWidth("end", 1440));
    expect(dockWidth("readings", 1440)).toBeLessThan(dockWidth("paper", 1440));
    // Never more than the window can spare.
    expect(dockWidth("graph", 1100)).toBeLessThanOrEqual(1100 * 0.56);
  });

  it("restores the base when the dock closes", () => {
    const open = dockedCovered(base, "graph", 1440, 900);
    expect(open.right).toBeGreaterThan(0);
    expect(dockedCovered(base, null, 1440, 900).right).toBe(0);
  });
});

describe("dockedCovered on a phone held upright", () => {
  it("covers the part of the stage below the sheet's top, not the window's whole share", () => {
    // 390 x 844: the stage ends 227 px above the window's foot, over the step strip.
    const stageHeight = 617;
    const c = dockedCovered({ ...base, top: 100 }, "paper", 390, 844, stageHeight);
    const sheetTop = 844 * (1 - 0.58);
    expect(c.bottom).toBeCloseTo(stageHeight - sheetTop, 5);
    expect(c.right).toBe(0);
    // The bench keeps a free band above the sheet: more than a hundred px.
    expect(stageHeight - c.bottom - c.top).toBeGreaterThan(100);
  });

  it("covers nothing when the sheet starts below the stage", () => {
    const c = dockedCovered(base, "readings", 390, 844, 300);
    expect(c.bottom).toBe(0);
  });
});
