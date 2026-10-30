import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { acquireTexture, seededRandom, type Tier } from "../materials";

// Shared helpers for the V–I cell holder, key, meters and resistance box: a seeded random
// source, small colour jitter, matte materials, and a tidy dispose. Slice-owned (apparatus 1).

/** mulberry32: a small seeded random source, so the jitter is the same on every load. */
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

export const COLOURS = {
  ebonite: "#1f1d1c",
  bakelite: "#262320",
  brass: "#b9923f",
  zinc: "#8e949b",
  mahogany: "#6b3a22",
  cream: "#f1e8cf",
} as const;

/** A colour nudged a little in lightness and hue, from the seeded source. */
export function jitterColour(hex: string, rnd: () => number, amount = 0.025): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    hsl.h + (rnd() - 0.5) * amount * 0.4,
    Math.min(1, Math.max(0, hsl.s + (rnd() - 0.5) * amount)),
    Math.min(1, Math.max(0, hsl.l + (rnd() - 0.5) * amount * 1.6)),
  );
  return c;
}

export interface MatteOptions {
  roughness?: number;
  metalness?: number;
  amount?: number;
  map?: THREE.Texture;
}

/** A matte standard material (roughness 0.6 or more) with a seeded colour jitter. */
export function matte(hex: string, rnd: () => number, opts: MatteOptions = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: jitterColour(hex, rnd, opts.amount),
    roughness: Math.max(0.6, opts.roughness ?? 0.8),
    metalness: opts.metalness ?? 0,
  });
  if (opts.map) mat.map = opts.map;
  return mat;
}

/** Warm, slightly rough brass. */
export function brassMaterial(rnd: () => number) {
  return matte(COLOURS.brass, rnd, { roughness: 0.62, metalness: 0.35, amount: 0.04 });
}

/** The invisible tap target: never drawn, still hit by the raycaster. */
export function hitMaterial() {
  return new THREE.MeshBasicMaterial({ visible: false });
}

/**
 * Merges static pieces that share a material into one geometry (one draw call). Each piece is
 * moved first by `place`; pieces are made non-indexed and keep only position, normal and uv, so
 * boxes, cylinders and extrusions can mix. The inputs are disposed.
 */
export function mergeStatic(
  pieces: ReadonlyArray<{ geo: THREE.BufferGeometry; place?: (g: THREE.BufferGeometry) => void }>,
): THREE.BufferGeometry {
  const prepared = pieces.map(({ geo, place }) => {
    place?.(geo);
    const flat = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(flat.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") flat.deleteAttribute(name);
    }
    flat.clearGroups();
    geo.dispose();
    return flat;
  });
  const merged = mergeGeometries(prepared, false);
  for (const g of prepared) g.dispose();
  return merged;
}

/** A 2D canvas of the given size, with its context. */
export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  return { canvas, ctx };
}

export function canvasTexture(canvas: HTMLCanvasElement, anisotropy = 4): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/** Disposes every geometry, material and texture held in a resource bag (arrays included). */
export function disposeAll(bag: Record<string, unknown>): void {
  const one = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const x of v) one(x);
      return;
    }
    if (v && typeof (v as { dispose?: unknown }).dispose === "function") {
      (v as { dispose: () => void }).dispose();
    }
  };
  for (const v of Object.values(bag)) one(v);
}

// ---- The meters' bakelite: speckle that reads at phone size, and worn edges ---------------------

// Mostly ivory and grey, a little tan, a rare rust fleck: like the references' cases.
const FLECKS = [
  "#f1e8cf",
  "#f1e8cf",
  "#f1e8cf",
  "#f8f3e6",
  "#e6d7ae",
  "#e6d7ae",
  "#d4c08a",
  "#9a978e",
  "#9a978e",
  "#6f6c66",
  "#d9a05a",
] as const;

