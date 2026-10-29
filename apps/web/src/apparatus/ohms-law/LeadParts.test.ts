import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { QualityTier } from "../meter-bridge/types";
import { shapeCable } from "./Lead";
import {
  BENCH_FOOTPRINTS,
  CABLE_SEAT_M,
  floorAt,
  knurledDisc,
  LEAD_BASE_COLOURS,
  LEAD_RADIUS_M,
  makePlugGeometries,
  PIN_LENGTH_M,
  PLUG_HEIGHT_M,
  PLUG_RADIUS_M,
  revolve,
} from "./LeadParts";
import {
  HIT_MAX_M,
  HIT_MIN_M,
  HIT_TALL,
  MIN_HIT_PX,
  makeNutGeometries,
  NUT_TOP_M,
} from "./TerminalNut";

// The G4 asset pass: the leads' banana plug and cable, and the terminal nut they seat in
// (docs/plans/asset-pass.md, "Tests", G4). Pure builders only: no WebGL, no canvas.

const TIERS: readonly QualityTier[] = ["low", "mid", "high"];
const MM = 0.001;

const tris = (g: THREE.BufferGeometry) =>
  (g.index ? g.index.count : g.getAttribute("position").count) / 3;

function bounds(g: THREE.BufferGeometry): THREE.Box3 {
  g.computeBoundingBox();
  return (g.boundingBox as THREE.Box3).clone();
}

/** How many triangles wind against their own vertex normals (a back face): none, when it is built right. */
function facingIn(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const v = new THREE.Vector3();
  let bad = 0;
  for (let t = 0; t < pos.count / 3; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    const face = b.clone().sub(a).cross(c.clone().sub(a));
    if (face.lengthSq() < 1e-18) continue;
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) n.add(v.fromBufferAttribute(nor, t * 3 + k));
    if (face.dot(n) <= 0) bad++;
  }
  return bad;
}

describe("the banana plug", () => {
  it.each(TIERS)("stands PLUG_HEIGHT_M tall, within 1 mm, on the %s tier", (tier) => {
    const { body, pin } = makePlugGeometries(tier);
    const all = bounds(body).union(bounds(pin));
    expect(all.max.y).toBeGreaterThan(PLUG_HEIGHT_M - MM);
    expect(all.max.y).toBeLessThan(PLUG_HEIGHT_M + MM);
    // The pin points down into the nut, PIN_LENGTH_M below the foot at 0.
    expect(all.min.y).toBeCloseTo(-PIN_LENGTH_M, 3);
    // The sleeve stands on the foot, its brass collar below it: nothing of the body under the foot.
    expect(bounds(body).min.y).toBeGreaterThanOrEqual(0);
  });

  it.each(TIERS)(
    "is as wide as PLUG_RADIUS_M and no wider, so a nut's plug stays inside 1.5 cm, on the %s tier",
    (tier) => {
      const { body, pin } = makePlugGeometries(tier);
      for (const g of [body, pin]) {
        const b = bounds(g);
        const reach = Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z);
        expect(reach).toBeLessThanOrEqual(PLUG_RADIUS_M + 0.0002);
      }
      const b = bounds(body);
      expect(Math.max(b.max.x, b.max.z)).toBeGreaterThan(PLUG_RADIUS_M - 0.0005);
    },
  );

  it("is chunky next to its cable: the sleeve over 2.5 times the cable's radius, the cable 1.5 to 2 times a real 3 mm lead", () => {
    // Backcountry 101's cables and plugs are about 1.5 to 2 times thicker than the real ones
    // (docs/plans/asset-pass.md, "Backcountry side by side"); a real lead is a 3 mm tube.
    expect(PLUG_RADIUS_M / LEAD_RADIUS_M).toBeGreaterThan(2.5);
    expect(LEAD_RADIUS_M / 0.0015).toBeGreaterThanOrEqual(1.5);
    expect(LEAD_RADIUS_M / 0.0015).toBeLessThanOrEqual(2);
  });

  it("costs at most 1.3 times the plug it replaces (336 triangles on high, 192 on low)", () => {
    // Counted from the Wave 1 plug: a 14-segment lathe body of 8 profile points plus two cylinders.
    for (const [tier, before] of [
      ["high", 336],
      ["mid", 336],
      ["low", 192],
    ] as const) {
      const { body, pin } = makePlugGeometries(tier);
      expect(tris(body) + tris(pin), tier).toBeLessThanOrEqual(before * 1.3);
    }
    // And the low tier is the lighter one.
    const hi = makePlugGeometries("high");
    const lo = makePlugGeometries("low");
    expect(tris(lo.body) + tris(lo.pin)).toBeLessThan(tris(hi.body) + tris(hi.pin));
  });

  it("faces out on every triangle, so the ink pass and the lights see its outside", () => {
    for (const tier of TIERS) {
      const { body, pin } = makePlugGeometries(tier);
      expect(facingIn(body), `${tier} body`).toBe(0);
      expect(facingIn(pin), `${tier} pin`).toBe(0);
    }
  });

  it("gives the sleeve a uv for the speckled skin, so a lead's plug and cable are one plastic", () => {
    const { body } = makePlugGeometries("high");
    const uv = body.getAttribute("uv");
    expect(uv.count).toBe(body.getAttribute("position").count);
    let spread = 0;
    for (let i = 0; i < uv.count; i++) spread = Math.max(spread, Math.abs(uv.getY(i)));
    expect(spread).toBeGreaterThan(0.1);
  });
});

