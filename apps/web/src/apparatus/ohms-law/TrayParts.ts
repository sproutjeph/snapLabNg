import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bevelBox, bevelSegments, boxProjectUV } from "../materials";
import type { QualityTier } from "../meter-bridge/types";
import {
  makeCrocClipGeometries,
  makePlugGeometries,
  mergeAll,
  PLUG_HEIGHT_M,
  placeAlong,
  placeAt,
  seeded,
} from "./LeadParts";

// The geometry of the side tray, built once and merged per (item, ink id, material). Metres,
// local to the tray: x right, z toward the student, y up from the desk. The tray floor is at
// FLOOR_Y. Ink ids use the tray's block of ten (INK_IDS.tray + offset, offset 0 to 9):
//   0 the wooden tray        1 red and yellow cable   2 black cable   3 clips and plugs (thin)
//   4 sandpaper              5 rheostat's ceramic     6 winding       7 its brass hardware
//   8 micrometer's frame     9 its steel and brass
// Touching parts carry different ids, so a line is drawn where they meet.

export type TrayItemKey = "leads" | "sandpaper" | "rheostat" | "micrometer";
export type TrayMat =
  | "wood"
  | "red"
  | "black"
  | "yellow"
  | "bootRed"
  | "bootBlack"
  | "brass"
  | "steel"
  | "grit"
  | "ceramic"
  | "ebonite"
  | "frame";

/** How a merged part's uv is made: a tile size for box projection, or `keep` (the pieces did it). */
export type TrayUv = "keep" | readonly [number, number];

export interface TrayPart {
  /** The tappable item this belongs to; null for the tray itself. */
  item: TrayItemKey | null;
  /** Offset into the tray's block of ink ids (0 = the tray body). */
  ink: number;
  thin: boolean;
  mat: TrayMat;
  geo: THREE.BufferGeometry;
}

export const TRAY_SIZE = { x: 0.26, z: 0.34 } as const;
/** The metres one tile of the tray's mahogany covers: along the grain, across it. */
export const MAHOGANY_TILE_M: readonly [number, number] = [0.34, 0.26];
/** The floor is 4.5 mm thick: the kit's bevel is at most a third of the thinnest side, so 1.5 mm. */
export const FLOOR_Y = 0.0045;
/** The rim stands 24 mm above the desk (it was 14 mm): deep enough to read as a tray from the bench. */
export const TRAY_RIM_M = 0.024;
const WALL_H = TRAY_RIM_M;
const WALL_T = 0.016;
const RHEO_X = -0.075;
/** A lead's cable radius on the tray: 1.5 times the 3 mm lead of the bench, so it reads from afar. */
const CABLE_R = 0.0022;
/** A crocodile clip lies this long on the tray (m), whatever size LeadParts makes it. */
const CLIP_LENGTH_M = 0.05;
/** The tips of the clips and plugs lie at this x (m), 5 mm inside the leads' tap box. */
const TIP_X = 0.0;
/** A lying clip's top jaw is swung open by this much, a little different on each clip (radians). */
const CLIP_OPEN_MIN = 0.2;
const CLIP_OPEN_SPAN = 0.12;

export interface TrayBuild {
  parts: TrayPart[];
  /** One torus; the rheostat's winding is this, instanced at `coilMatrices`. */
  coilGeo: THREE.BufferGeometry;
  coilMatrices: THREE.Matrix4[];
  /** Where the invisible tap boxes sit: centre and size per item. */
  hits: Array<{
    item: TrayItemKey;
    centre: [number, number, number];
    size: [number, number, number];
  }>;
}

class Acc {
  private map = new Map<
    string,
    { part: Omit<TrayPart, "geo">; uv: TrayUv; geos: THREE.BufferGeometry[] }
  >();
  add(
    item: TrayItemKey | null,
    ink: number,
    thin: boolean,
    mat: TrayMat,
    geo: THREE.BufferGeometry,
    uv: TrayUv = "keep",
  ) {
    const key = `${item}|${ink}|${thin}|${mat}`;
    const e = this.map.get(key) ?? { part: { item, ink, thin, mat }, uv, geos: [] };
    e.geos.push(geo);
    this.map.set(key, e);
  }
  done(): TrayPart[] {
    return [...this.map.values()].map((e) => {
      const geo = mergeAll(e.geos);
      if (e.uv !== "keep") boxProjectUV(geo, e.uv);
      return { ...e.part, geo };
    });
  }
}

