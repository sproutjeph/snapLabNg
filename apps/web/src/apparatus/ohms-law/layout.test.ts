import { PART_TERMINALS, TERMINAL_IDS } from "@snaplab/engine";
import { describe, expect, it } from "vitest";
import { INK_IDS, OHMS_LAW_LAYOUT, TERMINAL_LABELS, TERMINAL_PART } from "./layout";

// Footprints (width x, depth z, and the z offset of the box's centre from the slot position) as
// the parts are modelled: meters carry a 4 cm ledge in front of the 5 cm case.
const FEET = [
  ["cells", 0.142, 0.046, 0],
  ["key", 0.092, 0.05, 0],
  ["ammeter", 0.12, 0.09, 0.02],
  ["voltmeter", 0.12, 0.09, 0.02],
  ["box", 0.3, 0.1, 0],
  ["wire", 1.1, 0.12, 0],
  ["tray", 0.26, 0.34, 0],
] as const;

const box = (slot: (typeof FEET)[number]) => {
  const [name, w, d, dz] = slot;
  const [x, , z] = OHMS_LAW_LAYOUT[name].position;
  return { name, x0: x - w / 2, x1: x + w / 2, z0: z + dz - d / 2, z1: z + dz + d / 2 };
};

describe("V-I bench layout v2", () => {
  it("keeps the frozen terminal ids, labels and part map", () => {
    expect(Object.keys(TERMINAL_LABELS).sort()).toEqual([...TERMINAL_IDS].sort());
    expect(Object.keys(TERMINAL_PART).sort()).toEqual([...TERMINAL_IDS].sort());
    for (const [part, ids] of Object.entries(PART_TERMINALS)) {
      for (const id of ids) expect(TERMINAL_PART[id]).toBe(part);
    }
  });

  it("puts no two parts on top of each other, with at least 1 cm between", () => {
    const boxes = FEET.map(box);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (!a || !b) continue;
        const gapX = Math.max(a.x0 - b.x1, b.x0 - a.x1);
        const gapZ = Math.max(a.z0 - b.z1, b.z0 - a.z1);
        expect(Math.max(gapX, gapZ), `${a.name} and ${b.name}`).toBeGreaterThanOrEqual(0.01);
      }
    }
  });

  it("is compact: the board at the back and everything else in front, within 1.3 m by 1.1 m", () => {
    const boxes = FEET.map(box);
    const x0 = Math.min(...boxes.map((b) => b.x0));
    const x1 = Math.max(...boxes.map((b) => b.x1));
    const z0 = Math.min(...boxes.map((b) => b.z0));
    const z1 = Math.max(...boxes.map((b) => b.z1));
    expect(x1 - x0).toBeLessThanOrEqual(1.3);
    expect(z1 - z0).toBeLessThanOrEqual(1.1);
    const wireZ = OHMS_LAW_LAYOUT.wire.position[2];
    for (const slot of ["cells", "key", "ammeter", "voltmeter", "box"] as const) {
      expect(OHMS_LAW_LAYOUT[slot].position[2]).toBeGreaterThan(wireZ);
    }
  });

  it("keeps the meters square to the student, as the loupe poses look straight at their dials", () => {
    expect(OHMS_LAW_LAYOUT.ammeter.rotationY).toBe(0);
    expect(OHMS_LAW_LAYOUT.voltmeter.rotationY).toBe(0);
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
