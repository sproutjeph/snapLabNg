import * as THREE from "three";
import { clamp01, fbm, mix, seededRandom, smoothstep } from "./noise";

// The materials kit's seeded Canvas2D textures: mahogany, pine, speckled bakelite, brushed
// brass and a printed paper label. Each is painted once (never per frame), at most 1024 px, and
// the caller disposes it. `tier` low halves the size. Grain runs along u.

export type Tier = "low" | "mid" | "high";

/** The ink colour on paper and labels, shared with the look. */
export const INK_BLUE = "#1d2430";

type Rgb = readonly [number, number, number];

function hexRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, repeat: boolean, anisotropy = 8): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

/** Fills a canvas pixel by pixel from `fn(u, v)` returning rgb 0..255. */
function paintField(w: number, h: number, fn: (u: number, v: number) => Rgb): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x / w, y / h);
      const i = (y * w + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const px = (tier: Tier, full: number) => (tier === "low" ? full / 2 : full);

/**
 * Mahogany: deep red-brown with long dark grain streaks and fine pores. Tiles about 0.3 m
 * across (u) by 0.15 m (v) when the geometry's uv is in tile units.
 */
export function mahoganyTexture(seed: number, tier: Tier = "high"): THREE.CanvasTexture {
  const w = px(tier, 512);
  const h = px(tier, 256);
  const light = hexRgb("#8a4a2c");
  const dark = hexRgb("#4a1e12");
  const c = paintField(w, h, (u, v) => {
    const warp = fbm(seed, u * 2.2, v * 3, 3) * 5;
    const rings = Math.abs(Math.sin((v * 26 + warp) * Math.PI));
    const streak = fbm(seed + 7, u * 6, v * 70, 3);
    const pores = fbm(seed + 13, u * 140, v * 16, 2);
    let t = 0.35 + 0.35 * (1 - rings) + 0.35 * (streak - 0.5);
    t -= 0.22 * smoothstep(0.62, 0.8, pores);
    t = clamp01(t);
    return [mix(dark[0], light[0], t), mix(dark[1], light[1], t), mix(dark[2], light[2], t)];
  });
  return toTexture(c, true);
}

/** Pine: pale honey wood with flowing grain lines and a knot or two. About 0.55 m by 0.14 m a tile. */
export function pineTexture(seed: number, tier: Tier = "high"): THREE.CanvasTexture {
  const w = px(tier, 1024);
  const h = px(tier, 256);
  const light = hexRgb("#e4c08a");
  const dark = hexRgb("#b8864c");
  const rnd = seededRandom(seed);
  const knots = [0, 1].map(() => ({
    x: 0.1 + rnd() * 0.8,
    y: 0.25 + rnd() * 0.5,
    r: 0.03 + rnd() * 0.02,
  }));
  const c = paintField(w, h, (u, v) => {
    let warp = fbm(seed, u * 1.4, v * 2.5, 3) * 6;
    for (const k of knots) {
      const dx = (u - k.x) * 4;
      const dy = v - k.y;
      const d = Math.hypot(dx, dy);
      warp += 3 * Math.exp(-(d * d) / (k.r * k.r * 6)) * Math.sign(dy || 1);
    }
    const rings = Math.abs(Math.sin((v * 16 + warp) * Math.PI));
    const fine = fbm(seed + 5, u * 8, v * 90, 2);
    let t = 0.55 - 0.3 * rings ** 3 + 0.25 * (fine - 0.5);
    for (const k of knots) {
      const d = Math.hypot((u - k.x) * 4, v - k.y);
      t -= 0.5 * smoothstep(k.r * 1.2, k.r * 0.2, d);
    }
    t = clamp01(t);
    return [mix(dark[0], light[0], t), mix(dark[1], light[1], t), mix(dark[2], light[2], t)];
  });
  return toTexture(c, true);
}

/**
 * Speckled bakelite: near-black with flecks of cream, orange and grey, like the targets'
 * meter cases. Tiles about 0.12 m square.
 */
export function bakeliteTexture(seed: number, tier: Tier = "high"): THREE.CanvasTexture {
  const w = px(tier, 512);
  const [c, ctx] = makeCanvas(w, w);
  ctx.fillStyle = "#1b1918";
  ctx.fillRect(0, 0, w, w);
  const mottle = ctx.getImageData(0, 0, w, w);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const n = (fbm(seed, (x / w) * 6, (y / w) * 6, 3) - 0.5) * 16;
      const i = (y * w + x) * 4;
      mottle.data[i] = clamp01((27 + n) / 255) * 255;
      mottle.data[i + 1] = clamp01((25 + n) / 255) * 255;
      mottle.data[i + 2] = clamp01((24 + n) / 255) * 255;
    }
  }
  ctx.putImageData(mottle, 0, 0);
  const rnd = seededRandom(seed + 3);
  const flecks = tier === "low" ? 260 : 900;
  const colours = ["#e8dcc0", "#d49a54", "#8c8478", "#f2ead6", "#b9794a"];
  for (let i = 0; i < flecks; i++) {
    const r = (0.5 + rnd() * 1.6) * (w / 512);
    ctx.globalAlpha = 0.45 + rnd() * 0.5;
    ctx.fillStyle = colours[Math.floor(rnd() * colours.length)] ?? "#e8dcc0";
    ctx.beginPath();
    ctx.ellipse(rnd() * w, rnd() * w, r * (1 + rnd()), r, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return toTexture(c, true);
}

/** Brushed brass: warm gold with fine streaks along u and a soft tarnish. Tiles 0.2 m square. */
export function brushedBrassTexture(seed: number, tier: Tier = "high"): THREE.CanvasTexture {
  const w = px(tier, 512);
  const light = hexRgb("#e2c46c");
  const dark = hexRgb("#a98532");
  const c = paintField(w, w, (u, v) => {
    const streak = fbm(seed, u * 3, v * 220, 2);
    const tarnish = fbm(seed + 9, u * 3, v * 3, 3);
    const t = clamp01(0.62 + 0.22 * (streak - 0.5) - 0.16 * (tarnish - 0.5));
    return [mix(dark[0], light[0], t), mix(dark[1], light[1], t), mix(dark[2], light[2], t)];
  });
  return toTexture(c, true);
}

export interface LabelOptions {
  /** Lines of text, drawn in the blue-black ink. */
  lines: readonly string[];
  width: number;
  height: number;
  /** Texture width in px. */
  px?: number;
  font?: string;
  /** Spaced characters, like a printed strip of coil values. */
  seed?: number;
}

/** A cream paper label with fibre, a darker edge and ink lettering (used on the box and key). */
export function labelTexture(opts: LabelOptions): THREE.CanvasTexture {
  const w = Math.min(1024, opts.px ?? 512);
  const h = Math.max(16, Math.round((w * opts.height) / opts.width));
  const seed = opts.seed ?? 5;
  const [c, ctx] = makeCanvas(w, h);
  const paper = hexRgb("#f3e9cf");
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const fibre = fbm(seed, u * 60, v * 14, 2) - 0.5;
      const edge = Math.min(u, 1 - u, v * (w / h), (1 - v) * (w / h)) * 14;
      const shade = 1 - 0.1 * (1 - clamp01(edge));
      const i = (y * w + x) * 4;
      img.data[i] = clamp01((paper[0] / 255) * shade + fibre * 0.08) * 255;
      img.data[i + 1] = clamp01((paper[1] / 255) * shade + fibre * 0.08) * 255;
      img.data[i + 2] = clamp01((paper[2] / 255) * shade + fibre * 0.09) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = INK_BLUE;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const n = opts.lines.length;
  const size = Math.round((h / n) * 0.62);
  ctx.font = opts.font ?? `bold ${size}px Georgia, "Times New Roman", serif`;
  opts.lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, ((i + 0.5) / n) * h + size * 0.04, w * 0.94);
  });
  return toTexture(c, false, 4);
}
