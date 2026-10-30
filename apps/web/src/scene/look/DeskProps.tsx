import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { InkGroup } from "../ink/ink";
import { INK_HEX } from "../ink/palette";
import { useLookTier } from "./lookTier";

// The exam desk's own things at the front edge of the paper (docs/plans/exam-redesign.md, "The
// look": ground; design target docs/design/asset-pass/desk-props.webp): a bound answer booklet,
// a hexagonal pencil, an eraser and a calculator. Chunky and hand-painted like the apparatus:
// matte (roughness about .9), speckled and worn, inked, and laid outside the bench's footprint,
// in front of it. The calculator's display is dark and blank: nothing here shows a value.

/**
 * Fixed ink ids for the desk props, clear of the V–I table (10–159). The four items keep their
 * own id; the sub-parts that touch them take 194–199 so a line is drawn between them.
 */
export const DESK_INK_IDS = { pencil: 190, eraser: 191, booklet: 192, calculator: 193 } as const;
const PAGES_INK = 194;
const KEYS_INK = 195;
const SCREEN_INK = 196;
const CONE_INK = 197;
const FERRULE_INK = 198;
const LEAD_INK = 199;
/** The booklet's stitches never touch the pencil, so they can share the cone's id. */
const THREAD_INK = CONE_INK;

/** Where each prop lies: [x, z] in metres and its turn about y. In front of the bench. */
export const DESK_PROP_PLACES = {
  pencil: { x: -0.52, z: 0.34, turn: -0.5 },
  eraser: { x: -0.22, z: 0.38, turn: -0.18 },
  booklet: { x: 0.14, z: 0.44, turn: 0.12 },
  calculator: { x: 0.5, z: 0.38, turn: -0.22 },
} as const;

// Sizes in metres. Each stays within the radius kitParams.ts frames it by (DESK_PROP_REACH_M).
const PENCIL_LEN = 0.175;
const PENCIL_R = 0.0058;
const CONE_LEN = 0.022;
/**
 * The ferrule and the rubber are round (twelve-sided, a corner pointing down) and wider than the
 * hexagon's flats; `x` is the middle of each along the pencil, which points toward +x.
 */
const FERRULE = { r: PENCIL_R * 1.06, len: 0.013, x: -PENCIL_LEN / 2 - 0.0062 } as const;
const RUBBER = { r: PENCIL_R * 0.98, len: 0.009, x: -PENCIL_LEN / 2 - 0.0172 } as const;
/** Where each part of the pencil is along its axis (the hexagon's middle is 0). */
export const PENCIL_X = {
  cone: PENCIL_LEN / 2 + CONE_LEN / 2,
  ferrule: FERRULE.x,
  rubber: RUBBER.x,
} as const;
/** A thick answer booklet: two boards round a block of pages, closed by a round spine on the left. */
export const BOOKLET = { w: 0.2, d: 0.27, h: 0.017 } as const;
/** Each board of the booklet's cover (3 mm: a round edge of 1.5 mm is the most it can have). */
export const COVER_H = 0.003;
/**
 * The page block stands out this far past the boards' edge on the three open sides, as a rounded
 * block of real pages bulges. It is what keeps the cream cream. The ink pass draws each outline on
 * the far side of an edge, so when the page block is the nearer surface the lines fall on the
 * dark boards beside it; when it is recessed they fall across the pages, and on a phone (the band
 * is 5 px tall at zoom 3) the two 3 px lines of the boards above and below cover all of it. The
 * pass counts a step as an edge from 0.3 mm of depth, and a face turned 45 degrees from the
 * camera shows half of a step, so this is more than 0.6 mm.
 */
export const PAGE_STAND = 0.001;
const CALC = { w: 0.08, d: 0.155, h: 0.0145 } as const;
const ERASER = { w: 0.052, d: 0.024, h: 0.014 } as const;
/**
 * The calculator's keys and display frame are chamfered slabs: the top is drawn in by this much
 * all round, which is the rounded edge (1.5 mm, the checklist's floor), and the corners are cut
 * by the same.
 */
const CALC_BEVEL = 0.0015;

