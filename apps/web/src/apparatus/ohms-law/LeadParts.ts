import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { LeadColour } from "../../learn/types";
import { boxProjectUV } from "../materials/bevel";
import type { QualityTier } from "../meter-bridge/types";
import { type BenchSlot, OHMS_LAW_LAYOUT } from "./layout";

// Shared pieces for the V–I bench's leads, nuts, board and tray: a seeded random source,
// colour jitter, geometry helpers, and the banana plug and crocodile clip shapes. Sizes in metres.

/**
 * Cable radius. A real flexible lead is a 3 mm tube (radius 1.5 mm); the bench draws it 1.9 times
 * as thick, and its plug 1.5 times as wide as a real 4 mm plug's sleeve (5.8 mm in radius), as
 * chunky as Backcountry 101's cables (docs/plans/asset-pass.md, "Backcountry side by side"), so
 * they still read at the whole-bench scale on a phone.
 */
export const LEAD_RADIUS_M = 0.0029;
/** Height of a banana plug standing on a nut: the pin foot is at 0, the cable leaves at the top. */
export const PLUG_HEIGHT_M = 0.04;
/**
 * Where the cable's centreline starts, above the plug's foot: inside the plug's boot, 5 mm below
 * its top, so the open end of the tube is buried in the plug and the cable leaves it the way a
 * real lead leaves its boot, not as a pipe stuck on top.
 */
export const CABLE_SEAT_M = PLUG_HEIGHT_M - 0.005;
/** The widest the plug gets: the crests of its ribbed grip. */
export const PLUG_RADIUS_M = 0.0086;
/** How far the plug's brass pin reaches below its foot, into the nut. */
export const PIN_LENGTH_M = 0.016;