describe("the revolve and knurl builders", () => {
  it("revolve winds a lathe profile facing out, with a crease at a hard point and a smooth turn at a soft one", () => {
    const g = revolve(
      [
        [0.01, 0],
        [0.01, 0.01],
        [0.006, 0.014, true],
        [0, 0.016],
      ],
      12,
    );
    expect(facingIn(g)).toBe(0);
    // 12 sides: a quad each for two segments, and one triangle each for the segment ending on the axis.
    expect(tris(g)).toBe(12 * 2 + 12 * 2 + 12);
    // The vertical wall's normals are level and radial; the dome's are tilted up.
    const nor = g.getAttribute("normal");
    expect(Math.abs(nor.getY(0))).toBeLessThan(1e-6);
    let tilted = 0;
    for (let i = 0; i < nor.count; i++) if (nor.getY(i) > 0.3) tilted++;
    expect(tilted).toBeGreaterThan(0);
  });

  it("revolve with faceted sides gives a hex nut a flat normal on each face", () => {
    const g = revolve(
      [
        [0.009, 0],
        [0.009, 0.007],
      ],
      6,
      true,
    );
    const nor = g.getAttribute("normal");
    // Six distinct face normals, each shared by the six vertices of its quad.
    const seen = new Set<string>();
    for (let i = 0; i < nor.count; i++) {
      seen.add(`${nor.getX(i).toFixed(4)},${nor.getZ(i).toFixed(4)}`);
    }
    expect(seen.size).toBe(6);
    expect(facingIn(g)).toBe(0);
  });

  it("knurledDisc is a toothed barrel with a top and no bottom, facing out", () => {
    const g = knurledDisc(0.01, 0.005, 12, 0.9);
    expect(facingIn(g)).toBe(0);
    const b = bounds(g);
    // The positions are stored as 32-bit floats, so compare to a micron.
    expect(b.min.y).toBeCloseTo(0, 6);
    expect(b.max.y).toBeCloseTo(0.005, 6);
    expect(b.max.x).toBeLessThanOrEqual(0.01 + 1e-6);
    // 24 edges: two side triangles and one top triangle each, and nothing under it.
    expect(tris(g)).toBe(24 * 3);
  });
});