/**
 * How the pencil lies. Its hexagon would rest on a flat face, 0.866 R below its axis, but the
 * round ferrule hangs lower (1.06 R, a corner pointing down) and so would sink 1.1 mm into the
 * desk. A real pencil lies on its ferrule and on the edge of its sharpened end instead: tilted by
 * a third of a degree with the ferrule end up, which no eye sees, with nothing under the desk.
 *
 * `y` is the height of the pencil's axis at its middle, `tilt` its turn about its own z axis
 * (negative lifts the ferrule end), and `lowest` the lowest point of each part in the desk's
 * frame, which is 0 for the two it rests on and above for the rest.
 */
export function pencilRest() {
  const flat = PENCIL_R * Math.cos(Math.PI / 6);
  const coneStart = PENCIL_LEN / 2;
  const ferruleEnd = FERRULE.x + FERRULE.len / 2;
  const tilt = Math.atan((FERRULE.r - flat) / (ferruleEnd - coneStart));
  const sin = Math.sin(tilt);
  const cos = Math.cos(tilt);
  // A part's lowest point is at the end of its bottom line that the tilt has lowered.
  const below = (x0: number, x1: number, depth: number) =>
    Math.min(x0 * sin, x1 * sin) - depth * cos;
  const body = below(-PENCIL_LEN / 2, PENCIL_LEN / 2, flat);
  const ferrule = below(FERRULE.x - FERRULE.len / 2, ferruleEnd, FERRULE.r);
  const rubber = below(RUBBER.x - RUBBER.len / 2, RUBBER.x + RUBBER.len / 2, RUBBER.r);
  const y = -Math.min(body, ferrule, rubber);
  return { y, tilt, lowest: { body: y + body, ferrule: y + ferrule, rubber: y + rubber } };
}

const PENCIL_REST = pencilRest();

type Tier = "low" | "mid" | "high";

/** mulberry32: a small seeded random source, so every load paints the same. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A canvas painted once by `draw`, as a sRGB texture (repeating when asked). */
function paint(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeat = false,
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
}