/**
 * Rewrites a wooden piece's uv so the grain runs along its long axis (`alongZ` or x), at `tile`
 * metres a tile, centred on (`u0`, `v0`) in the texture: a different place for each board, and
 * inside one tile, so the kit's mahogany (which does not tile without a seam) is never wrapped. The
 * piece is centred on the origin.
 */
function grainUV(
  geo: THREE.BufferGeometry,
  tile: readonly [number, number],
  alongZ: boolean,
  u0: number,
  v0: number,
): THREE.BufferGeometry {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const along = alongZ ? z : x;
    const across = alongZ ? x : z;
    const longFace = alongZ ? ax >= az : az >= ax;
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = along;
      v = across;
    } else if (longFace) {
      u = along;
      v = y;
    } else {
      u = across;
      v = y;
    }
    uv[i * 2] = u / tile[0] + u0;
    uv[i * 2 + 1] = v / tile[1] + v0;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

/**
 * The triangles of `geo` on the +x side of its axis (by centroid) and those on the -x side, as two
 * new geometries with position, normal and uv. `geo` is left as it was.
 */
function splitAtX(geo: THREE.BufferGeometry): [THREE.BufferGeometry, THREE.BufferGeometry] {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.getAttribute("position");
  const nor = src.getAttribute("normal");
  const uv = src.getAttribute("uv");
  const side = () => ({ p: [] as number[], n: [] as number[], u: [] as number[] });
  const above = side();
  const below = side();
  for (let t = 0; t < pos.count; t += 3) {
    const into = pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2) >= 0 ? above : below;
    for (let i = t; i < t + 3; i++) {
      into.p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      into.n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      into.u.push(uv.getX(i), uv.getY(i));
    }
  }
  if (src !== geo) src.dispose();
  const make = (s: ReturnType<typeof side>) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(s.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(s.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(s.u, 2));
    return g;
  };
  return [make(above), make(below)];
}

/**
 * A crocodile clip's two jaws come merged from LeadParts, one half each side of the axis (the +x
 * half is the top one once the clip lies down). Lying flat, the jaws show as one plate; this swings
 * the top half open by `open` radians about the root of its own middle line, so the mouth and its
 * teeth show, and adds a steel rivet on the swung half for the pivot. Returns the brass jaws and
 * the rivet.
 */
export function openedJaws(
  jaws: THREE.BufferGeometry,
  open: number,
  rivetSides = 10,
): { brass: THREE.BufferGeometry; rivet: THREE.BufferGeometry } {
  jaws.computeBoundingBox();
  const root = jaws.boundingBox?.min.y ?? 0;
  const [top, bottom] = splitAtX(jaws);
  top.computeBoundingBox();
  const inner = top.boundingBox?.min.x ?? 0;
  const outer = top.boundingBox?.max.x ?? 0;
  const mid = (inner + outer) / 2;
  const rivet = new THREE.CylinderGeometry(0.0034, 0.0034, 0.0018, rivetSides)
    .rotateZ(Math.PI / 2)
    .translate(outer, root + 0.0085, 0);
  const swing = (g: THREE.BufferGeometry) =>
    g.translate(-mid, -root, 0).rotateZ(-open).translate(mid, root, 0);
  swing(top);
  swing(rivet);
  return { brass: mergeAll([top, bottom]), rivet };
}

/** The two free ends of a lead: where the cable stops and the way a clip or plug points on from it. */
interface LeadEnd {
  at: THREE.Vector3;
  dir: THREE.Vector3;
}

/**
 * A lead coiled flat, as spare leads are kept: from its inner end, `turns` whole turns out round a
 * middle of radius `a`, gaining `b` of radius a radian (so `2 pi b` between turns, more than a
 * cable's width). The outer end leaves toward -z and bends away to the left; the inner end is
 * carried out over the coil to the left, lifted clear of the turns. Both ends lie at the left of the
 * coil, side by side, `rowGap` apart, which is how the pair of clips is left lying. The cable lies
 * at height `y`; the ends come down to `endY`, where a clip lies on the floor.
 */