export const LEAD_BASE_COLOURS: Record<LeadColour, string> = {
  red: "#b3281e",
  black: "#2a2a30",
  yellow: "#dbac10",
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

/**
 * A lead's sideways bulge, -1 to 1: fixed by its two ends and its colour, so two leads between the
 * same neighbours part. It is the seventh draw of the lead's seeded stream, the draw it was when
 * the cable, the plug and the pin each took two for their colours first. It is kept here, apart
 * from however many draws the colours take, so a restyled lead is never re-routed: the sag of each
 * lead is on the approved golden frame, and up to 11 cm of it moves with this number.
 */
export function leadBulge(from: string, to: string, colour: LeadColour): number {
  const rng = seeded(hashString(`lead-${from}-${to}-${colour}`));
  for (let i = 0; i < 6; i++) rng();
  return (rng() - 0.5) * 2;
}

/**
 * Fills a disc of radius `r` at (x, y) in the current fill style, and again across each edge of
 * the `size` square it touches, so a canvas tile of speckle stays seamless when it repeats.
 */
export function wrappedDisc(
  ctx: CanvasRenderingContext2D,
  size: number,
  x: number,
  y: number,
  r: number,
): void {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx + r < 0 || cx - r > size || cy + r < 0 || cy - r > size) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The flecks in each colour's rubber: a lighter and a darker one. */
const SKIN_FLECKS: Record<LeadColour, { light: string; dark: string }> = {
  red: { light: "#e8715a", dark: "#6b1510" },
  black: { light: "#7a7a84", dark: "#09090b" },
  yellow: { light: "#fbe27a", dark: "#9a7208" },
};

/**
 * The speckled rubber skin of a lead's cable and plug: the lead's colour with faint blotches and
 * fine light and dark flecks, so a flat colour is never one flat colour. Painted once (never per
 * frame), 128 px (64 on low), and it tiles both ways, because every mark is drawn again across
 * each edge it touches. The caller disposes it (share it through acquireTexture).
 */
export function leadTexture(colour: LeadColour, quality: QualityTier): THREE.CanvasTexture {
  const size = quality === "low" ? 64 : 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  const rnd = seeded(hashString(`lead-skin-${colour}`));
  const { light, dark } = SKIN_FLECKS[colour];
  ctx.fillStyle = LEAD_BASE_COLOURS[colour];
  ctx.fillRect(0, 0, size, size);
  const mark = (x: number, y: number, r: number) => wrappedDisc(ctx, size, x, y, r);
  for (let i = 0; i < 16; i++) {
    ctx.globalAlpha = 0.07 + rnd() * 0.07;
    ctx.fillStyle = rnd() < 0.5 ? light : dark;
    mark(rnd() * size, rnd() * size, size * (0.07 + rnd() * 0.13));
  }
  const flecks = quality === "low" ? 70 : 260;
  for (let i = 0; i < flecks; i++) {
    ctx.globalAlpha = 0.3 + rnd() * 0.45;
    ctx.fillStyle = rnd() < 0.55 ? light : dark;
    mark(rnd() * size, rnd() * size, (0.5 + rnd() * 1.1) * (size / 128));
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
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
 * One point of a profile: radius, height, and whether the surface runs smoothly through it (a
 * dome, a bullet nose) rather than turning a crease there (a shoulder, a chamfer).
 */
export type ProfilePoint = readonly [r: number, y: number, soft?: boolean];

/**
 * A solid of revolution about +y from a profile that runs up the outside and in over the top, as
 * three's LatheGeometry wants it, but with creases where the profile turns (lathe smooths every
 * corner, which rounds the edges of a machined part away). A point marked `soft` is smooth
 * through. With `faceted` each of the `radial` sides is flat, not smooth round (a hex nut), and
 * `turn` rotates the sides about +y. Position, normal and uv (u round, v up the profile),
 * non-indexed, about `radial * 2` triangles per profile segment. A segment that starts or ends on
 * the axis gives one triangle per side, not two.
 */
export function revolve(
  profile: readonly ProfilePoint[],
  radial: number,
  faceted = false,
  turn = 0,
): THREE.BufferGeometry {
  const segs = profile.length - 1;
  // Each segment's outward normal in (r, y), and where along the profile it starts.
  const flat: Array<readonly [number, number]> = [];
  const along: number[] = [0];
  for (let s = 0; s < segs; s++) {
    const a = profile[s];
    const b = profile[s + 1];
    if (!a || !b) continue;
    const dr = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dr, dy) || 1;
    flat.push([dy / len, -dr / len]);
    along.push((along[s] ?? 0) + len);
  }
  const total = along[segs] || 1;
  /** The normal at the start (e = 0) or the end (e = 1) of segment `s`. */
  const normalAt = (s: number, e: 0 | 1): readonly [number, number] => {
    const own: readonly [number, number] = flat[s] ?? [1, 0];
    if (!profile[s + e]?.[2]) return own;
    const next = flat[e === 1 ? s + 1 : s - 1];
    if (!next) return own;
    const x = own[0] + next[0];
    const y = own[1] + next[1];
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const corner = (
    r: number,
    y: number,
    theta: number,
    n: readonly [number, number],
    tn: number,
  ) => {
    // The normal turns round the axis with the vertex, or with the side's middle when faceted.
    pos.push(r * Math.sin(theta), y, r * Math.cos(theta));
    nor.push(n[0] * Math.sin(tn), n[1], n[0] * Math.cos(tn));
  };
  for (let s = 0; s < segs; s++) {
    const a = profile[s];
    const b = profile[s + 1];
    if (!a || !b) continue;
    const n0 = normalAt(s, 0);
    const n1 = normalAt(s, 1);
    const v0 = (along[s] ?? 0) / total;
    const v1 = (along[s + 1] ?? 0) / total;
    for (let j = 0; j < radial; j++) {
      const t0 = turn + (j / radial) * Math.PI * 2;
      const t1 = turn + ((j + 1) / radial) * Math.PI * 2;
      const mid = (t0 + t1) / 2;
      const u0 = j / radial;
      const u1 = (j + 1) / radial;
      // A and B are the segment's start at the two angles, D and C its end; the triangles are
      // (A, B, D) and (C, D, B), as LatheGeometry winds them, facing out.
      const nA = faceted ? mid : t0;
      const nB = faceted ? mid : t1;
      if (a[0] > 0) {
        corner(a[0], a[1], t0, n0, nA);
        uv.push(u0, v0);
        corner(a[0], a[1], t1, n0, nB);
        uv.push(u1, v0);
        corner(b[0], b[1], t0, n1, nA);
        uv.push(u0, v1);
      }
      if (b[0] > 0) {
        corner(b[0], b[1], t1, n1, nB);
        uv.push(u1, v1);
        corner(b[0], b[1], t0, n1, nA);
        uv.push(u0, v1);
        corner(a[0], a[1], t1, n0, nB);
        uv.push(u1, v0);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

/**
 * A knurled disc standing on y = 0 up to `height`: a star of `teeth` teeth (crest `radius`, root
 * `root` times that), flat shaded, with a top and no bottom, because it stands on something. The
 * ridges are what the ink pass draws as hatching, as on the plug grip and the nut.
 */
export function knurledDisc(
  radius: number,
  height: number,
  teeth: number,
  root = 0.9,
  turn = 0,
): THREE.BufferGeometry {
  const n = teeth * 2;
  const ring: Array<readonly [number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * root;
    ring.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const vert = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    uv.push(x, z);
  };
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    if (!p || !q) continue;
    // The edge's outward normal; the winding is LatheGeometry's (A, B, D) and (C, D, B).
    const ex = q[0] - p[0];
    const ez = q[1] - p[1];
    const l = Math.hypot(ex, ez) || 1;
    const nx = -ez / l;
    const nz = ex / l;
    vert(p[0], 0, p[1], nx, 0, nz);
    vert(q[0], 0, q[1], nx, 0, nz);
    vert(p[0], height, p[1], nx, 0, nz);
    vert(q[0], height, q[1], nx, 0, nz);
    vert(p[0], height, p[1], nx, 0, nz);
    vert(q[0], 0, q[1], nx, 0, nz);
    // The top: a fan from the middle, winding up.
    vert(p[0], height, p[1], 0, 1, 0);
    vert(q[0], height, q[1], 0, 1, 0);
    vert(0, height, 0, 0, 1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

/** One tile of the speckle skin covers this much of a plug, in metres (see boxProjectUV). */
export const PLUG_SKIN_TILE_M = 0.05;

/**
 * The plug's insulated body and its brass pin, standing on the origin: the pin points down into
 * the nut, the cable leaves at the top (y = PLUG_HEIGHT_M). The body is a ribbed grip (a
 * knurled barrel, the hatching of the reference's sleeve) and a stepped strain-relief boot where
 * the cable enters; the brass is the pin, with a bullet nose, and a collar ring at the foot, the
 * gold band left showing where a seated plug meets its nut. The body's uv is projected for
 * `leadTexture` (PLUG_SKIN_TILE_M). Tapered rings at the top and a fatter grip than the cable
 * (PLUG_RADIUS_M against LEAD_RADIUS_M) are what make it read as a banana plug at a squint.
 */
export function makePlugGeometries(quality: QualityTier): {
  body: THREE.BufferGeometry;
  pin: THREE.BufferGeometry;
} {
  const low = quality === "low";
  const seg = low ? 7 : 10;
  // Radii below were drawn for a 7.2 mm sleeve; r() scales them to PLUG_RADIUS_M.
  const r = (v: number) => v * (PLUG_RADIUS_M / 0.0072);
  const collarTop = 0.0042;
  const gripTop = 0.0268;
  // Fine ribs (20 teeth, a shallow 7% root): the ink pass draws each crease as a hatch line.
  const gripRoot = 0.93;
  const grip = knurledDisc(PLUG_RADIUS_M, gripTop - collarTop, low ? 8 : 20, gripRoot);
  grip.translate(0, collarTop, 0);
  // The boot: a lip, then two stepped rings, tapering to a rounded neck the cable leaves from.
  const boot = revolve(
    low
      ? [
          [r(0.0066), gripTop],
          [r(0.0056), 0.029],
          [r(0.0056), 0.0322],
          [r(0.0034), 0.0385],
          [0, PLUG_HEIGHT_M],
        ]
      : [
          [r(0.0066), gripTop],
          [r(0.0066), 0.0276],
          [r(0.0057), 0.0283],
          [r(0.0057), 0.0303],
          [r(0.005), 0.0307],
          [r(0.0054), 0.0311],
          [r(0.0054), 0.0331],
          [r(0.0045), 0.0337],
          [r(0.0036), 0.0372],
          [r(0.0033), 0.0389, true],
          [r(0.002), 0.0398, true],
          [0, PLUG_HEIGHT_M],
        ],
    seg,
  );
  const body = mergeAll([grip, boot]);
  boxProjectUV(body, [PLUG_SKIN_TILE_M, PLUG_SKIN_TILE_M]);
  const pinSeg = low ? 7 : 8;
  const pin = mergeAll([
    // The shank with a bullet nose, ending inside the collar. It is a 4 mm plug's pin, whatever
    // the sleeve's size, because the socket it goes into is a 4 mm one.
    revolve(
      low
        ? [
            [0, -PIN_LENGTH_M],
            [0.0021, -0.0146],
            [0.0023, 0.0004],
          ]
        : [
            [0, -PIN_LENGTH_M],
            [0.0019, -0.0147, true],
            [0.0023, -0.013],
            [0.0023, 0.0004],
          ],
      pinSeg,
    ),
    // The collar: a brass band where the sleeve meets the nut, the gold the reference's plugs show,
    // left in view when the plug is seated. It also closes the plug's open end: a ring across the
    // foot, from just inside the pin's shank (so no crack shows beside it) out to the band, and a
    // shoulder under the grip, out to the roots of its ribs, because the grip has no underside of
    // its own. A plug lying in the tray, end on to her, would otherwise show its hollow inside.
    revolve(
      [
        [0.002, 0],
        [r(0.0054), 0],
        [r(0.0054), collarTop],
        [PLUG_RADIUS_M * gripRoot, collarTop],
      ],
      seg,
    ),
  ]);
  return { body, pin };
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
// Key (base 0.092 wide on PLUG_KEY_DIMS, blocks on top), Meter (sloping-front case 0.12 x 0.118,
// 0.08 deep at the foot from 0.055 behind its position to 0.025 in front, with the nut ledge 0.012
// high and 0.04 deep in front), ResistanceBox (0.30 wide on PLUG_BOX_DIMS), the
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
  ["ammeter", 0.12, 0.118, 0.08, -0.015],
  ["ammeter", 0.12, 0.012, 0.04, 0.045],
  ["voltmeter", 0.12, 0.118, 0.08, -0.015],
  ["voltmeter", 0.12, 0.012, 0.04, 0.045],
  ["box", 0.3, 0.06, 0.1, 0],
  ["wire", 1.1, 0.02, 0.12, 0],
  ["tray", 0.26, 0.024, 0.34, 0],
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
