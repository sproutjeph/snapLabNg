import * as THREE from "three";
import { acquireTexture } from "./cache";
import { clamp01, fbm, hash2, mix, seededRandom } from "./noise";
import type { Tier } from "./textures";

// The bench parts' own textures, painted bolder than the kit's four (docs/plans/asset-pass.md,
// "Backcountry side by side"): mahogany with dark, high-contrast grain, brushed brass with
// streaks and a drift of tone, and speckled black ebonite. Each is painted once (never per frame)
// with Canvas2D from a seeded source, at most 1024 px, comes through the kit's cache (so the box,
// key and cells share one) and is released by disposeKitBag. `tier` low quarters the size.

export type BenchKind = "mahogany" | "brass" | "ebonite";

/** One seed per kind, apart from the kit's (11–14). */
export const BENCH_SEEDS: Readonly<Record<BenchKind, number>> = {
  mahogany: 31,
  brass: 32,
  ebonite: 33,
};

/** How many metres one tile covers, across and down (u, v), for boxProjectUV and the lathes. */
export const BENCH_TILE_M: Readonly<Record<BenchKind, readonly [number, number]>> = {
  mahogany: [0.3, 0.15],
  brass: [0.12, 0.12],
  ebonite: [0.02, 0.02],
};

const size = (tier: Tier, full: number) =>
  Math.max(64, tier === "low" ? full / 4 : tier === "mid" ? full / 2 : full);

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, anisotropy = 8): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ---- Noise that tiles ------------------------------------------------------------------------

const smooth = (t: number) => t * t * (3 - 2 * t);
const wrap = (i: number, n: number) => ((i % n) + n) % n;

/**
 * Value noise (0..1) that repeats every `periodX` lattice cells in x and `periodY` in y (the
 * same by default), so a texture made from it has no seam where its tiles meet.
 */