describe("the cable", () => {
  const s = new THREE.Vector3(0, 0.0757, 0);
  const e = new THREE.Vector3(0.3, 0.062, 0.2);
  const FLOOR_M = LEAD_RADIUS_M + 0.0004;

  it("starts at the plug and ends at the other plug, with a control point a stride along it", () => {
    const pts = Array.from({ length: 11 }, () => new THREE.Vector3());
    shapeCable(pts, s, e, 0.4);
    expect(pts[0]?.distanceTo(s)).toBeCloseTo(0, 9);
    expect(pts[10]?.distanceTo(e)).toBeCloseTo(0, 9);
    // The chord's end points are the plugs', and the cable between hangs below the chord.
    const mid = pts[5];
    expect(mid?.y).toBeLessThan((s.y + e.y) / 2);
  });

  it("never dips below the desk: its centre stays a cable radius and a little over it", () => {
    for (const bulge of [-1, -0.4, 0, 0.6, 1]) {
      for (const span of [0.05, 0.2, 0.5, 1]) {
        const pts = Array.from({ length: 11 }, () => new THREE.Vector3());
        shapeCable(pts, s, new THREE.Vector3(span, 0.06, 0.1), bulge);
        for (const p of pts) expect(p.y).toBeGreaterThanOrEqual(FLOOR_M - 1e-12);
      }
    }
  });

  it("starts inside the plug's boot, where the sleeve is wider than the cable, so no open end shows", () => {
    expect(CABLE_SEAT_M).toBeLessThan(PLUG_HEIGHT_M);
    expect(PLUG_HEIGHT_M - CABLE_SEAT_M).toBeLessThanOrEqual(0.008);
    const { body } = makePlugGeometries("high");
    const pos = body.getAttribute("position");
    let reach = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - CABLE_SEAT_M) < 0.002) {
        reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getZ(i)));
      }
    }
    // The boot there is at least a cable radius and a millimetre across.
    expect(reach).toBeGreaterThan(LEAD_RADIUS_M + MM);
  });

  it("is red, black or yellow, one colour a lead", () => {
    expect(Object.keys(LEAD_BASE_COLOURS).sort()).toEqual(["black", "red", "yellow"]);
  });
});

describe("what a cable rests on, unchanged by the asset pass", () => {
  // The footprints' tops, from the Wave 1 table in LeadParts.ts (cells 4.6 cm, key 2.4, a meter's
  // case 11.8 and its nut ledge 1.2, box 6, wire board 2, tray 1.4); floorAt(x, z) is the highest
  // top within 1.5 cm, sloping down to the desk over that distance.
  it("is the top of each part at its middle, and the desk well away from all of them", () => {
    const expected: Record<string, number> = {
      cells: 0.046,
      key: 0.024,
      box: 0.06,
      wire: 0.02,
      tray: 0.014,
    };
    for (const f of BENCH_FOOTPRINTS) {
      const want = expected[f.slot];
      if (want !== undefined) expect(floorAt(f.cx, f.cz), f.slot).toBeCloseTo(want, 9);
    }
    expect(floorAt(-0.16, 0.1)).toBeCloseTo(0.118, 9);
    expect(floorAt(-0.16, 0.145)).toBeCloseTo(0.012, 9);
    expect(floorAt(5, 5)).toBe(0);
  });

  it("slopes from a part's edge down to the desk over 1.5 cm", () => {
    const key = BENCH_FOOTPRINTS.find((f) => f.slot === "key");
    if (!key) throw new Error("no key footprint");
    const edge = key.cx + key.hx;
    expect(floorAt(edge, key.cz)).toBeCloseTo(0.024, 9);
    expect(floorAt(edge + 0.0075, key.cz)).toBeCloseTo(0.012, 9);
    expect(floorAt(edge + 0.015, key.cz)).toBeCloseTo(0, 9);
  });
});

