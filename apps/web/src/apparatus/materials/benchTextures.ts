import * as THREE from "three";
import { acquireTexture } from "./cache";
import { clamp01, fbm, hash2, mix, seededRandom } from "./noise";
import type { Tier } from "./textures";

// The bench parts' own textures, painted bolder than the kit's four (docs/plans/asset-pass.md,
// "Backcountry side by side"): mahogany with dark, high-contrast grain, brushed brass with
// streaks and a drift of tone, and speckled black ebonite. Each is painted once (never per frame)
// with Canvas2D from a seeded source, at most 1024 px, comes through the kit's cache (so the box,
// key and cells share one) and is released by disposeKitBag. `tier` low quarters the size.

export type BenchKind = "mahogany" | "brass" | "ebonite" | "pine";

/** One seed per kind, apart from the kit's (11–14). */
export const BENCH_SEEDS: Readonly<Record<BenchKind, number>> = {
  mahogany: 31,
  brass: 32,
  ebonite: 33,
  pine: 34,
};

/** How many metres one tile covers, across and down (u, v), for boxProjectUV and the lathes. */
export const BENCH_TILE_M: Readonly<Record<BenchKind, readonly [number, number]>> = {
  mahogany: [0.3, 0.15],
  brass: [0.12, 0.12],
  ebonite: [0.02, 0.02],
  pine: [0.2, 0.1],
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

// ---- Pine ------------------------------------------------------------------------------------

const PINE_LIGHT = hexRgb("#edd29b");
const PINE_MID = hexRgb("#d9b06e");
const PINE_DEEP = hexRgb("#b9843f");

/**
 * Pale pine with bold, hand-painted grain, for the cell holder's lining: a honey field that
 * drifts from cream to amber in long soft bands, three weights of dark amber grain stroke (a few
 * heavy, so the grain still reads on a strip a centimetre wide), creamy light streaks between
 * them, a knot, and dashes of pore. The grain runs along u. It tiles without a seam, and one
 * tile covers 0.2 m across by 0.1 m down (5 px a millimetre).
 */
export function pineBoldTexture(seed: number, tier: Tier): THREE.CanvasTexture {
  const w = size(tier, 1024);
  const h = size(tier, 512);
  const k = w / 1024;
  const [c, ctx] = makeCanvas(w, h);
  const rnd = seededRandom(seed);
  paintSmall(ctx, w, h, 128, 64, (u, v) => {
    const n = tileFbm(seed, u, v, 3, 3, 8);
    const bands = 0.5 + 0.5 * Math.sin((v + (n - 0.5) * 0.32) * Math.PI * 2 * 9);
    return ramp3(PINE_DEEP, PINE_MID, PINE_LIGHT, 0.5 + 1.2 * (n - 0.45) + 0.5 * (bands - 0.5));
  });
  ctx.lineCap = "round";
  // Every stroke follows one slow flow (periodic, so it tiles), so neighbours run together the
  // way grain does, and each adds a small wobble of its own.
  const flow = (x: number, y: number) =>
    (tileFbm(seed + 5, (((x % w) + w) % w) / w, (((y % h) + h) % h) / h, 2, 2, 3) - 0.5) * 52 * k;
  // `count` strokes of `width` px (min, max) at `alpha` (min, max): `colour` makes each one's
  // fill from its alpha.
  const strokes = (
    count: number,
    width: readonly [number, number],
    alpha: readonly [number, number],
    lengthMin: number,
    colour: (a: number) => string,
  ) => {
    for (let i = 0; i < count; i++) {
      const a = alpha[0] + rnd() * (alpha[1] - alpha[0]);
      ctx.strokeStyle = colour(a);
      ctx.lineWidth = (width[0] + rnd() * (width[1] - width[0])) * k;
      const y0 = rnd() * h;
      const x0 = rnd() * w;
      const len = w * (lengthMin + rnd() * (1 - lengthMin));
      const amp = (1 + rnd() * 4) * k;
      const freq = (0.004 + rnd() * 0.006) / k;
      const phase = rnd() * 6.28;
      const step = Math.max(8, 16 * k);
      // Drawn where it falls and one tile either way across and down, so it wraps round.
      for (const dx of [-w, 0, w]) {
        for (const dy of [-h, 0, h]) {
          if (x0 + dx > w + 8 || x0 + dx + len < -8 || y0 + dy < -60 || y0 + dy > h + 60) continue;
          ctx.beginPath();
          for (let s = 0; s <= len; s += step) {
            const x = x0 + s;
            const y = y0 + flow(x, y0) + Math.sin(x * freq + phase) * amp;
            if (s === 0) ctx.moveTo(x + dx, y + dy);
            else ctx.lineTo(x + dx, y + dy);
          }
          ctx.stroke();
        }
      }
    }
  };
  const few = tier === "low" ? 0.5 : 1;
  // Wide, faint washes first, then the cream and the resin-orange streaks, then the grain over
  // them in three weights: fine, medium and a few heavy.
  strokes(Math.round(28 * few), [18, 40], [0.12, 0.24], 0.45, (a) => `rgba(140, 84, 30, ${a})`);
  strokes(Math.round(30 * few), [3, 8], [0.2, 0.4], 0.4, (a) => `rgba(255, 246, 214, ${a})`);
  strokes(Math.round(16 * few), [4, 9], [0.25, 0.45], 0.4, (a) => `rgba(178, 92, 30, ${a})`);
  strokes(Math.round(80 * few), [1.2, 2.6], [0.28, 0.5], 0.5, (a) => `rgba(100, 56, 18, ${a})`);
  strokes(Math.round(40 * few), [3.5, 7], [0.5, 0.75], 0.45, (a) => `rgba(94, 50, 12, ${a})`);
  strokes(Math.round(17 * few), [8, 14], [0.7, 0.9], 0.4, (a) => `rgba(70, 36, 8, ${a})`);
  // A knot (its place has a random source of its own): dark rings round a darker eye.
  const place = seededRandom(seed + 3);
  const knotX = (0.22 + place() * 0.5) * w;
  const knotY = (0.3 + place() * 0.4) * h;
  for (let ring = 4; ring >= 0; ring--) {
    ctx.strokeStyle = `rgba(92, 50, 14, ${0.4 + (4 - ring) * 0.08})`;
    ctx.fillStyle = "rgba(74, 38, 8, 0.88)";
    ctx.lineWidth = (3 + (4 - ring) * 0.3) * k;
    ctx.beginPath();
    ctx.ellipse(knotX, knotY, (10 + ring * 11) * k, (6 + ring * 5.4) * k, 0, 0, Math.PI * 2);
    if (ring === 0) ctx.fill();
    ctx.stroke();
  }
  // Pores: short dark dashes along the grain.
  const pores = tier === "low" ? 140 : 460;
  for (let i = 0; i < pores; i++) {
    ctx.fillStyle = `rgba(88, 48, 12, ${0.3 + rnd() * 0.4})`;
    const x = rnd() * w;
    const y = rnd() * h;
    const pw = (4 + rnd() * 9) * k;
    const ph = Math.max(0.8, (1.1 + rnd() * 1.1) * k);
    for (const dx of [-w, 0, w]) {
      if (x + dx > w || x + dx + pw < 0) continue;
      ctx.fillRect(x + dx, y, pw, ph);
    }
  }
  return toTexture(c);
}

// ---- The dry cell's wrapper ------------------------------------------------------------------

/** The cell wrapper's own seed, apart from every kit and bench seed (11–14, 31–34). */
export const CELL_WRAPPER_SEED = 35;
/** All a real dry cell prints on its wrapper: the voltage on its label. Nothing is computed. */
export const CELL_WRAPPER_TEXT = "1.5 V";
/** Where the paper band lies along the can, as fractions of its length (the black shows beyond). */
export const CELL_BAND: readonly [number, number] = [0.33, 0.67];

const CAN_DEEP = hexRgb("#1d1b1a");
const CAN_MID = hexRgb("#38342f");
const CAN_LIGHT = hexRgb("#5d564e");
const FLECKS = ["#efe6cf", "#efe6cf", "#d9a05a", "#b7ad9f", "#b7ad9f", "#fbf6ea"];
const TAU = Math.PI * 2;

/**
 * The wrapper of a cylindrical dry cell, painted to wrap once round it: u runs round the can
 * (1024 px, 94 mm, about 11 px a millimetre) and v along it (512 px, 43 mm). A pitted black body
 * with bold flecks of cream, orange and grey, and a cream paper band round the middle with a
 * hand-cut edge, ruled in ink and lettered "1.5 V" in a ruled box (the letters run along the
 * can). Every mark wraps at the seam. `tier` shrinks it (768 px mid, 512 px low), the marks
 * keeping their size in millimetres.
 */
export function cellWrapperTexture(seed: number, tier: Tier): THREE.CanvasTexture {
  const w = tier === "low" ? 512 : tier === "mid" ? 768 : 1024;
  const h = w / 2;
  const k = w / 1024;
  const [c, ctx] = makeCanvas(w, h);
  const rnd = seededRandom(seed);
  const top = CELL_BAND[0] * h;
  const bottom = CELL_BAND[1] * h;
  // The body: a charcoal field that drifts from deep to warm grey, and wraps in u.
  paintSmall(ctx, w, h, 128, 64, (u, v) => {
    const t = tileFbm(seed, u, v, 5, 3, 4);
    const t2 = tileFbm(seed + 7, u, v, 12, 2, 7);
    return ramp3(CAN_DEEP, CAN_MID, CAN_LIGHT, 0.34 + 1.0 * (t - 0.45) + 0.55 * (t2 - 0.5));
  });
  // Where a mark may fall: the black body, either side of the band, a little under the edge.
  const bodyY = () =>
    rnd() < 0.5 ? rnd() * (top + 6 * k) : bottom - 6 * k + rnd() * (h - bottom + 6 * k);
  // Bold pits: near-black, some large, each with a pale lip on its lower right, as on lava rock.
  const pits = tier === "low" ? 290 : 930;
  for (let i = 0; i < pits; i++) {
    const big = rnd() < 0.2;
    const r = (big ? 6 + rnd() * 6.5 : 2.4 + rnd() * 4) * k;
    const x = rnd() * w;
    const y = bodyY();
    const stretch = 1 + rnd() * 0.7;
    const angle = rnd() * Math.PI;
    const lip = 0.34 + rnd() * 0.3;
    const dark = 0.82 + rnd() * 0.18;
    for (const dx of [-w, 0, w]) {
      if (x + dx < -r * 2 || x + dx > w + r * 2) continue;
      ctx.fillStyle = `rgba(190, 180, 162, ${lip})`;
      ctx.beginPath();
      ctx.ellipse(x + dx + r * 0.22, y + r * 0.3, r * stretch, r, angle, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(8, 7, 6, ${dark})`;
      ctx.beginPath();
      ctx.ellipse(x + dx, y, r * stretch, r, angle, 0, TAU);
      ctx.fill();
    }
  }
  // Bold flecks: cream, orange and grey, the bakelite look of the meter cases.
  const flecks = tier === "low" ? 180 : 640;
  for (let i = 0; i < flecks; i++) {
    const big = i % 6 === 0;
    const r = (big ? 3.2 + rnd() * 2.6 : 1.5 + rnd() * 2) * k;
    const x = rnd() * w;
    const y = bodyY();
    const stretch = 1 + rnd() * 0.8;
    const angle = rnd() * Math.PI;
    const alpha = 0.6 + rnd() * 0.4;
    const colour = FLECKS[Math.floor(rnd() * FLECKS.length)] ?? "#efe6cf";
    for (const dx of [-w, 0, w]) {
      if (x + dx < -r * 2 || x + dx > w + r * 2) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.ellipse(x + dx, y, r * stretch, r, angle, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // The paper band, its edges cut by hand: a slow wobble that closes at the seam.
  const p1 = rnd() * TAU;
  const p2 = rnd() * TAU;
  const p3 = rnd() * TAU;
  const q1 = rnd() * TAU;
  const q2 = rnd() * TAU;
  const wob = (x: number, a: number, b: number, c3: number) =>
    (Math.sin((x / w) * TAU * 3 + a) * 2.4 +
      Math.sin((x / w) * TAU * 8 + b) * 1.2 +
      Math.sin((x / w) * TAU * 21 + c3) * 0.6) *
    k;
  const step = Math.max(3, 4 * k);
  const edge = (base: number, a: number, b: number, c3: number) => {
    ctx.beginPath();
    for (let x = 0; x <= w + 0.5; x += step) {
      const y = base + wob(x, a, b, c3);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  edge(top, p1, p2, p3);
  for (let x = w; x >= -0.5; x -= step) ctx.lineTo(x, bottom + wob(x, q1, q2, p3));
  ctx.closePath();
  const paper = ctx.createLinearGradient(0, top, 0, bottom);
  paper.addColorStop(0, "#fcf5df");
  paper.addColorStop(0.5, "#f7edd0");
  paper.addColorStop(1, "#efe2bf");
  ctx.fillStyle = paper;
  ctx.fill();
  // Stains and fibre on the paper.
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    const x = rnd() * w;
    const y = top + rnd() * (bottom - top);
    const r = (24 + rnd() * 46) * k;
    for (const dx of [-w, 0, w]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      g.addColorStop(0, "rgba(170, 120, 52, 0.12)");
      g.addColorStop(1, "rgba(170, 120, 52, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  }
  ctx.strokeStyle = "rgba(120, 90, 40, 0.1)";
  ctx.lineWidth = Math.max(1, k);
  for (let i = 0; i < 180; i++) {
    const x = rnd() * w;
    const y = top + rnd() * (bottom - top);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (12 + rnd() * 30) * k, y + (rnd() - 0.5) * 3 * k);
    ctx.stroke();
  }
  ctx.restore();
  // The printed rules along both edges, a hair inside them.
  ctx.strokeStyle = TAG_INK;
  ctx.lineWidth = 3.6 * k;
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (let x = 0; x <= w + 0.5; x += step) {
    const y = top + 7 * k + wob(x, p1, p2, p3);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let x = 0; x <= w + 0.5; x += step) {
    const y = bottom - 7 * k + wob(x, q1, q2, p3);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // The label, on the face that turns toward the student (u = 0.5): the voltage in a ruled box,
  // in tall, narrowed capitals so that it reads on a band this narrow.
  ctx.save();
  ctx.translate(w / 2, (top + bottom) / 2);
  ctx.rotate(Math.PI / 2);
  ctx.strokeStyle = TAG_INK;
  ctx.lineWidth = 3.4 * k;
  ctx.strokeRect(-66 * k, -35 * k, 132 * k, 70 * k);
  ctx.fillStyle = TAG_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(62 * k)}px ${TAG_FONT}`;
  ctx.scale(0.72, 1);
  // The space is an en space, so the narrowed letters keep a clear gap before the V.
  ctx.fillText(CELL_WRAPPER_TEXT.replace(" ", "\u2002"), 0, 3 * k);
  ctx.restore();
  return toTexture(c);
}

/** The cell wrapper from the cache: one painting per tier, freed by disposeKitBag. */
export function benchCellWrapper(tier: Tier): THREE.CanvasTexture {
  return acquireTexture(`bench-cell-wrapper:${CELL_WRAPPER_SEED}:${tier}`, () =>
    cellWrapperTexture(CELL_WRAPPER_SEED, tier),
  );
}

// ---- The dry cell's silver ends --------------------------------------------------------------

/** The silver end's own seed, apart from every other (11–14, 31–35). */
export const CELL_STEEL_SEED = 36;

/**
 * The silver collars at a dry cell's ends, as two squares side by side: on the left (u 0 to a
 * half) the flat end, painted inside its inscribed circle (a bright, hand-inked disc with a raised
 * rim, a recessed middle, brushed rings, scratches and specks of tarnish); on the right (u a half
 * to 1) the collar's rim, a strip that is dark at its edges and bright between, nicked here and
 * there. Each half is 256 px at full size (192 mid, 128 low).
 */
export function cellSteelTexture(seed: number, tier: Tier): THREE.CanvasTexture {
  const s = tier === "low" ? 128 : tier === "mid" ? 192 : 256;
  const k = s / 256;
  const [c, ctx] = makeCanvas(s * 2, s);
  const rnd = seededRandom(seed);
  const cx = s / 2;
  const cy = s / 2;
  const R = s / 2 - 2 * k;
  // Under the disc, the rim's tone, so no filtering at its edge picks up black.
  ctx.fillStyle = "#7b838b";
  ctx.fillRect(0, 0, s, s);
  // The end: a bright dome of steel, light from the upper left, darker toward the rim.
  const dome = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.32, R * 0.04, cx, cy, R);
  dome.addColorStop(0, "#f1f3f4");
  dome.addColorStop(0.4, "#c2c8cd");
  dome.addColorStop(0.78, "#a2a9b0");
  dome.addColorStop(1, "#7b838b");
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  // Brushed rings round the middle, light and dark.
  for (let i = 0; i < (tier === "low" ? 40 : 90); i++) {
    const light = rnd() < 0.5;
    ctx.strokeStyle = light ? "rgba(255, 255, 255, 0.3)" : "rgba(58, 66, 76, 0.26)";
    ctx.globalAlpha = 0.25 + rnd() * 0.75;
    ctx.lineWidth = (0.6 + rnd() * 1.5) * k;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (0.1 + rnd() * 0.86), 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // The raised rim and the recessed middle, inked.
  ctx.strokeStyle = "rgba(34, 42, 54, 0.7)";
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.9, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 2.4 * k;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.5, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.5 + 3 * k, Math.PI * 0.95, Math.PI * 1.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.9 - 3 * k, Math.PI * 0.95, Math.PI * 1.6);
  ctx.stroke();
  ctx.fillStyle = "rgba(60, 68, 78, 0.5)";
  ctx.beginPath();
  ctx.arc(cx + R * 0.02, cy + R * 0.03, R * 0.17, 0, TAU);
  ctx.fill();
  // Scratches and specks of tarnish, kept inside the disc.
  for (let i = 0; i < (tier === "low" ? 16 : 44); i++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * R * 0.86;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const speck = i % 3 !== 0;
    ctx.fillStyle = `rgba(52, 44, 36, ${0.35 + rnd() * 0.4})`;
    ctx.strokeStyle = `rgba(45, 52, 62, ${0.3 + rnd() * 0.35})`;
    ctx.lineWidth = (0.8 + rnd()) * k;
    if (speck) {
      ctx.beginPath();
      ctx.ellipse(x, y, (1 + rnd() * 2.4) * k, (0.8 + rnd() * 1.6) * k, rnd() * 3, 0, TAU);
      ctx.fill();
    } else {
      const len = (6 + rnd() * 16) * k;
      const t = rnd() * TAU;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(t) * len, y + Math.sin(t) * len);
      ctx.stroke();
    }
  }
  // The collar's rim: dark at both edges, bright between, with fine streaks along it and nicks.
  const rim = ctx.createLinearGradient(0, 0, 0, s);
  rim.addColorStop(0, "#69717a");
  rim.addColorStop(0.22, "#b9c0c6");
  rim.addColorStop(0.5, "#eef0f1");
  rim.addColorStop(0.78, "#b2b9bf");
  rim.addColorStop(1, "#69717a");
  ctx.fillStyle = rim;
  ctx.fillRect(s, 0, s, s);
  for (let i = 0; i < (tier === "low" ? 50 : 140); i++) {
    ctx.strokeStyle =
      rnd() < 0.5
        ? `rgba(255, 255, 255, ${0.1 + rnd() * 0.25})`
        : `rgba(70, 78, 88, ${0.1 + rnd() * 0.22})`;
    ctx.lineWidth = (0.6 + rnd() * 1.4) * k;
    const y = rnd() * s;
    const x = s + rnd() * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(Math.min(2 * s, x + (10 + rnd() * 50) * k), y);
    ctx.stroke();
  }
  for (let i = 0; i < (tier === "low" ? 6 : 16); i++) {
    ctx.fillStyle = `rgba(40, 46, 56, ${0.4 + rnd() * 0.3})`;
    ctx.fillRect(s + rnd() * (s - 4 * k), rnd() * s, (1.5 + rnd() * 3) * k, (6 + rnd() * 14) * k);
  }
  return toTexture(c);
}

/** The silver ends from the cache: one painting per tier, freed by disposeKitBag. */
export function benchCellSteel(tier: Tier): THREE.CanvasTexture {
  return acquireTexture(`bench-cell-steel:${CELL_STEEL_SEED}:${tier}`, () =>
    cellSteelTexture(CELL_STEEL_SEED, tier),
  );
}

// ---- Through the cache -----------------------------------------------------------------------

const PAINTERS: Record<BenchKind, (seed: number, tier: Tier) => THREE.CanvasTexture> = {
  mahogany: mahoganyBoldTexture,
  brass: brassBoldTexture,
  ebonite: eboniteTexture,
  pine: pineBoldTexture,
};

/**
 * The shared bold mahogany, brass, ebonite or pine texture for a tier. Each call is matched by
 * one release, which disposeKitBag does for a part's resource bag.
 */
export function benchTexture(kind: BenchKind, tier: Tier): THREE.CanvasTexture {
  const seed = BENCH_SEEDS[kind];
  return acquireTexture(`bench-${kind}:${seed}:${tier}`, () => PAINTERS[kind](seed, tier));
}