function coiledLead(o: {
  cx: number;
  cz: number;
  a: number;
  b: number;
  turns: number;
  y: number;
  endY: number;
  rowGap: number;
  reach: number;
  rng: () => number;
}): { pts: THREE.Vector3[]; ends: [LeadEnd, LeadEnd] } {
  const { cx, cz, a, b, turns, y, endY, rowGap, reach, rng } = o;
  const thetaMax = turns * Math.PI * 2;
  const n = Math.round(turns * 20);
  const v = (x: number, yy: number, z: number) => new THREE.Vector3(x, yy, z);
  const jig = () => (rng() - 0.5) * 0.0006;
  const rOut = a + b * thetaMax;
  const left = cx - rOut - reach;
  // The coil: from the inner end (at angle pi, the left of the middle) round and out.
  const spiral: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * thetaMax;
    const r = a + b * th;
    const ang = Math.PI + th;
    spiral.push(v(cx + Math.cos(ang) * r + jig(), y, cz + Math.sin(ang) * r + jig()));
  }
  const over = y + 2 * CABLE_R + 0.0006;
  // The inner end's way out: up over the turns, straight to the left, and down to the floor.
  const crossing = [
    v(left, endY, cz),
    v(left + 0.012, y + 0.002, cz),
    v(cx - rOut - 0.006, over, cz),
    v(cx - a - rOut * 0.5, over, cz),
    v(cx - a * 1.2, over - 0.002, cz),
    v(cx - a, y, cz),
  ];
  // The outer end: away from the coil, bending left to lie beside the other end.
  const px = cx - rOut;
  const tail = [
    v(px - 0.001, y, cz - 0.004),
    v(px - 0.006, y, cz - rowGap * 0.6),
    v(px - 0.014, y * 0.5 + endY * 0.5, cz - rowGap),
    v(left, endY, cz - rowGap),
  ];
  const pts = [...crossing, ...spiral.slice(1), ...tail];
  return {
    pts,
    ends: [
      { at: v(left, endY, cz), dir: v(-1, 0, 0) },
      { at: v(left, endY, cz - rowGap), dir: v(-1, 0, 0) },
    ],
  };
}