export function tileNoise(
  seed: number,
  x: number,
  y: number,
  periodX: number,
  periodY = periodX,
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const x0 = wrap(ix, periodX);
  const x1 = wrap(ix + 1, periodX);
  const y0 = wrap(iy, periodY);
  const y1 = wrap(iy + 1, periodY);
  const a = hash2(seed, x0, y0);
  const b = hash2(seed, x1, y0);
  const c = hash2(seed, x0, y1);
  const d = hash2(seed, x1, y1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Fractal tile noise (0..1) for u, v in [0, 1): `cells` lattice cells across the tile in u (and
 * `cellsV`, by default the same, down it in v) at the first octave, each further octave twice
 * as fine and half as strong. Tiles in u and v; more `cellsV` than `cells` stretches it along u.
 */
export function tileFbm(
  seed: number,
  u: number,
  v: number,
  cells: number,
  octaves = 3,
  cellsV = cells,
): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let perU = cells;
  let perV = cellsV;
  for (let i = 0; i < octaves; i++) {
    sum += amp * tileNoise(seed + i * 101, u * perU, v * perV, perU, perV);
    norm += amp;
    amp *= 0.5;
    perU *= 2;
    perV *= 2;
  }
  return sum / norm;
}

type Rgb = readonly [number, number, number];

function hexRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A colour ramp through three stops at t = 0, 0.5 and 1. */
function ramp3(a: Rgb, b: Rgb, c: Rgb, t: number): Rgb {
  const u = clamp01(t);
  return u < 0.5
    ? [mix(a[0], b[0], u * 2), mix(a[1], b[1], u * 2), mix(a[2], b[2], u * 2)]
    : [mix(b[0], c[0], u * 2 - 1), mix(b[1], c[1], u * 2 - 1), mix(b[2], c[2], u * 2 - 1)];
}

/** Paints a small field from `fn(u, v)` and stretches it over the whole canvas, smoothly. */
function paintSmall(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fw: number,
  fh: number,
  fn: (u: number, v: number) => Rgb,
): void {
  const [fc, fctx] = makeCanvas(fw, fh);
  const img = fctx.createImageData(fw, fh);
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const [r, g, b] = fn((x + 0.5) / fw, (y + 0.5) / fh);
      const i = (y * fw + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  fctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fc, 0, 0, w, h);
}

// ---- Mahogany --------------------------------------------------------------------------------

const MAHOGANY_DEEP = hexRgb("#4e170c");
const MAHOGANY_MID = hexRgb("#8c3a23");
const MAHOGANY_GLOW = hexRgb("#b6603a");

/**
 * Mahogany with the dark, hand-inked grain of the golden frame: a red-brown field that drifts
 * from deep to glowing, long wavy dark streaks, a few bold ones, some lighter, and dashes of
 * pore. The grain runs along u. It tiles without a seam (every stroke is drawn with its wrapped
 * copies), and one tile covers 0.3 m across by 0.15 m down.
 */
export function mahoganyBoldTexture(seed: number, tier: Tier): THREE.CanvasTexture {
  const w = size(tier, 1024);
  const h = size(tier, 512);
  const k = w / 1024;
  const [c, ctx] = makeCanvas(w, h);
  const rnd = seededRandom(seed);
  paintSmall(ctx, w, h, 128, 64, (u, v) => {
    const n = tileFbm(seed, u, v, 3, 3, 9);
    const bands = 0.5 + 0.5 * Math.sin((v + (n - 0.5) * 0.35) * Math.PI * 2 * 7);
    return ramp3(
      MAHOGANY_DEEP,
      MAHOGANY_MID,
      MAHOGANY_GLOW,
      0.18 + 1.05 * (n - 0.32) + 0.3 * (bands - 0.5),
    );
  });
  ctx.lineCap = "round";
  const lines = tier === "low" ? 80 : 220;
  for (let i = 0; i < lines; i++) {
    // Mostly dark grain, every so often a bold one, and some light streaks between.
    const kind = i % 17 === 0 ? 2 : rnd() < 0.72 ? 0 : 1;
    const alpha =
      kind === 1 ? 0.1 + rnd() * 0.18 : kind === 2 ? 0.4 + rnd() * 0.2 : 0.2 + rnd() * 0.4;
    ctx.strokeStyle = kind === 1 ? `rgba(214, 120, 78, ${alpha})` : `rgba(24, 6, 3, ${alpha})`;
    ctx.lineWidth =
      (kind === 2 ? 3.6 + rnd() * 2.4 : kind === 1 ? 1.6 + rnd() * 3.4 : 1.1 + rnd() * 3) * k;
    const y0 = rnd() * h;
    const x0 = rnd() * w;
    const len = w * (0.3 + rnd() * 0.7);
    const amp = (4 + rnd() * 16) * k;
    const freq = (0.003 + rnd() * 0.009) / k;
    const phase = rnd() * 6.28;
    const seedLine = seed + 9 + i;
    const step = Math.max(8, 18 * k);
    // Drawn where it falls and one tile either way across and down, so it wraps round.
    for (const dx of [-w, 0, w]) {
      for (const dy of [-h, 0, h]) {
        if (x0 + dx > w + 8 || x0 + dx + len < -8 || y0 + dy < -40 || y0 + dy > h + 40) continue;
        ctx.beginPath();
        for (let s = 0; s <= len; s += step) {
          const x = x0 + s;
          const drift = (fbm(seedLine, x / (140 * k), i * 0.37, 2) - 0.5) * 26 * k;
          const y = y0 + Math.sin(x * freq + phase) * amp + drift;
          if (s === 0) ctx.moveTo(x + dx, y + dy);
          else ctx.lineTo(x + dx, y + dy);
        }
        ctx.stroke();
      }
    }
  }
  // Pores: short dark dashes along the grain.
  const pores = tier === "low" ? 250 : 900;
  for (let i = 0; i < pores; i++) {
    ctx.fillStyle = `rgba(18, 5, 2, ${0.3 + rnd() * 0.4})`;
    const x = rnd() * w;
    const y = rnd() * h;
    const pw = (3 + rnd() * 7) * k;
    const ph = Math.max(0.8, (0.8 + rnd() * 0.7) * k);
    for (const dx of [-w, 0, w]) {
      if (x + dx > w || x + dx + pw < 0) continue;
      ctx.fillRect(x + dx, y, pw, ph);
    }
  }
  return toTexture(c);
}

// ---- Brass -----------------------------------------------------------------------------------

const BRASS_DARK = hexRgb("#8e6a22");
const BRASS_MID = hexRgb("#bd8f30");
const BRASS_LIGHT = hexRgb("#e6c060");

/**
 * Brushed brass that tiles: a gold field that drifts from warm to bright, fine streaks along u
 * (light and dark, a hair wavy), and a sprinkle of pits. One tile covers 0.12 m square and
 * repeats without a seam.
 */
export function brassBoldTexture(seed: number, tier: Tier): THREE.CanvasTexture {
  const n = size(tier, 1024);
  const k = n / 1024;
  const [c, ctx] = makeCanvas(n, n);
  const rnd = seededRandom(seed);
  paintSmall(ctx, n, n, 64, 64, (u, v) => {
    const t = tileFbm(seed, u, v, 3, 3);
    const t2 = tileFbm(seed + 17, u, v, 6, 2);
    return ramp3(BRASS_DARK, BRASS_MID, BRASS_LIGHT, 0.45 + 1.15 * (t - 0.45) + 0.5 * (t2 - 0.5));
  });
  const streaks = tier === "low" ? 500 : 1700;
  for (let i = 0; i < streaks; i++) {
    const light = rnd() < 0.55;
    const alpha = light ? 0.04 + rnd() * 0.16 : 0.04 + rnd() * 0.12;
    ctx.strokeStyle = light ? `rgba(255, 244, 190, ${alpha})` : `rgba(110, 74, 16, ${alpha})`;
    ctx.lineWidth = Math.max(0.5, (0.4 + rnd() * 0.9) * k);
    const y0 = rnd() * n;
    const amp = (0.3 + rnd() * 1.5) * k;
    const periods = 1 + Math.floor(rnd() * 3);
    const phase = rnd() * 6.28;
    // Drawn three times (one tile up, in place, one tile down) so a streak near an edge wraps.
    for (const dy of [-n, 0, n]) {
      if (y0 + dy < -4 || y0 + dy > n + 4) continue;
      ctx.beginPath();
      const step = Math.max(16, 32 * k);
      for (let x = 0; x <= n + 0.5; x += step) {
        const y = y0 + dy + Math.sin((x / n) * Math.PI * 2 * periods + phase) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  const pits = tier === "low" ? 40 : 140;
  for (let i = 0; i < pits; i++) {
    ctx.fillStyle = `rgba(70, 44, 8, ${0.25 + rnd() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(
      rnd() * n,
      rnd() * n,
      (0.5 + rnd() * 1.1) * k,
      (0.4 + rnd() * 0.8) * k,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  return toTexture(c);
}

// ---- Ebonite ---------------------------------------------------------------------------------

const SPECKS = ["#efe6cf", "#efe6cf", "#efe6cf", "#d9a05a", "#a8a095", "#a8a095", "#fbf6ea"];

/**
 * Speckled black ebonite that tiles: a warm charcoal with a faint mottle, and about a hundred
 * flecks of cream, orange and grey a third of a millimetre across or so, as on the golden
 * frame's knobs. One tile covers 2 cm square (a plug's knob shows it three times round).
 */
export function eboniteTexture(seed: number, tier: Tier): THREE.CanvasTexture {
  const n = size(tier, 256);
  const k = n / 256;
  const [c, ctx] = makeCanvas(n, n);
  const rnd = seededRandom(seed);
  paintSmall(ctx, n, n, 32, 32, (u, v) => {
    const t = tileFbm(seed, u, v, 4, 3);
    const base: Rgb = [40, 37, 36];
    const d = (t - 0.5) * 22;
    return [base[0] + d, base[1] + d * 0.9, base[2] + d * 0.8];
  });
  const flecks = tier === "low" ? 80 : 230;
  for (let i = 0; i < flecks; i++) {
    const big = i % 5 === 0;
    const r = (big ? 2.6 + rnd() * 1.6 : 1.1 + rnd() * 1.5) * k;
    const x = rnd() * n;
    const y = rnd() * n;
    const stretch = 1 + rnd() * 0.7;
    const angle = rnd() * 3.14;
    ctx.globalAlpha = 0.55 + rnd() * 0.45;
    ctx.fillStyle = SPECKS[Math.floor(rnd() * SPECKS.length)] ?? SPECKS[0] ?? "#efe6cf";
    // Drawn nine times so a fleck on an edge wraps round.
    for (const dx of [-n, 0, n]) {
      for (const dy of [-n, 0, n]) {
        if (x + dx < -r * 2 || x + dx > n + r * 2 || y + dy < -r * 2 || y + dy > n + r * 2)
          continue;
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r * stretch, r, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

// ---- Printed paper tags ----------------------------------------------------------------------

const PAPER_TOP = "#fdf6e3";
const PAPER_BOTTOM = "#f6ecd0";
const TAG_INK = "#1d2430";
const TAG_FONT = "Arial, Helvetica, sans-serif";

export interface TagOptions {
  /** What is printed: a letter or a sign (K, +, the minus sign). */
  text: string;
  /** The tag's size in metres; only its shape decides the texture's. */
  width: number;
  height: number;
  /** Seeds the paper fibre. */
  seed?: number;
  /** The character's height as a fraction of the tag's (default 0.66). */
  glyph?: number;
}

/**
 * A small cream paper tag with a ruled edge and one bold ink character, as stuck on the key and
 * on the cell holder's end blocks. Prints only what the real tag shows.
 */
export function tagTexture(o: TagOptions, tier: Tier): THREE.CanvasTexture {
  const w = size(tier, 384);
  const h = Math.max(16, Math.round((w * o.height) / o.width));
  const [c, ctx] = makeCanvas(w, h);
  const rnd = seededRandom(o.seed ?? 3);
  const paper = ctx.createLinearGradient(0, 0, 0, h);
  paper.addColorStop(0, PAPER_TOP);
  paper.addColorStop(1, PAPER_BOTTOM);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(120, 90, 40, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6 + rnd() * 14, y + (rnd() - 0.5) * 2);
    ctx.stroke();
  }
  const pxPerM = w / o.width;
  const edge = Math.max(2, 0.0005 * pxPerM);
  ctx.strokeStyle = TAG_INK;
  ctx.lineWidth = edge;
  ctx.strokeRect(edge * 1.6, edge * 1.6, w - edge * 3.2, h - edge * 3.2);
  ctx.fillStyle = TAG_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(h * (o.glyph ?? 0.66))}px ${TAG_FONT}`;
  ctx.fillText(o.text, w / 2, h * 0.54);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** A tag from the cache: one painting per (text, shape, tier), freed by disposeKitBag. */
export function benchTag(o: TagOptions, tier: Tier): THREE.CanvasTexture {
  const key = `bench-tag:${o.text}:${o.width}x${o.height}:${o.seed ?? 3}:${o.glyph ?? 0.66}:${tier}`;
  return acquireTexture(key, () => tagTexture(o, tier));
}

// ---- Through the cache -----------------------------------------------------------------------

const PAINTERS: Record<BenchKind, (seed: number, tier: Tier) => THREE.CanvasTexture> = {
  mahogany: mahoganyBoldTexture,
  brass: brassBoldTexture,
  ebonite: eboniteTexture,
};

/**
 * The shared bold mahogany, brass or ebonite texture for a tier. Each call is matched by one
 * release, which disposeKitBag does for a part's resource bag.
 */
export function benchTexture(kind: BenchKind, tier: Tier): THREE.CanvasTexture {
  const seed = BENCH_SEEDS[kind];
  return acquireTexture(`bench-${kind}:${seed}:${tier}`, () => PAINTERS[kind](seed, tier));
}