/** `count` small flecks of the given colours scattered over a w x h canvas. */
function flecks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rnd: () => number,
  count: number,
  colours: readonly string[],
  size: readonly [number, number],
  alpha: readonly [number, number],
) {
  for (let i = 0; i < count; i++) {
    const r = size[0] + rnd() * (size[1] - size[0]);
    ctx.globalAlpha = alpha[0] + rnd() * (alpha[1] - alpha[0]);
    ctx.fillStyle = colours[Math.floor(rnd() * colours.length)] ?? "#ffffff";
    ctx.beginPath();
    ctx.ellipse(rnd() * w, rnd() * h, r * (1 + rnd() * 0.8), r, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Soft patches that lift or deepen a base colour, so no face is one flat tone. */
function mottle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rnd: () => number,
  count: number,
  light: string,
  dark: string,
) {
  for (let i = 0; i < count; i++) {
    const r = Math.min(w, h) * (0.12 + rnd() * 0.3);
    const x = rnd() * w;
    const y = rnd() * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rnd() < 0.5 ? light : dark);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** The answer booklet's cover: ruled navy cloth, speckled and rubbed at the edges, with a small printed label. */
function bookletCover(tier: Tier) {
  const k = tier === "low" ? 0.5 : 1;
  const w = 640 * k;
  const h = 864 * k;
  return paint(w, h, (ctx) => {
    const rnd = rng(311);
    ctx.fillStyle = "#212a44";
    ctx.fillRect(0, 0, w, h);
    mottle(ctx, w, h, rnd, 26, "rgba(78,96,142,0.16)", "rgba(0,0,0,0.2)");
    // Cloth weave.
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 4 * k) {
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let x = 0; x < w; x += 4 * k) {
      ctx.strokeStyle = "rgba(0,0,0,0.07)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    flecks(
      ctx,
      w,
      h,
      rnd,
      1100,
      ["#f1e8cf", "#cfc8b6", "#8f95a8", "#f8f3e6"],
      [0.6 * k, 2 * k],
      [0.25, 0.75],
    );
    // Rubbed edges: a pale worn band round the rim.
    const rub = ctx.createLinearGradient(0, 0, 0, h);
    rub.addColorStop(0, "rgba(150,160,190,0.22)");
    rub.addColorStop(0.05, "rgba(150,160,190,0)");
    rub.addColorStop(0.95, "rgba(150,160,190,0)");
    rub.addColorStop(1, "rgba(150,160,190,0.22)");
    ctx.fillStyle = rub;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(244,236,220,0.5)";
    ctx.lineWidth = 4 * k;
    ctx.strokeRect(w * 0.06, h * 0.045, w * 0.88, h * 0.91);
    // The label: cream paper, a rule round it, two lines of ink.
    const lw = w * 0.6;
    const lh = h * 0.18;
    const lx = (w - lw) / 2;
    const ly = h * 0.2;
    ctx.fillStyle = "#f1e6c8";
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, lh, 10 * k);
    ctx.fill();
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.roundRect(lx + 8 * k, ly + 8 * k, lw - 16 * k, lh - 16 * k, 6 * k);
    ctx.stroke();
    ctx.fillStyle = INK_HEX;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(58 * k)}px Georgia, 'Times New Roman', serif`;
    ctx.fillText("ANSWER", w / 2, ly + lh * 0.34);
    ctx.fillText("BOOKLET", w / 2, ly + lh * 0.7);
  });
}

/**
 * The page edges: cream paper in nine leaves, each a shade apart from the next and parting from
 * it along a brown line wide enough to read at the booklet's size on screen, a little darker where
 * the boards squeeze them. The texture runs once up each side of the block (v is the height).
 */
function pageEdges() {
  const w = 64;
  const h = 160;
  return paint(w, h, (ctx) => {
    const rnd = rng(907);
    ctx.fillStyle = "#f6eed8";
    ctx.fillRect(0, 0, w, h);
    const leaves = 9;
    for (let i = 0; i < leaves; i++) {
      const y0 = (i / leaves) * h;
      const y1 = ((i + 1) / leaves) * h;
      ctx.fillStyle = rnd() < 0.5 ? "rgba(255,253,244,0.5)" : "rgba(222,190,134,0.2)";
      ctx.fillRect(0, y0, w, y1 - y0);
      ctx.fillStyle = `rgba(112,86,50,${0.4 + rnd() * 0.25})`;
      ctx.fillRect(0, y1 - 1.5, w, 3);
    }
    const squeeze = ctx.createLinearGradient(0, 0, 0, h);
    squeeze.addColorStop(0, "rgba(88,68,44,0.22)");
    squeeze.addColorStop(0.08, "rgba(88,68,44,0)");
    squeeze.addColorStop(0.92, "rgba(88,68,44,0)");
    squeeze.addColorStop(1, "rgba(88,68,44,0.22)");
    ctx.fillStyle = squeeze;
    ctx.fillRect(0, 0, w, h);
  });
}

/** A pink eraser: mottled, with a few darker crumbs and a grey smudge where it has been used. */
function eraserSkin(tier: Tier) {
  const k = tier === "low" ? 0.5 : 1;
  return paint(256 * k, 128 * k, (ctx) => {
    const w = 256 * k;
    const h = 128 * k;
    const rnd = rng(77);
    ctx.fillStyle = "#ee9d96";
    ctx.fillRect(0, 0, w, h);
    mottle(ctx, w, h, rnd, 14, "rgba(255,200,190,0.28)", "rgba(190,90,90,0.22)");
    flecks(ctx, w, h, rnd, 260, ["#c97a74", "#f7b9b0", "#d98a84"], [0.5 * k, 1.5 * k], [0.3, 0.7]);
    const smudge = ctx.createRadialGradient(w * 0.9, h * 0.6, 0, w * 0.9, h * 0.6, h * 0.5);
    smudge.addColorStop(0, "rgba(110,100,100,0.32)");
    smudge.addColorStop(1, "rgba(110,100,100,0)");
    ctx.fillStyle = smudge;
    ctx.fillRect(0, 0, w, h);
  });
}

/** The calculator's body: dark speckled plastic. The texture repeats, so the walls carry it at the top's scale. */
function calcBody(tier: Tier) {
  const k = tier === "low" ? 0.5 : 1;
  const w = 256 * k;
  const h = 496 * k;
  return paint(
    w,
    h,
    (ctx) => {
      const rnd = rng(131);
      ctx.fillStyle = "#1a1d25";
      ctx.fillRect(0, 0, w, h);
      mottle(ctx, w, h, rnd, 18, "rgba(70,78,98,0.18)", "rgba(0,0,0,0.25)");
      flecks(
        ctx,
        w,
        h,
        rnd,
        700,
        ["#e8dcc0", "#8f95a8", "#d9b36a", "#f4eee0"],
        [0.5 * k, 1.5 * k],
        [0.3, 0.8],
      );
    },
    true,
  );
}

/** The display: dark glass with a faint sheen and nothing on it. */
function screenGlass() {
  return paint(128, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 64);
    g.addColorStop(0, "#202838");
    g.addColorStop(1, "#10141e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 64);
    const sheen = ctx.createLinearGradient(0, 0, 128, 0);
    sheen.addColorStop(0, "rgba(255,255,255,0)");
    sheen.addColorStop(0.3, "rgba(255,255,255,0.08)");
    sheen.addColorStop(0.42, "rgba(255,255,255,0)");
    ctx.save();
    ctx.translate(0, 0);
    ctx.transform(1, 0, -0.5, 1, 0, 0);
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, 160, 64);
    ctx.restore();
  });
}

/** Pale wood with long grain, for the pencil's sharpened end. The grain runs along v. */
function woodGrain() {
  return paint(64, 64, (ctx) => {
    const rnd = rng(23);
    ctx.fillStyle = "#e6c48e";
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(150,100,48,${0.12 + rnd() * 0.22})`;
      ctx.fillRect(rnd() * 64, 0, 0.8 + rnd() * 2.4, 64);
    }
  });
}