export function buildTray(quality: QualityTier, rng: () => number): TrayBuild {
  const low = quality === "low";
  const bs = bevelSegments(quality);
  const acc = new Acc();
  const dir = new THREE.Vector3();
  const at = new THREE.Vector3();

  // ---- The tray: a shallow mahogany box, its boards rounded and the grain along each board ----
  // The floor is one whole tile, 0.26 m across by 0.34 m along, so its uv never leaves 0 to 1 and
  // the texture never wraps. Each wall takes its own slice of the tile (`v0`), so no two boards
  // show the same grain.
  const board = (
    w: number,
    h: number,
    d: number,
    r: number,
    x: number,
    y: number,
    z: number,
    alongZ: boolean,
    tile: readonly [number, number],
    u0: number,
    v0: number,
  ) => grainUV(bevelBox(w, h, d, r, Math.max(1, bs - 1)), tile, alongZ, u0, v0).translate(x, y, z);
  // One tile of the tray's own mahogany (makeMahoganyTexture) is the floor, 0.34 m along the grain
  // by 0.26 m across, so every board shows it at 3 px a millimetre.
  const wallTile = MAHOGANY_TILE_M;
  const floorTile = MAHOGANY_TILE_M;
  const hx = TRAY_SIZE.x / 2;
  const hz = TRAY_SIZE.z / 2;
  // Every board is a fifth of a millimetre short of the next one's face (and the short walls a
  // fifth of a millimetre lower), so no two faces ever lie in one plane to fight over the pixel.
  const eps = 0.0002;
  const shortH = WALL_H - eps;
  acc.add(
    null,
    0,
    false,
    "wood",
    mergeAll([
      board(
        TRAY_SIZE.x - 4 * eps,
        FLOOR_Y,
        TRAY_SIZE.z - 4 * eps,
        FLOOR_Y / 3,
        0,
        FLOOR_Y / 2,
        0,
        true,
        floorTile,
        0.5,
        0.5,
      ),
      // The long walls, down the sides, the full length...
      board(
        WALL_T,
        WALL_H,
        TRAY_SIZE.z - 2 * eps,
        0.003,
        hx - WALL_T / 2,
        WALL_H / 2,
        0,
        true,
        wallTile,
        0.5,
        0.15,
      ),
      board(
        WALL_T,
        WALL_H,
        TRAY_SIZE.z - 2 * eps,
        0.003,
        -hx + WALL_T / 2,
        WALL_H / 2,
        0,
        true,
        wallTile,
        0.5,
        0.85,
      ),
      // ...and the short walls, front and back, the full width across their ends: a frame.
      board(
        TRAY_SIZE.x - 2 * eps,
        shortH,
        WALL_T,
        0.003,
        0,
        shortH / 2,
        hz - WALL_T / 2,
        false,
        wallTile,
        0.5,
        0.3,
      ),
      board(
        TRAY_SIZE.x - 2 * eps,
        shortH,
        WALL_T,
        0.003,
        0,
        shortH / 2,
        -hz + WALL_T / 2,
        false,
        wallTile,
        0.5,
        0.7,
      ),
    ]),
  );

  // ---- Spare leads: red and black coiled with a crocodile clip on each end, yellow loose ----
  const clipProto = makeCrocClipGeometries();
  const plugProto = makePlugGeometries(quality);
  // The clip and plug shapes belong to LeadParts and may be reshaped: the leads are laid out from
  // their measured size, so the tips of the clips and plugs always stop where they should.
  const boxOf = (...geos: THREE.BufferGeometry[]) => {
    const b = new THREE.Box3();
    for (const g of geos) {
      g.computeBoundingBox();
      if (g.boundingBox) b.union(g.boundingBox);
    }
    return b;
  };
  const clipBox = boxOf(clipProto.boot, clipProto.jaws);
  const clipScale = CLIP_LENGTH_M / Math.max(1e-6, clipBox.max.y);
  const clipY = FLOOR_Y + Math.max(-clipBox.min.x, clipBox.max.x) * clipScale;
  const cableY = FLOOR_Y + CABLE_R;
  const segsPerM = low ? 120 : 250;
  const tubeOf = (pts: THREE.Vector3[]) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const len = curve.getLength();
    return {
      curve,
      geo: new THREE.TubeGeometry(
        curve,
        Math.max(12, Math.round(len * segsPerM)),
        CABLE_R,
        low ? 5 : 6,
        false,
      ),
    };
  };
  // Two coils, the black one on top of the red; their four clips lie in a row at the coils' left,
  // each lead's tail just long enough that its clips' tips stop at x = TIP_X.
  const coilOf = (c: { cx: number; a: number; b: number; turns: number }) => {
    const rOut = c.a + c.b * c.turns * Math.PI * 2;
    return { ...c, reach: Math.max(0.006, c.cx - rOut - (TIP_X + CLIP_LENGTH_M)) };
  };
  const redCoil = coilOf({ cx: 0.09, a: 0.006, b: 0.0012, turns: 3 });
  const blackCoil = coilOf({ cx: 0.092, a: 0.006, b: 0.0014, turns: 2 });
  const coils = [
    {
      lead: coiledLead({
        ...redCoil,
        cz: 0.068,
        y: cableY,
        endY: clipY,
        rowGap: 0.012,
        rng,
      }),
      mat: "red" as const,
      boot: "bootRed" as const,
      ink: 1,
    },
    {
      lead: coiledLead({
        ...blackCoil,
        cz: 0.094,
        y: cableY + 2 * CABLE_R,
        endY: clipY,
        rowGap: 0.012,
        rng,
      }),
      mat: "black" as const,
      boot: "bootBlack" as const,
      ink: 2,
    },
  ];
  // Each clip's mouth is open a little differently, from a stream of its own so the rest of the
  // tray draws what it did.
  const clipRng = seeded(0xc11b);
  for (const c of coils) {
    const { geo } = tubeOf(c.lead.pts);
    acc.add("leads", c.ink, false, c.mat, geo);
    for (const end of c.lead.ends) {
      const jaws = openedJaws(
        clipProto.jaws,
        CLIP_OPEN_MIN + clipRng() * CLIP_OPEN_SPAN,
        low ? 6 : 10,
      );
      acc.add(
        "leads",
        3,
        true,
        c.boot,
        placeAlong(clipProto.boot.clone(), end.at, end.dir, clipScale),
      );
      acc.add(
        "leads",
        3,
        true,
        "brass",
        placeAlong(jaws.brass, end.at, end.dir, clipScale),
        [0.04, 0.04],
      );
      acc.add("leads", 3, true, "steel", placeAlong(jaws.rivet, end.at, end.dir, clipScale));
    }
  }
  clipProto.boot.dispose();
  clipProto.jaws.dispose();
  // The yellow lead is folded back on itself along the front, a banana plug on each end.
  {
    const plugBox = boxOf(plugProto.body, plugProto.pin);
    // The pin's tip to the cable's entry, and the body's radius, which the plug rests on.
    const endX = TIP_X + (plugBox.max.y - plugBox.min.y);
    const radius = Math.max(plugBox.max.x, -plugBox.min.x);
    const py = FLOOR_Y + radius;
    // The cable leaves a plug level, along its axis, and only then settles to the floor: a plug
    // is wider than the cable, and a straight run from its middle down would tilt it. The plugs
    // lie a body's width apart (the front one against the front wall), and the fold-back stays
    // inside the rim, whatever size LeadParts makes the plug.
    const level = endX + Math.max(0.008, 2 * (py - cableY));
    const x1 = level + 0.012;
    const reach = Math.max(0.012, Math.min(0.037, TRAY_SIZE.x / 2 - WALL_T - CABLE_R - 0.001 - x1));
    const zA = Math.min(0.145, TRAY_SIZE.z / 2 - WALL_T - radius - 0.0005);
    const zB = zA - Math.max(0.019, 2 * radius + 0.003);
    const zAt = (t: number) => zA + (zB - zA) * t;
    const pts = [
      new THREE.Vector3(endX, py, zA),
      new THREE.Vector3(level, py, zA),
      new THREE.Vector3(x1, cableY, zA),
      new THREE.Vector3(x1 + 0.68 * reach, cableY, zAt(0.16)),
      new THREE.Vector3(x1 + reach, cableY, zAt(0.5)),
      new THREE.Vector3(x1 + 0.68 * reach, cableY, zAt(0.84)),
      new THREE.Vector3(x1, cableY, zB),
      new THREE.Vector3(level, py, zB),
      new THREE.Vector3(endX, py, zB),
    ];
    const { curve, geo } = tubeOf(pts);
    acc.add("leads", 1, false, "yellow", geo);
    for (const end of [0, 1]) {
      curve.getPoint(end, at);
      curve.getTangent(end, dir);
      if (end === 0) dir.negate(); // outward from the lead
      // A plug lies with its pin along `dir` and its cable entry at the lead's end.
      const origin = at.clone().addScaledVector(dir, PLUG_HEIGHT_M);
      const inward = dir.clone().negate();
      acc.add("leads", 3, true, "yellow", placeAlong(plugProto.body.clone(), origin, inward));
      acc.add(
        "leads",
        3,
        true,
        "brass",
        placeAlong(plugProto.pin.clone(), origin, inward),
        [0.04, 0.04],
      );
    }
  }
  plugProto.body.dispose();
  plugProto.pin.dispose();

  // ---- Sandpaper: a strip with torn ends, a little askew ----
  {
    const w = 0.084;
    const d = 0.042;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -d / 2);
    shape.lineTo(w / 2, -d / 2);
    // The torn right end, then the torn left end, in small teeth.
    for (let i = 0; i <= 8; i++) {
      shape.lineTo(w / 2 + (i % 2 === 0 ? 0 : -0.0016), -d / 2 + (i / 8) * d);
    }
    shape.lineTo(-w / 2, d / 2);
    for (let i = 8; i >= 0; i--) {
      shape.lineTo(-w / 2 + (i % 2 === 0 ? 0 : 0.0016), -d / 2 + (i / 8) * d);
    }
    shape.closePath();
    const paper = new THREE.ExtrudeGeometry(shape, { depth: 0.0014, bevelEnabled: false });
    paper.rotateX(-Math.PI / 2);
    // Grit across the whole face: one texture over the strip.
    const pos = paper.getAttribute("position");
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / w + 0.5;
      uv[i * 2 + 1] = pos.getZ(i) / d + 0.5;
    }
    paper.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    acc.add("sandpaper", 4, false, "grit", placeAt(paper, 0.065, FLOOR_Y, -0.052, 0, 0.06, 0));
  }

  // ---- Rheostat: a ceramic tube wound with wire, brass end caps, and a slider on a rod above ----
  // Identify only: it is not part of the circuit. It lies along z, so its tube sits on the floor.
  const tubeY = FLOOR_Y + 0.0215;
  const rodY = tubeY + 0.046;
  const rseg = low ? 12 : 24;
  const along = (g: THREE.BufferGeometry, y: number, z: number, x = RHEO_X) =>
    placeAt(g.rotateX(Math.PI / 2), x, y, z);
  acc.add(
    "rheostat",
    5,
    false,
    "ceramic",
    along(new THREE.CylinderGeometry(0.0185, 0.0185, 0.2, rseg), tubeY, 0),
    [0.06, 0.06],
  );
  const caps: THREE.BufferGeometry[] = [];
  const hardware: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    // A brass cap on each end of the tube and an upright to the rod (heavy), a terminal post out
    // of the cap (small).
    caps.push(
      along(new THREE.CylinderGeometry(0.0215, 0.0215, 0.014, rseg), tubeY, sz * 0.098),
      placeAt(new THREE.BoxGeometry(0.008, 0.034, 0.008), RHEO_X, tubeY + 0.03, sz * 0.1),
    );
    hardware.push(
      along(new THREE.CylinderGeometry(0.0055, 0.0055, 0.016, low ? 8 : 12), tubeY, sz * 0.112),
      along(new THREE.CylinderGeometry(0.0085, 0.0085, 0.005, 6), tubeY, sz * 0.113),
    );
  }
  hardware.push(along(new THREE.CylinderGeometry(0.0028, 0.0028, 0.208, low ? 8 : 10), rodY, 0));
  // The slider: a carriage round the rod and a foot reaching down to touch the winding.
  const sliderZ = 0.03;
  hardware.push(
    placeAt(new THREE.BoxGeometry(0.016, 0.012, 0.016), RHEO_X, rodY, sliderZ),
    placeAt(new THREE.BoxGeometry(0.004, 0.02, 0.012), RHEO_X, rodY - 0.012, sliderZ),
    placeAt(new THREE.BoxGeometry(0.009, 0.002, 0.012), RHEO_X, tubeY + 0.0203, sliderZ),
  );
  acc.add("rheostat", 7, false, "brass", mergeAll(caps), [0.04, 0.04]);
  acc.add("rheostat", 7, true, "brass", mergeAll(hardware), [0.04, 0.04]);
  acc.add(
    "rheostat",
    5,
    false,
    "ebonite",
    placeAt(
      new THREE.CylinderGeometry(0.0078, 0.0088, 0.014, low ? 10 : 16),
      RHEO_X,
      rodY + 0.013,
      sliderZ,
    ),
    [0.12, 0.12],
  );

  // The winding: one torus, instanced along the tube between two bare bands of ceramic.
  // On low the turns are fatter and fewer sides, so the winding still reads as one tight coil.
  const coilGeo = low
    ? new THREE.TorusGeometry(0.0193, 0.0022, 3, 12)
    : new THREE.TorusGeometry(0.0199, 0.0015, 4, 22);
  const coilN = low ? 28 : 38;
  const coilMatrices: THREE.Matrix4[] = [];
  for (let i = 0; i < coilN; i++) {
    const z = -0.074 + (0.148 * i) / (coilN - 1);
    coilMatrices.push(new THREE.Matrix4().makeTranslation(RHEO_X, tubeY, z));
  }

  // ---- Micrometer screw gauge: a black C-frame, a steel anvil and spindle, a brass thimble ----
  // Built along +x with its frame bulging toward +z, then centred in its tap box and yawed a little.
  {
    const mseg = low ? 10 : 20;
    const frameH = 0.028;
    const axisY = frameH / 2;
    const rc = 0.027; // the C's middle radius
    const t = 0.017; // the frame's thickness: a thick, cast-looking C
    const tipAngle = (15 * Math.PI) / 180;
    const cy = -rc * Math.sin(tipAngle);
    const shape = new THREE.Shape();
    // An arc from 15 degrees past the horizontal on one side, round the bottom, to the other side.
    shape.absarc(0, cy, rc + t / 2, Math.PI + tipAngle, 2 * Math.PI - tipAngle, false);
    shape.absarc(0, cy, rc - t / 2, 2 * Math.PI - tipAngle, Math.PI + tipAngle, true);
    shape.closePath();
    const frame = new THREE.ExtrudeGeometry(shape, {
      depth: frameH - 0.003,
      bevelEnabled: true,
      bevelThickness: 0.0015,
      bevelSize: 0.0012,
      bevelSegments: low ? 1 : 2,
      curveSegments: low ? 10 : 22,
    });
    // Extrusion runs along z: stand it up so the extrusion becomes the height, the arc lying flat.
    frame.rotateX(-Math.PI / 2);
    frame.translate(0, 0.0015, 0);
    toCreasedNormals(frame, 0.7);
    const tipX = rc * Math.cos(tipAngle);
    // The tips are at (+-tipX, axisZ = 0) once the arc is stood up (the shape's y runs to -z).
    const axis = (r0: number, r1: number, x0: number, x1: number, segs: number) => {
      const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, segs);
      g.rotateZ(-Math.PI / 2);
      return placeAt(g, (x0 + x1) / 2, axisY, 0);
    };
    const steel = mergeAll([
      axis(0.0054, 0.0054, -tipX - 0.002, -tipX + 0.014, mseg),
      axis(0.0046, 0.0046, tipX - 0.027, tipX + 0.004, mseg),
      axis(0.0084, 0.0084, tipX - 0.002, tipX + 0.03, mseg),
    ]);
    // The thimble (brass, with its edge turned and a groove), and the ratchet knob beyond it.
    // Fat, so it reads as the chunky brass barrel of the reference at a squint.
    const thimbleProfile = [
      [0.0, 0.0],
      [0.0112, 0.0],
      [0.0126, 0.0035],
      [0.0138, 0.009],
      [0.0138, 0.026],
      [0.0131, 0.027],
      [0.0, 0.027],
    ].map(([r, x]) => new THREE.Vector2(r ?? 0, x ?? 0));
    const thimble = new THREE.LatheGeometry(thimbleProfile, mseg);
    thimble.rotateZ(-Math.PI / 2);
    placeAt(thimble, tipX + 0.024, axisY, 0);
    const knob = new THREE.Shape();
    const teeth = low ? 8 : 14;
    for (let i = 0; i < teeth * 2; i++) {
      const ang = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.0102 : 0.0091;
      if (i === 0) knob.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
      else knob.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    knob.closePath();
    const ratchet = new THREE.ExtrudeGeometry(knob, { depth: 0.013, bevelEnabled: false });
    ratchet.rotateY(Math.PI / 2);
    placeAt(ratchet, tipX + 0.051, axisY, 0);
    const brass = mergeAll([thimble, ratchet]);

    // Centre the whole gauge in its tap box and yaw it a little, as it was put down.
    const all = new THREE.Box3();
    for (const g of [frame, steel, brass]) {
      g.computeBoundingBox();
      if (g.boundingBox) all.union(g.boundingBox);
    }
    const centre = all.getCenter(new THREE.Vector3());
    const yaw = -0.05;
    const settle = (g: THREE.BufferGeometry) => {
      g.translate(-centre.x, 0, -centre.z);
      g.rotateY(yaw);
      g.scale(0.9, 0.9, 0.9);
      return g.translate(0.07, FLOOR_Y, -0.125);
    };
    acc.add("micrometer", 8, false, "frame", settle(frame), [0.06, 0.06]);
    acc.add("micrometer", 9, false, "steel", settle(steel));
    acc.add("micrometer", 9, false, "brass", settle(brass), [0.04, 0.04]);
  }

  return {
    parts: acc.done(),
    coilGeo,
    coilMatrices,
    hits: [
      { item: "leads", centre: [0.06, 0.012, 0.085], size: [0.13, 0.03, 0.14] },
      { item: "micrometer", centre: [0.07, 0.016, -0.125], size: [0.12, 0.03, 0.06] },
      { item: "sandpaper", centre: [0.065, 0.008, -0.052], size: [0.09, 0.016, 0.05] },
    ],
  };
}

/** The box round everything of one item (the winding included for the rheostat), tray-local. */
export function itemBounds(build: TrayBuild, item: TrayItemKey | null): THREE.Box3 {
  const box = new THREE.Box3();
  for (const p of build.parts) {
    if (p.item !== item) continue;
    p.geo.computeBoundingBox();
    if (p.geo.boundingBox) box.union(p.geo.boundingBox);
  }
  if (item === "rheostat") {
    build.coilGeo.computeBoundingBox();
    const cb = build.coilGeo.boundingBox;
    if (cb) {
      for (const m of build.coilMatrices) box.union(cb.clone().applyMatrix4(m));
    }
  }
  return box;
}
