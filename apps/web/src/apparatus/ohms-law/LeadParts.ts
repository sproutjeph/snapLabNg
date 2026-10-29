import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { LeadColour } from "../../learn/types";
import type { QualityTier } from "../meter-bridge/types";
import { type BenchSlot, OHMS_LAW_LAYOUT } from "./layout";

// Shared pieces for the V–I bench's leads, nuts, board and tray: a seeded random source,
// colour jitter, geometry helpers, and the banana plug and crocodile clip shapes. Sizes in metres.

/** Cable radius: a lead is a 3 mm tube. */
export const LEAD_RADIUS_M = 0.0015;
/** Height of a banana plug standing on a nut: the pin foot is at 0, the cable leaves at the top. */
export const PLUG_HEIGHT_M = 0.04;

export const LEAD_BASE_COLOURS: Record<LeadColour, string> = {
  red: "#a82a22",
  black: "#26262a",
  yellow: "#d1a312",
};

/** A small seeded generator (mulberry32): same seed, same sequence, so shots do not flicker. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit hash of a string, for seeds and ink ids. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** `hex` with a small seeded shift in lightness and saturation (±amount). */
export function jitterColour(hex: string, rng: () => number, amount = 0.03): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    hsl.h,
    Math.min(1, Math.max(0, hsl.s + (rng() - 0.5) * amount)),
    Math.min(1, Math.max(0, hsl.l + (rng() - 0.5) * amount * 1.4)),
  );
  return c;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

/** Moves `geo` (in place) to `pos`, turned so its +y axis points along `dir`. */
export function placeAlong(
  geo: THREE.BufferGeometry,
  pos: THREE.Vector3,
  dir: THREE.Vector3,
  scale = 1,
  axis: readonly [number, number, number] = [0, 1, 0],
): THREE.BufferGeometry {
  _from.set(axis[0], axis[1], axis[2]);
  _to.copy(dir).normalize();
  _q.setFromUnitVectors(_from, _to);
  _s.setScalar(scale);
  _m.compose(pos, _q, _s);
  geo.applyMatrix4(_m);
  return geo;
}

/** Moves and turns `geo` (in place): position, then Euler angles in radians. */
export function placeAt(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  _p.set(x, y, z);
  _q.setFromEuler(new THREE.Euler(rx, ry, rz));
  _s.set(1, 1, 1);
  _m.compose(_p, _q, _s);
  geo.applyMatrix4(_m);
  return geo;
}

/**
 * Merges geometries into one, dropping what they do not share. Indexed and non-indexed
 * shapes are mixed freely. The inputs are disposed.
 */
export function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geos.length === 0) return new THREE.BufferGeometry();
  const flat = geos.map((g) => {
    const out = g.index ? g.toNonIndexed() : g;
    if (out !== g) g.dispose();
    for (const name of Object.keys(out.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") out.deleteAttribute(name);
    }
    return out;
  });
  const merged = mergeGeometries(flat, false);
  for (const g of flat) g.dispose();
  return merged ?? new THREE.BufferGeometry();
}

/**
 * The plug's insulated body and its brass pin, standing on the origin: the pin points down
 * into the nut, the cable leaves at the top (y = PLUG_HEIGHT_M).
 */
export function makePlugGeometries(quality: QualityTier): {
  body: THREE.BufferGeometry;
  pin: THREE.BufferGeometry;
} {
  const seg = quality === "low" ? 8 : 14;
  const profile = [
    new THREE.Vector2(0.0, 0.004),
    new THREE.Vector2(0.0052, 0.004),
    new THREE.Vector2(0.0058, 0.0055),
    new THREE.Vector2(0.0058, 0.022),
    new THREE.Vector2(0.0051, 0.026),
    new THREE.Vector2(0.0036, 0.031),
    new THREE.Vector2(0.0028, 0.036),
    new THREE.Vector2(0.0022, PLUG_HEIGHT_M),
    new THREE.Vector2(0.0, PLUG_HEIGHT_M),
  ];
  const body = new THREE.LatheGeometry(profile, seg);
  const pinParts: THREE.BufferGeometry[] = [
    placeAt(new THREE.CylinderGeometry(0.0021, 0.0021, 0.016, seg), 0, -0.004, 0),
    placeAt(new THREE.CylinderGeometry(0.0062, 0.0062, 0.003, seg), 0, 0.0055, 0),
  ];
  return { body, pin: mergeAll(pinParts) };
}