/** Writes uv from the top view (x across, z down the page), so a texture lies on the top face. */
function topUV(geo: THREE.BufferGeometry, w: number, d: number): void {
  const pos = geo.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5;
    uv[i * 2 + 1] = 0.5 - pos.getZ(i) / d;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/**
 * Like topUV, but each wall takes the texture at the same scale as the top (one metre of the
 * wall is one metre of the texture) instead of a stretched edge pixel. Needs a repeating texture.
 */
function bodyUV(geo: THREE.BufferGeometry, w: number, d: number): void {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) {
      uv[i * 2] = pos.getX(i) / w + 0.5;
      uv[i * 2 + 1] = 0.5 - pos.getZ(i) / d;
    } else if (az >= ax) {
      uv[i * 2] = pos.getX(i) / w + 0.5;
      uv[i * 2 + 1] = pos.getY(i) / d;
    } else {
      uv[i * 2] = pos.getZ(i) / w;
      uv[i * 2 + 1] = pos.getY(i) / d;
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/** A hexagonal pencil body with flat facets, alternate faces a shade darker. Along x. */
export function pencilBody() {
  const raw = new THREE.CylinderGeometry(PENCIL_R, PENCIL_R, PENCIL_LEN, 6, 1);
  raw.rotateZ(Math.PI / 2);
  const geo = raw.toNonIndexed();
  raw.dispose();
  geo.computeVertexNormals();
  const nor = geo.getAttribute("normal");
  const colour = new Float32Array(nor.count * 3);
  for (let i = 0; i < nor.count; i++) {
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    const side = Math.abs(nor.getX(i)) < 0.5;
    // Face centres sit at k + 0.5 sixths of a turn: floor gives the face index with no tie.
    const face = Math.floor(Math.atan2(ny, nz) / (Math.PI / 3));
    const shade = !side ? 0.8 : (face & 1) === 0 ? 1 : 0.84;
    colour.set([shade, shade, shade], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colour, 3));
  return geo;
}

/** The sharpened end: wood narrowing from the hexagon to a third of its width, toward +x. */
export function coneGeometry() {
  const cone = new THREE.CylinderGeometry(PENCIL_R * 0.3, PENCIL_R, CONE_LEN, 6, 1);
  cone.rotateZ(-Math.PI / 2);
  return cone;
}

/** The ferrule, a round metal band at the other end. */
export function ferruleGeometry() {
  const ferrule = new THREE.CylinderGeometry(FERRULE.r, FERRULE.r, FERRULE.len, 12, 1);
  ferrule.rotateZ(Math.PI / 2);
  return ferrule;
}

/** The rubber, in the ferrule's end. */
export function rubberGeometry() {
  const rubber = new THREE.CylinderGeometry(RUBBER.r, RUBBER.r, RUBBER.len, 12, 1);
  rubber.rotateZ(Math.PI / 2);
  return rubber;
}

/** One rubber key: 10.5 x 10 mm at the foot, 3.4 mm tall. */
export function keyGeometry(low: boolean) {
  return softSlab(0.00525, 0.005, CALC_BEVEL, 0.0034, CALC_BEVEL, low);
}

/** The display's frame: 68 x 33 mm at the foot, 1.4 mm tall. */
export function bezelGeometry(low: boolean) {
  return softSlab(0.034, 0.0165, CALC_BEVEL, 0.0014, CALC_BEVEL, low);
}

/**
 * A slab with its corners cut in plan and its walls sloping in, open underneath, for a piece that
 * sits on another. The foot is a rectangle of half extents hx x hz with each corner cut by `cut`;
 * the top is the same outline drawn in by `inset` all round, `height` up. That slope is the rounded
 * edge (an inset of 1.5 mm or more), and being flat-shaded it catches the key light as a line.
 * With `plain` the outline is a bare rectangle: the low tier's cheaper block (10 triangles).
 * The foot sits at y = 0 and the shape is centred on the y axis.
 */
function softSlab(
  hx: number,
  hz: number,
  cut: number,
  height: number,
  inset: number,
  plain: boolean,
): THREE.BufferGeometry {
  const outline = (x: number, z: number): [number, number][] =>
    plain
      ? [
          [x, z],
          [x, -z],
          [-x, -z],
          [-x, z],
        ]
      : [
          [x - cut, z],
          [x, z - cut],
          [x, -z + cut],
          [x - cut, -z],
          [-x + cut, -z],
          [-x, -z + cut],
          [-x, z - cut],
          [-x + cut, z],
        ];
  const foot = outline(hx, hz);
  const top = outline(hx - inset, hz - inset);
  const out: number[] = [];
  // Pushes a triangle wound so that its normal points toward `hint`.
  const face = (
    a: readonly number[],
    b: readonly number[],
    c: readonly number[],
    hint: readonly number[],
  ) => {
    const [ax = 0, ay = 0, az = 0] = a;
    const [bx = 0, by = 0, bz = 0] = b;
    const [cx = 0, cy = 0, cz = 0] = c;
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const facing =
      (uy * vz - uz * vy) * (hint[0] ?? 0) +
      (uz * vx - ux * vz) * (hint[1] ?? 0) +
      (ux * vy - uy * vx) * (hint[2] ?? 0);
    out.push(ax, ay, az, ...(facing < 0 ? [cx, cy, cz, bx, by, bz] : [bx, by, bz, cx, cy, cz]));
  };
  const n = foot.length;
  for (let k = 0; k < n; k++) {
    const [fx0 = 0, fz0 = 0] = foot[k] ?? [];
    const [fx1 = 0, fz1 = 0] = foot[(k + 1) % n] ?? [];
    const [tx0 = 0, tz0 = 0] = top[k] ?? [];
    const [tx1 = 0, tz1 = 0] = top[(k + 1) % n] ?? [];
    const outward = [(fx0 + fx1) / 2, 0, (fz0 + fz1) / 2];
    face([fx0, 0, fz0], [fx1, 0, fz1], [tx1, height, tz1], outward);
    face([fx0, 0, fz0], [tx1, height, tz1], [tx0, height, tz0], outward);
  }
  for (let k = 1; k < n - 1; k++) {
    const [x0 = 0, z0 = 0] = top[0] ?? [];
    const [x1 = 0, z1 = 0] = top[k] ?? [];
    const [x2 = 0, z2 = 0] = top[k + 1] ?? [];
    face([x0, height, z0], [x1, height, z1], [x2, height, z2], [0, 1, 0]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(out), 3));
  geo.computeVertexNormals();
  return geo;
}

function usePropAssets(tier: Tier) {
  const assets = useMemo(() => {
    const low = tier === "low";
    const bs = low ? 1 : 2;
    const hex = pencilBody();
    // The sharpened end: wood, then a graphite point (both narrow toward +x).
    const cone = coneGeometry();
    const lead = new THREE.ConeGeometry(PENCIL_R * 0.3, CONE_LEN * 0.34, 6, 1);
    lead.rotateZ(-Math.PI / 2);
    const ferrule = ferruleGeometry();
    const rubber = rubberGeometry();

    const eraser = new RoundedBoxGeometry(ERASER.w, ERASER.h, ERASER.d, bs, 0.0045);

    // The booklet: two covers, the page block between them, and a rounded spine on the left.
    const cover = (thick: number) => new RoundedBoxGeometry(BOOKLET.w, thick, BOOKLET.d, 1, 0.0015);
    const coverTop = cover(COVER_H);
    topUV(coverTop, BOOKLET.w, BOOKLET.d);
    const coverBottom = cover(COVER_H);
    // The page block fills the space between the boards: from the spine's axis to PAGE_STAND past
    // the boards' open edges.
    const pages = new RoundedBoxGeometry(
      BOOKLET.w - BOOKLET.h / 2 + PAGE_STAND,
      BOOKLET.h - 2 * COVER_H,
      BOOKLET.d + 2 * PAGE_STAND,
      1,
      0.0015,
    );
    const spine = new THREE.CylinderGeometry(
      BOOKLET.h / 2,
      BOOKLET.h / 2,
      BOOKLET.d,
      low ? 8 : 12,
      1,
    );
    spine.rotateX(Math.PI / 2);
    const stitch = new THREE.BoxGeometry(0.0016, BOOKLET.h / 2, 0.0046);

    // The calculator: a body, a bezel and a blank screen, and 5 x 7 rubber keys as one instanced
    // mesh. The bezel and the keys are chamfered slabs (the low tier's are plain blocks).
    const calc = new RoundedBoxGeometry(CALC.w, CALC.h, CALC.d, bs, 0.0045);
    bodyUV(calc, CALC.w, CALC.d);
    const bezel = bezelGeometry(low);
    const screen = new THREE.PlaneGeometry(0.06, 0.025);
    screen.rotateX(-Math.PI / 2);
    const keyGeo = keyGeometry(low);
    const keyMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.88,
      metalness: 0,
    });
    const cols = 5;
    const rows = 7;
    const keys = new THREE.InstancedMesh(keyGeo, keyMat, cols * rows);
    keys.castShadow = !low;
    const place = new THREE.Matrix4();
    const tint = new THREE.Color();
    const keyRnd = rng(5);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        place.makeTranslation((c - (cols - 1) / 2) * 0.0136, 0, -0.0255 + r * 0.014);
        keys.setMatrixAt(i, place);
        const base = r === 0 ? "#5b6170" : "#9296a0";
        tint.set(base);
        tint.offsetHSL(0, 0, (keyRnd() - 0.5) * 0.07);
        keys.setColorAt(i, tint);
      }
    }
    keys.instanceMatrix.needsUpdate = true;
    if (keys.instanceColor) keys.instanceColor.needsUpdate = true;

    const tex = {
      cover: bookletCover(tier),
      pages: pageEdges(),
      eraser: eraserSkin(tier),
      calc: calcBody(tier),
      screen: screenGlass(),
      wood: woodGrain(),
    };
    const matte = (
      color: string,
      roughness = 0.9,
      extra: THREE.MeshStandardMaterialParameters = {},
    ) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    const materials = {
      pencil: matte("#e0a232", 0.88, { vertexColors: true }),
      wood: matte("#ffffff", 0.9, { map: tex.wood }),
      graphite: matte("#33363b", 0.85),
      ferrule: new THREE.MeshStandardMaterial({
        color: "#c3a35a",
        roughness: 0.5,
        metalness: 0.55,
      }),
      rubber: matte("#e8918a"),
      eraser: matte("#ffffff", 0.92, { map: tex.eraser }),
      cover: matte("#ffffff", 0.93, { map: tex.cover }),
      clothDark: matte("#1c243b", 0.93),
      // The page edges sit in the boards' shade and face away from the key light, and paper there
      // must still read cream, so they are lit a little from within.
      pages: matte("#ffffff", 0.95, {
        map: tex.pages,
        emissive: "#ffffff",
        emissiveMap: tex.pages,
        emissiveIntensity: 0.42,
      }),
      thread: matte("#e9dfc4", 0.95),
      calcBody: matte("#ffffff", 0.88, { map: tex.calc }),
      bezel: matte("#2d323d", 0.88),
      screen: matte("#ffffff", 0.34, { map: tex.screen }),
      keys: keyMat,
    };
    return {
      geometries: {
        hex,
        cone,
        lead,
        ferrule,
        rubber,
        eraser,
        coverTop,
        coverBottom,
        pages,
        spine,
        stitch,
        calc,
        bezel,
        screen,
        keyGeo,
      },
      keys,
      textures: tex,
      materials,
    };
  }, [tier]);
  useEffect(
    () => () => {
      for (const g of Object.values(assets.geometries)) g.dispose();
      for (const t of Object.values(assets.textures)) t.dispose();
      for (const m of Object.values(assets.materials)) m.dispose();
      assets.keys.dispose();
    },
    [assets],
  );
  return assets;
}