/** One tile of speckled bakelite, 0.12 m across: warm and cool mottle, three sizes of fleck, a few scratches. */
function paintMeterBakelite(w: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(w, w);
  const tex = canvasTexture(canvas, 8);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (!ctx) return tex;
  const rnd = seededRandom(913);
  const k = w / 1024; // the sizes below are for a 1024 px tile
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)] as T;
  // Anything drawn near an edge is drawn again on the far side, so the tile repeats without a seam.
  const wrapped = (x: number, y: number, r: number, draw: (x: number, y: number) => void) => {
    draw(x, y);
    const nx = x < r ? w : x > w - r ? -w : 0;
    const ny = y < r ? w : y > w - r ? -w : 0;
    if (nx) draw(x + nx, y);
    if (ny) draw(x, y + ny);
    if (nx && ny) draw(x + nx, y + ny);
  };

  ctx.fillStyle = "#171515";
  ctx.fillRect(0, 0, w, w);
  // Mottle: big soft patches, warm brown and cool grey, so no face is one flat black.
  for (let i = 0; i < 60; i++) {
    const r = (50 + rnd() * 170) * k;
    const warm = rnd() < 0.5;
    const a = (0.04 + rnd() * 0.05) * (warm ? 0.7 : 1);
    wrapped(rnd() * w, rnd() * w, r, (x, y) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, warm ? `rgba(104,66,40,${a})` : `rgba(70,76,88,${a})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }
  // Fine dust.
  for (let i = 0; i < 3800; i++) {
    const r = (0.8 + rnd() * 1.1) * k;
    ctx.globalAlpha = 0.25 + rnd() * 0.5;
    ctx.fillStyle = pick(FLECKS);
    wrapped(rnd() * w, rnd() * w, r, (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // Small flecks.
  for (let i = 0; i < 1000; i++) {
    const r = (1.8 + rnd() * 2.6) * k;
    const sq = 0.55 + rnd() * 0.45;
    const rot = rnd() * Math.PI;
    ctx.globalAlpha = 0.55 + rnd() * 0.4;
    ctx.fillStyle = pick(FLECKS);
    wrapped(rnd() * w, rnd() * w, r * 2, (x, y) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * sq, rot, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // Chips: a few large irregular flecks, some with a dark heart.
  for (let i = 0; i < 70; i++) {
    const r = (3.8 + rnd() * 4.2) * k;
    const sides = 5 + Math.floor(rnd() * 3);
    const rot = rnd() * Math.PI * 2;
    const offsets = Array.from({ length: sides }, () => 0.6 + rnd() * 0.6);
    const colour = pick(FLECKS);
    const dark = rnd() < 0.4;
    const alpha = 0.6 + rnd() * 0.35;
    wrapped(rnd() * w, rnd() * w, r * 1.3, (x, y) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour;
      ctx.beginPath();
      for (let j = 0; j < sides; j++) {
        const a = rot + (j / sides) * Math.PI * 2;
        const rr = r * (offsets[j] ?? 1);
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr * 0.8;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      if (dark) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#2a2018";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  // Scratches: faint light hairlines.
  ctx.lineWidth = Math.max(1, 0.9 * k);
  ctx.strokeStyle = "#cbbd9f";
  for (let i = 0; i < 44; i++) {
    const len = (30 + rnd() * 110) * k;
    const a = rnd() * Math.PI;
    ctx.globalAlpha = 0.09 + rnd() * 0.12;
    wrapped(rnd() * w, rnd() * w, len, (x, y) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
  tex.needsUpdate = true;
  return tex;
}

/**
 * The meters' speckled bakelite, painted once per tier and shared between both meters (release it
 * with disposeKitBag). The tile covers 0.12 m, like the kit's.
 */
export function meterBakeliteTexture(tier: Tier): THREE.CanvasTexture {
  const w = tier === "low" ? 256 : tier === "mid" ? 512 : 1024;
  return acquireTexture(`meter-bakelite:${tier}`, () => paintMeterBakelite(w));
}

/**
 * Brushed brass, one tile 0.1 m across: warm gold between a deeper and a lighter tone, long
 * streaks along u that are wide enough to show at phone size, a soft diagonal sheen, dark
 * tarnish spots and a few scratches.
 */
function paintMeterBrass(w: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(w, w);
  const tex = canvasTexture(canvas, 8);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (!ctx) return tex;
  const rnd = seededRandom(577);
  const k = w / 512;
  const base = ctx.createLinearGradient(0, 0, w, w);
  base.addColorStop(0, "#b2822c");
  base.addColorStop(0.5, "#dcb458");
  base.addColorStop(1, "#b88a35");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, w);
  // Brush streaks: long horizontal lines, light and dark; near the top and bottom edge they are
  // drawn again on the far side, so the tile repeats in v.
  for (let i = 0; i < 300; i++) {
    const y = rnd() * w;
    const thick = (1.4 + rnd() * 2.6) * k;
    ctx.fillStyle = rnd() < 0.5 ? "#fff0c0" : "#5a3a0c";
    ctx.globalAlpha = 0.04 + rnd() * 0.09;
    const x0 = rnd() * w * 0.3;
    const len = w * (0.5 + rnd() * 0.5);
    ctx.fillRect(x0, y, len, thick);
    if (y < thick) ctx.fillRect(x0, y + w, len, thick);
    if (y > w - thick) ctx.fillRect(x0, y - w, len, thick);
  }
  // Tarnish: dark soft spots.
  for (let i = 0; i < 16; i++) {
    const r = (18 + rnd() * 60) * k;
    const x = rnd() * w;
    const y = rnd() * w;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(74,42,8,0.16)");
    g.addColorStop(1, "rgba(74,42,8,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Scratches.
  ctx.strokeStyle = "#fff6d8";
  ctx.lineWidth = Math.max(1, 0.8 * k);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w;
    const y = rnd() * w;
    const a = (rnd() - 0.5) * 0.5;
    const len = (24 + rnd() * 90) * k;
    ctx.globalAlpha = 0.14 + rnd() * 0.16;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  tex.needsUpdate = true;
  return tex;
}

/** The meters' brushed brass (release it with disposeKitBag). The tile covers 0.1 m. */
export function meterBrassTexture(tier: Tier): THREE.CanvasTexture {
  const w = tier === "low" ? 128 : tier === "mid" ? 256 : 512;
  return acquireTexture(`meter-brass:${tier}`, () => paintMeterBrass(w));
}

/** Moves a geometry's uv by (du, dv): the same texture, another part of it. */
export function offsetUV(geo: THREE.BufferGeometry, du: number, dv: number): void {
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
  uv.needsUpdate = true;
}

const WORN: readonly [number, number, number] = [3.4, 2.7, 2.1];

/**
 * Edge wear for a bevelled part. Writes a `color` attribute that is 1 on flat faces and rises to
 * `worn` (a warm, lighter multiplier) where the normal turns away from every axis, which is the
 * middle of each bevel. Use it with `vertexColors: true` on a material whose own colour is white:
 * the part then shows its brown under-layer along its edges, as old bakelite does. Needs normals.
 */
export function applyEdgeWear(geo: THREE.BufferGeometry, worn: readonly number[] = WORN): void {
  const nor = geo.getAttribute("normal");
  const out = new Float32Array(nor.count * 3);
  for (let i = 0; i < nor.count; i++) {
    const m = Math.max(Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i)));
    const t = Math.min(1, Math.max(0, (1 - m - 0.02) / 0.1));
    const wear = t * t * (3 - 2 * t);
    for (let c = 0; c < 3; c++) out[i * 3 + c] = 1 + ((worn[c] ?? 1) - 1) * wear;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(out, 3));
}