/**
 * A crocodile clip lying along +y: a rubber boot where the cable enters (y = 0), two toothed
 * steel jaws beyond it. About 6 cm long.
 */
export function makeCrocClipGeometries(): {
  boot: THREE.BufferGeometry;
  jaws: THREE.BufferGeometry;
} {
  const boot = mergeAll([
    placeAt(new THREE.CylinderGeometry(0.0045, 0.0062, 0.008, 10), 0, 0.004, 0),
    placeAt(new THREE.BoxGeometry(0.011, 0.026, 0.0085), 0, 0.021, 0),
  ]);
  const jawParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    // A tapering jaw: a flat plate leaning inward toward the tip, with teeth on its inside edge.
    jawParts.push(
      placeAt(
        new THREE.BoxGeometry(0.0022, 0.03, 0.0075),
        side * 0.0036,
        0.049,
        0,
        0,
        0,
        -side * 0.07,
      ),
    );
    for (let i = 0; i < 4; i++) {
      jawParts.push(
        placeAt(
          new THREE.BoxGeometry(0.0016, 0.0022, 0.0075),
          side * (0.0016 - i * 0.0004),
          0.044 + i * 0.0065,
          0,
          0,
          0,
          0,
        ),
      );
    }
  }
  return { boot, jaws: mergeAll(jawParts) };
}

// ---- Where the cable may not go ----------------------------------------------------------
// Leads rest on top of whatever they cross. These boxes are the bench's parts as the Wave 0
// parts size them (width x height x depth, centred on the part's layout position plus a z offset,
// rotation 0). They follow the modelled parts: CellHolder (base 0.142 long, walls 0.046 high),
// Key (base 0.092 wide on PLUG_KEY_DIMS, blocks on top), Meter (case 0.12 x 0.118 x 0.05, with the
// nut ledge 0.012 high and 0.04 deep in front), ResistanceBox (0.30 wide on PLUG_BOX_DIMS), the
// wire board and the tray. The wire board's brass strips and the tray's rheostat are left out.
// Change these with the parts.

export interface BenchFootprint {
  /** The bench slot this footprint belongs to (a meter has two: its case and its ledge). */
  slot: BenchSlot;
  cx: number;
  cz: number;
  /** Half the width (x) and half the depth (z). */
  hx: number;
  hz: number;
  /** Height of the top face above the desk. */
  top: number;
}

/** [slot, width, height, depth, z offset from the slot's position]. */
const FOOT_SIZES: ReadonlyArray<readonly [BenchSlot, number, number, number, number]> = [
  ["cells", 0.142, 0.046, 0.046, 0],
  ["key", 0.092, 0.024, 0.05, 0],
  ["ammeter", 0.12, 0.118, 0.05, 0],
  ["ammeter", 0.12, 0.012, 0.04, 0.045],
  ["voltmeter", 0.12, 0.118, 0.05, 0],
  ["voltmeter", 0.12, 0.012, 0.04, 0.045],
  ["box", 0.3, 0.06, 0.1, 0],
  ["wire", 1.1, 0.02, 0.12, 0],
  ["tray", 0.26, 0.014, 0.34, 0],
];

export const BENCH_FOOTPRINTS: readonly BenchFootprint[] = FOOT_SIZES.map(
  ([slot, w, h, d, dz]) => ({
    slot,
    cx: OHMS_LAW_LAYOUT[slot].position[0],
    cz: OHMS_LAW_LAYOUT[slot].position[2] + dz,
    hx: w / 2,
    hz: d / 2,
    top: h,
  }),
);

/** A cable slopes from a box's top edge down to the desk over this distance. */
const FOOT_RAMP_M = 0.015;

/** The height at (x, z) a cable must stay above: a box's top, ramping to the desk beside it. */
export function floorAt(x: number, z: number): number {
  let y = 0;
  for (const f of BENCH_FOOTPRINTS) {
    const dx = Math.max(Math.abs(x - f.cx) - f.hx, 0);
    const dz = Math.max(Math.abs(z - f.cz) - f.hz, 0);
    const d = Math.hypot(dx, dz);
    if (d < FOOT_RAMP_M) y = Math.max(y, f.top * (1 - d / FOOT_RAMP_M));
  }
  return y;
}