export function DeskProps() {
  const tier = useLookTier();
  const { geometries: g, materials: m, keys } = usePropAssets(tier);
  const P = DESK_PROP_PLACES;
  const cast = tier !== "low";
  const hb = BOOKLET.h / 2;
  // The page block runs from the spine's axis (x = hb - w / 2) to PAGE_STAND past the boards'
  // open edge (x = w / 2 + PAGE_STAND): its middle is half way between.
  const pagesX = (hb + PAGE_STAND) / 2;
  const bezelY = CALC.h / 2 - 0.0003;
  return (
    <group name="DeskProps">
      {/* Yaw about the desk's y axis, after the tilt about the pencil's own z (Euler order XYZ). */}
      <group
        position={[P.pencil.x, PENCIL_REST.y, P.pencil.z]}
        rotation={[0, P.pencil.turn, PENCIL_REST.tilt]}
      >
        <InkGroup id={DESK_INK_IDS.pencil}>
          <mesh geometry={g.hex} material={m.pencil} castShadow={cast} />
        </InkGroup>
        <InkGroup id={CONE_INK}>
          <mesh geometry={g.cone} material={m.wood} position-x={PENCIL_X.cone} castShadow={cast} />
        </InkGroup>
        <InkGroup id={LEAD_INK} thin>
          <mesh
            geometry={g.lead}
            material={m.graphite}
            position-x={PENCIL_LEN / 2 + CONE_LEN + CONE_LEN * 0.17}
          />
        </InkGroup>
        <InkGroup id={FERRULE_INK} thin>
          <mesh geometry={g.ferrule} material={m.ferrule} position-x={PENCIL_X.ferrule} />
        </InkGroup>
        {/* The rubber touches only the ferrule, so it can take the body's own id. */}
        <InkGroup id={DESK_INK_IDS.pencil} thin>
          <mesh geometry={g.rubber} material={m.rubber} position-x={PENCIL_X.rubber} />
        </InkGroup>
      </group>
      <group position={[P.eraser.x, ERASER.h / 2, P.eraser.z]} rotation-y={P.eraser.turn}>
        <InkGroup id={DESK_INK_IDS.eraser}>
          <mesh geometry={g.eraser} material={m.eraser} castShadow={cast} />
        </InkGroup>
      </group>
      <group position={[P.booklet.x, hb, P.booklet.z]} rotation-y={P.booklet.turn}>
        <InkGroup id={DESK_INK_IDS.booklet}>
          <mesh
            geometry={g.coverTop}
            material={m.cover}
            position-y={hb - COVER_H / 2}
            castShadow={cast}
          />
          <mesh
            geometry={g.coverBottom}
            material={m.clothDark}
            position-y={-hb + COVER_H / 2}
            castShadow={cast}
          />
          <mesh
            geometry={g.spine}
            material={m.clothDark}
            position-x={-BOOKLET.w / 2 + hb}
            castShadow={cast}
          />
        </InkGroup>
        <InkGroup id={PAGES_INK} thin>
          <mesh geometry={g.pages} material={m.pages} position-x={pagesX} />
        </InkGroup>
        <InkGroup id={THREAD_INK} thin>
          {[-0.085, 0, 0.085].map((z) => (
            <mesh
              key={z}
              geometry={g.stitch}
              material={m.thread}
              position={[-BOOKLET.w / 2 - 0.0004, 0, z]}
            />
          ))}
        </InkGroup>
      </group>
      <group position={[P.calculator.x, CALC.h / 2, P.calculator.z]} rotation-y={P.calculator.turn}>
        <InkGroup id={DESK_INK_IDS.calculator}>
          <mesh geometry={g.calc} material={m.calcBody} castShadow={cast} />
        </InkGroup>
        <InkGroup id={SCREEN_INK} thin>
          <mesh geometry={g.bezel} material={m.bezel} position={[0, bezelY, -0.051]} />
          <mesh
            geometry={g.screen}
            material={m.screen}
            position={[0, CALC.h / 2 + 0.0012, -0.051]}
          />
        </InkGroup>
        <InkGroup id={KEYS_INK} thin>
          <primitive object={keys} position={[0, CALC.h / 2 - 0.0004, 0]} />
        </InkGroup>
      </group>
    </group>
  );
}
