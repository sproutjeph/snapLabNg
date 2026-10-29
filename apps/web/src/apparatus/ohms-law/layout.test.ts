import { PART_TERMINALS, TERMINAL_IDS } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { meterPose, newPose } from "../../learn/readings/poses";
import { BENCH_FOOTPRINTS } from "./LeadParts";
import { INK_IDS, OHMS_LAW_LAYOUT, TERMINAL_LABELS, TERMINAL_PART } from "./layout";

/** The front camera's elevation (the lesson's bench pose is 42 degrees). */
const FRONT_EL_DEG = 42;

const boxOf = (f: (typeof BENCH_FOOTPRINTS)[number]) => ({
  x0: f.cx - f.hx,
  x1: f.cx + f.hx,
  z0: f.cz - f.hz,
  z1: f.cz + f.hz,
  top: f.top,
  cx: f.cx,
});
const BOXES = BENCH_FOOTPRINTS.map(boxOf);
const wireBox = (() => {
  const [x, , z] = OHMS_LAW_LAYOUT.wire.position;
  return BOXES.find((b) => b.cx === x && Math.abs((b.z0 + b.z1) / 2 - z) < 1e-9);
})();

describe("V-I bench layout v2", () => {
  it("keeps the frozen terminal ids, labels and part map", () => {
    expect(Object.keys(TERMINAL_LABELS).sort()).toEqual([...TERMINAL_IDS].sort());
    expect(Object.keys(TERMINAL_PART).sort()).toEqual([...TERMINAL_IDS].sort());
    for (const [part, ids] of Object.entries(PART_TERMINALS)) {
      for (const id of ids) expect(TERMINAL_PART[id]).toBe(part);
    }
  });

  it("puts no two parts on top of each other, with at least 1 cm between", () => {
    for (let i = 0; i < BOXES.length; i++) {
      for (let j = i + 1; j < BOXES.length; j++) {
        const a = BOXES[i];
        const b = BOXES[j];
        if (!a || !b || a.cx === b.cx) continue; // a meter's case and its ledge share a column
        const gapX = Math.max(a.x0 - b.x1, b.x0 - a.x1);
        const gapZ = Math.max(a.z0 - b.z1, b.z0 - a.z1);
        expect(Math.max(gapX, gapZ), `footprints ${i} and ${j}`).toBeGreaterThanOrEqual(0.01);
      }
    }
  });

  it("is compact: within 1.3 m by 1.1 m", () => {
    const x0 = Math.min(...BOXES.map((b) => b.x0));
    const x1 = Math.max(...BOXES.map((b) => b.x1));
    const z0 = Math.min(...BOXES.map((b) => b.z0));
    const z1 = Math.max(...BOXES.map((b) => b.z1));
    expect(x1 - x0).toBeLessThanOrEqual(1.3);
    expect(z1 - z0).toBeLessThanOrEqual(1.1);
  });

  it("never hides the wire board from the front camera", () => {
    expect(wireBox).toBeDefined();
    if (!wireBox) return;
    const reach = 1 / Math.tan((FRONT_EL_DEG * Math.PI) / 180);
    for (const b of BOXES) {
      if (b === wireBox || b.z0 < wireBox.z1 - 1e-9) continue; // only parts in front of the board
      // A part of height `top` hides the desk behind it for top x reach metres.
      const hiddenToZ = b.z0 - b.top * reach;
      const overlapsX = b.x1 > wireBox.x0 && b.x0 < wireBox.x1;
      const intoBoard = overlapsX ? Math.max(0, wireBox.z1 - hiddenToZ) : 0;
      expect(intoBoard, "depth of the board hidden by a front part").toBeLessThanOrEqual(0.01);
    }
  });

  it("keeps the meters square to the student, as the loupe poses look straight at their dials", () => {
    expect(OHMS_LAW_LAYOUT.ammeter.rotationY).toBe(0);
    expect(OHMS_LAW_LAYOUT.voltmeter.rotationY).toBe(0);
  });

  it("keeps the meters well apart", () => {
    const a = OHMS_LAW_LAYOUT.ammeter.position;
    const v = OHMS_LAW_LAYOUT.voltmeter.position;
    expect(Math.hypot(a[0] - v[0], a[2] - v[2])).toBeGreaterThanOrEqual(0.3);
  });

  it("leaves a clear line to each dial at the loupe's +-30 degrees", () => {
    const pose = newPose();
    for (const kind of ["ammeter", "voltmeter"] as const) {
      const own = OHMS_LAW_LAYOUT[kind].position[0];
      for (const eye of [-30, -15, 0, 15, 30]) {
        // 0.4 m: farther than the loupe ever stands (about 0.12 m on a laptop, 0.33 m on a phone).
        meterPose(kind, eye, 0.4, pose);
        const [cx, cy, cz] = pose.target;
        const [px, py, pz] = pose.position;
        for (let i = 0; i <= 200; i++) {
          const t = i / 200;
          const x = px + (cx - px) * t;
          const y = py + (cy - py) * t;
          const z = pz + (cz - pz) * t;
          for (const b of BOXES) {
            if (b.cx === own) continue; // this meter's own case and ledge
            const inside = x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.top;
            expect(inside, `${kind} at ${eye} deg blocked by a part at x ${b.cx}`).toBe(false);
          }
        }
      }
    }
  });

  it("keeps the current loop in order right to left: cells, key, ammeter, box", () => {
    const x = (s: keyof typeof OHMS_LAW_LAYOUT) => OHMS_LAW_LAYOUT[s].position[0];
    expect(x("cells")).toBeGreaterThan(x("key"));
    expect(x("key")).toBeGreaterThan(x("ammeter"));
    expect(x("ammeter")).toBeGreaterThan(x("box"));
  });

  it("gives every ink id block its own ten, with the pen and the tray apart", () => {
    const blocks = [
      INK_IDS.cells,
      INK_IDS.key,
      INK_IDS.ammeter,
      INK_IDS.voltmeter,
      INK_IDS.box,
      INK_IDS.wire,
      INK_IDS.tray,
      INK_IDS.pen,
    ];
    expect(new Set(blocks.map((b) => Math.floor(b / 10))).size).toBe(blocks.length);
    expect(INK_IDS.pen).toBeLessThan(INK_IDS.nutBase);
  });
});
