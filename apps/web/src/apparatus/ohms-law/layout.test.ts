import { DIAGRAM_LEADS, PART_TERMINALS, TERMINAL_IDS, type TerminalId } from "@snaplab/engine";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { meterPose, newPose } from "../../learn/readings/poses";
import { ROUTE_POINTS, routeCable } from "./Lead";
import { BENCH_FOOTPRINTS, CABLE_SEAT_M, PIN_LENGTH_M, PLUG_RADIUS_M } from "./LeadParts";
import {
  INK_IDS,
  LEAD_REST,
  LEAD_REST_COUNT,
  NUT_SEAT_M,
  nutFoot,
  OHMS_LAW_LAYOUT,
  TERMINAL_LABELS,
  TERMINAL_PART,
} from "./layout";

/** The front camera's elevation (the lesson's bench pose is 42 degrees). */
const FRONT_EL_DEG = 42;

const boxOf = (f: (typeof BENCH_FOOTPRINTS)[number]) => ({
  x0: f.cx - f.hx,
  x1: f.cx + f.hx,
  z0: f.cz - f.hz,
  z1: f.cz + f.hz,
  top: f.top,
  cx: f.cx,
  slot: f.slot,
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
        if (!a || !b || a.slot === b.slot) continue; // a meter's case and its ledge are one part
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
      const own = kind;
      for (const eye of [-30, -15, 0, 15, 30]) {
        // 0.45 m is fitDistance's cap in learn/readings/poses.ts, the farthest the loupe stands.
        meterPose(kind, eye, 0.45, pose);
        const [cx, cy, cz] = pose.target;
        const [px, py, pz] = pose.position;
        for (let i = 0; i <= 200; i++) {
          const t = i / 200;
          const x = px + (cx - px) * t;
          const y = py + (cy - py) * t;
          const z = pz + (cz - pz) * t;
          for (const b of BOXES) {
            if (b.slot === own) continue; // this meter's own case and ledge
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

describe("V-I bench layout v4: the wired bench (docs/plans/beauty-pass.md, Step 0 items 2 and 3)", () => {
  // The engine lays the wire anywhere from 1 to 99 cm on the rule, 46 to 98 cm long
  // (packages/engine/src/ohms-law/params.ts): both ends of that range and the middle.
  const WIRES = [
    { startCm: 1, lengthCm: 46 },
    { startCm: 1, lengthCm: 98 },
    { startCm: 25, lengthCm: 60 },
    { startCm: 53, lengthCm: 46 },
  ] as const;
  type Wire = (typeof WIRES)[number];
  /** A nut's plug seat, where Lead starts the cable (the registry's point plus CABLE_SEAT_M). */
  const seatOf = (id: TerminalId, wire: Wire) => {
    const [x, y, z] = nutFoot(id, wire);
    return new THREE.Vector3(x, y + NUT_SEAT_M + CABLE_SEAT_M, z);
  };
  /** The lead's centreline as Lead draws it: its control points through the centripetal curve. */
  const path = (from: TerminalId, to: TerminalId, wire: Wire, bulge: number) => {
    const routed = Array.from({ length: ROUTE_POINTS }, () => new THREE.Vector3());
    const plain = Array.from({ length: 11 }, () => new THREE.Vector3());
    const ctrl = routeCable(routed, plain, from, to, seatOf(from, wire), seatOf(to, wire), bulge)
      ? routed
      : plain;
    return new THREE.CatmullRomCurve3(ctrl, false, "centripetal").getPoints(300);
  };
  /** A lead may lie on its own nut's part this close to the nut (onto the board, off the box). */
  const OWN_REACH_M = 0.1;

  it("sets the series row nearest her, the board behind it and the voltmeter behind that", () => {
    const z = (s: keyof typeof OHMS_LAW_LAYOUT) => OHMS_LAW_LAYOUT[s].position[2];
    for (const s of ["box", "ammeter", "key", "cells"] as const) {
      expect(z(s), s).toBeGreaterThan(z("wire"));
    }
    expect(z("voltmeter")).toBeLessThan(z("wire"));
    // The loop's neighbours have their nuts on one line, so its leads run straight across.
    const line = nutFoot("K1", WIRES[0])[2];
    for (const id of ["E+", "E-", "K2", "A+", "A-", "R1", "R2"] as const) {
      expect(nutFoot(id, WIRES[0])[2], id).toBeCloseTo(line, 9);
    }
  });

  it("no wired lead crosses a part: away from its own nuts, every lead lies on bare desk", () => {
    for (const wire of WIRES) {
      for (const [a, b] of DIAGRAM_LEADS) {
        for (const bulge of [-1, 0, 1]) {
          for (const p of path(a, b, wire, bulge)) {
            for (const f of BOXES) {
              const inside = p.x > f.x0 && p.x < f.x1 && p.z > f.z0 && p.z < f.z1;
              if (!inside) continue;
              const own = [a, b].some((id) => {
                if (TERMINAL_PART[id] !== f.slot) return false;
                const [nx, , nz] = nutFoot(id, wire);
                return Math.hypot(p.x - nx, p.z - nz) < OWN_REACH_M;
              });
              const at = `(${p.x.toFixed(3)}, ${p.z.toFixed(3)})`;
              const where = `${a}–${b}, bulge ${bulge}, wire from ${wire.startCm} cm, at ${at}`;
              expect(own, `over the ${f.slot}: ${where}`).toBe(true);
            }
          }
        }
      }
    }
  });

  it("no two wired leads cross in plan view", () => {
    // Two segments cross when each one's ends lie on opposite sides of the other.
    const side = (ax: number, az: number, bx: number, bz: number, px: number, pz: number) =>
      Math.sign((bx - ax) * (pz - az) - (bz - az) * (px - ax));
    const cross = (p0: THREE.Vector3, p1: THREE.Vector3, q0: THREE.Vector3, q1: THREE.Vector3) =>
      side(p0.x, p0.z, p1.x, p1.z, q0.x, q0.z) * side(p0.x, p0.z, p1.x, p1.z, q1.x, q1.z) < 0 &&
      side(q0.x, q0.z, q1.x, q1.z, p0.x, p0.z) * side(q0.x, q0.z, q1.x, q1.z, p1.x, p1.z) < 0;
    for (const wire of WIRES) {
      const paths = DIAGRAM_LEADS.map(([a, b]) => ({ a, b, pts: path(a, b, wire, 0) }));
      for (let i = 0; i < paths.length; i++) {
        for (let j = i + 1; j < paths.length; j++) {
          const p = paths[i];
          const q = paths[j];
          if (!p || !q) continue;
          // Two leads on one nut meet there, plug on plug: their last 3 cm are left out.
          const shared = [p.a, p.b].filter((id) => id === q.a || id === q.b);
          const near = (v: THREE.Vector3) =>
            shared.some((id) => {
              const [x, , z] = nutFoot(id, wire);
              return Math.hypot(v.x - x, v.z - z) < 0.03;
            });
          let crossings = 0;
          for (let s = 1; s < p.pts.length; s++) {
            const p0 = p.pts[s - 1];
            const p1 = p.pts[s];
            if (!p0 || !p1 || near(p0) || near(p1)) continue;
            for (let t = 1; t < q.pts.length; t++) {
              const q0 = q.pts[t - 1];
              const q1 = q.pts[t];
              if (!q0 || !q1 || near(q0) || near(q1)) continue;
              if (cross(p0, p1, q0, q1)) crossings++;
            }
          }
          const which = `${p.a}–${p.b} and ${q.a}–${q.b}, wire from ${wire.startCm} cm`;
          expect(crossings, which).toBe(0);
        }
      }
    }
  });

  it("gives every lead of the diagram a rest place on the bench, and none overlaps a part", () => {
    expect(LEAD_REST).toHaveLength(DIAGRAM_LEADS.length);
    expect(LEAD_REST_COUNT).toBe(DIAGRAM_LEADS.length);
    for (const r of LEAD_REST) {
      // The lead, its plugs and their pins, lying in its place.
      const x0 = r.x - PLUG_RADIUS_M;
      const x1 = r.x + PLUG_RADIUS_M;
      const z0 = r.z0 - PIN_LENGTH_M;
      const z1 = r.z1 + PIN_LENGTH_M;
      for (const f of BOXES) {
        const gap = Math.max(f.x0 - x1, x0 - f.x1, f.z0 - z1, z0 - f.z1);
        const which = `the lead at x ${r.x.toFixed(2)} and the ${f.slot}`;
        expect(gap, which).toBeGreaterThanOrEqual(0.01);
      }
    }
    // In a row, side by side, never touching.
    const xs = LEAD_REST.map((r) => r.x).sort((p, q) => p - q);
    for (let i = 1; i < xs.length; i++) {
      expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBeGreaterThan(4 * PLUG_RADIUS_M);
    }
  });
});