describe("the terminal nut", () => {
  it.each(TIERS)(
    "tops out at NUT_TOP_M, where a lead's plug seats, bare or capped, on the %s tier",
    (tier) => {
      for (const cap of ["brass", "red", "black"] as const) {
        const g = makeNutGeometries(tier, cap, 7);
        const top = (cap === "brass" ? bounds(g.knurl) : bounds(g.cap as THREE.BufferGeometry)).max
          .y;
        expect(top, cap).toBeGreaterThan(NUT_TOP_M - 0.0002);
        expect(top, cap).toBeLessThan(NUT_TOP_M + 0.0002);
        // The socket is a dark disc a tenth of a millimetre over the top, so it is not lost in it.
        const socket = bounds(g.socket);
        expect(socket.min.y).toBeGreaterThan(NUT_TOP_M);
        expect(socket.max.y).toBeLessThan(NUT_TOP_M + 0.0005);
      }
    },
  );

  it("stands on its foot and reaches no further than 11.5 mm, so the key's nuts, 6.2 cm apart, stay clear", () => {
    for (const tier of TIERS) {
      const g = makeNutGeometries(tier, "brass", 3);
      const b = bounds(g.base);
      expect(b.min.y).toBeCloseTo(0, 6);
      expect(Math.max(b.max.x, b.max.z, -b.min.x, -b.min.z)).toBeLessThanOrEqual(0.0115 + 1e-6);
    }
    expect(2 * 0.0115).toBeLessThan(0.062);
  });

  it("gives a meter's terminal an insulating cap and a bare one a threaded stud", () => {
    expect(makeNutGeometries("high", "brass").cap).toBeNull();
    expect(makeNutGeometries("high", "red").cap).not.toBeNull();
    expect(makeNutGeometries("high", "black").cap).not.toBeNull();
    // The stud has thread crests; the capped nut's knurl stops under the cap.
    const bare = bounds(makeNutGeometries("high", "brass").knurl).max.y;
    const capped = bounds(makeNutGeometries("high", "red").knurl).max.y;
    expect(bare).toBeGreaterThan(capped + 0.005);
  });

  it("is turned a little by its seed, so no two nuts are twins, but is the same nut for the same seed", () => {
    const flat = (g: THREE.BufferGeometry) => Array.from(g.getAttribute("position").array);
    const a = makeNutGeometries("high", "brass", 11);
    const b = makeNutGeometries("high", "brass", 11);
    const c = makeNutGeometries("high", "brass", 12);
    expect(flat(a.knurl)).toEqual(flat(b.knurl));
    expect(flat(a.knurl)).not.toEqual(flat(c.knurl));
  });

  it("faces out on every triangle", () => {
    for (const tier of TIERS) {
      for (const cap of ["brass", "red"] as const) {
        const g = makeNutGeometries(tier, cap, 5);
        expect(facingIn(g.base), `${tier} ${cap} base`).toBe(0);
        expect(facingIn(g.knurl), `${tier} ${cap} knurl`).toBe(0);
        if (g.cap) expect(facingIn(g.cap), `${tier} ${cap} cap`).toBe(0);
      }
    }
  });

  it("costs at most 1.3 times the nut it replaces (312 triangles on high, 180 on low)", () => {
    // Counted from the Wave 1 nut: washer, hex and neck cylinders, a knurled knob and a hole disc.
    for (const [tier, before] of [
      ["high", 312],
      ["mid", 312],
      ["low", 180],
    ] as const) {
      for (const cap of ["brass", "red"] as const) {
        const g = makeNutGeometries(tier, cap, 1);
        const total = tris(g.base) + tris(g.knurl) + (g.cap ? tris(g.cap) : 0) + tris(g.socket);
        expect(total, `${tier} ${cap}`).toBeLessThanOrEqual(before * 1.3);
      }
    }
  });

  it("keeps the tap target of Wave 1: 44 px across, at least 2 cm and at most 2.5 cm of radius, twice as tall", () => {
    // The nut's hit mesh and its sizing are untouched by the asset pass (C8): a nut stays as easy
    // to tap, whatever it looks like.
    expect(MIN_HIT_PX).toBeGreaterThanOrEqual(44);
    expect(HIT_MIN_M).toBeGreaterThanOrEqual(0.02);
    expect(HIT_MAX_M).toBeGreaterThanOrEqual(0.025);
    expect(HIT_TALL).toBeGreaterThanOrEqual(2);
  });
});
