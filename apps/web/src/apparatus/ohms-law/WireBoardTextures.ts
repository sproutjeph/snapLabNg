import * as THREE from "three";
import { INK_BLUE, seededRandom } from "../materials";
import { cmToX } from "../meter-bridge/dimensions";
import type { QualityTier } from "../meter-bridge/types";

// Canvas textures for the wire board and the tray, each painted once (never per frame, never at
// more than 1024 px a side). The caller disposes what it makes. The pure layout of the printed
// rule (which pixel a centimetre mark lands on) is kept apart from the painting, so a test can
// pin that the scale's 0 and 100 sit under the X and Y blocks without a canvas.

const TAU = Math.PI * 2;
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

// ---- The metre rule: layout -------------------------------------------------------------------

/** The rule is longer than a metre by this much at each end (m): a margin before 0 and after 100. */
export const RULE_MARGIN_M = 0.01;
export const RULE_LENGTH_M = 1 + 2 * RULE_MARGIN_M;
/** The cream strip's depth (m), front to back. */
export const RULE_DEPTH_M = 0.046;
/** The strip's edges are eased by this much, and the print stops short of them (m). */
export const RULE_EDGE_M = 0.001;
/** The printed area's depth (m): the strip inside its eased edges. */
export const RULE_PRINT_DEPTH_M = RULE_DEPTH_M - 2 * RULE_EDGE_M;

/**
 * Where the printed area is cut into textures, in cm on the scale (0 is at x = -0.5 m). One
 * texture a metre would be 4000 px; four keep every texture under 1024 px at 3.9 px a millimetre.
 * The cuts fall between two millimetre marks, and the marks near a cut are drawn on both sides
 * (the canvas clips them), so no tick or numeral is lost at a join.
 */
export const RULE_CUTS_CM = [-0.9, 25.25, 50.25, 75.25, 100.9] as const;

export interface RuleSegment {
  index: number;
  fromCm: number;
  toCm: number;
  /** Local x of the segment's middle and its length along x, in metres. */
  centreX: number;
  lengthM: number;
  widthPx: number;
  heightPx: number;
}

/** Pixels per centimetre along the rule: 39 (3.9 a millimetre) on mid and high, half that on low. */
export const rulePxPerCm = (quality: QualityTier) => (quality === "low" ? 19.5 : 39);

export function ruleSegments(quality: QualityTier): RuleSegment[] {
  const k = rulePxPerCm(quality);
  const out: RuleSegment[] = [];
  for (let i = 0; i < RULE_CUTS_CM.length - 1; i++) {
    const fromCm = RULE_CUTS_CM[i] ?? 0;
    const toCm = RULE_CUTS_CM[i + 1] ?? 0;
    out.push({
      index: i,
      fromCm,
      toCm,
      centreX: cmToX((fromCm + toCm) / 2),
      lengthM: (toCm - fromCm) / 100,
      widthPx: Math.round((toCm - fromCm) * k),
      heightPx: Math.round(RULE_PRINT_DEPTH_M * 100 * k),
    });
  }
  return out;
}

export type MarkKind = "ten" | "cm" | "half" | "mm";

export interface RuleMark {
  mm: number;
  kind: MarkKind;
}

/** Every printed tick, one a millimetre from 0 to 1000: a longer one at each 5 mm, cm and 10 cm. */
export function ruleMarks(): RuleMark[] {
  const marks: RuleMark[] = [];
  for (let mm = 0; mm <= 1000; mm++) {
    const kind: MarkKind =
      mm % 100 === 0 ? "ten" : mm % 10 === 0 ? "cm" : mm % 5 === 0 ? "half" : "mm";
    marks.push({ mm, kind });
  }
  return marks;
}

/** The pixel column mark `mm` falls on in `seg`. Linear, so the print lands on the board exactly. */
export function markPx(seg: RuleSegment, mm: number): number {
  return ((mm / 10 - seg.fromCm) / (seg.toCm - seg.fromCm)) * seg.widthPx;
}

/**
 * Local x (m) where the printed mark for `cm` lands: the segment's place on the board plus the
 * pixel its mark is painted on. The blocks stand at `wireEndX`; the two must agree to 1 mm.
 */
export function ruleMarkX(cm: number, quality: QualityTier = "high"): number {
  const segs = ruleSegments(quality);
  const seg = segs.find((s) => cm >= s.fromCm && cm <= s.toCm) ?? segs[0];
  if (!seg) throw new Error("the rule has no segments");
  return seg.centreX + (markPx(seg, cm * 10) / seg.widthPx - 0.5) * seg.lengthM;
}

/** Local x (m) of a wire end at `cm` on the rule: where its brass block stands. */
export const wireEndX = (cm: number) => cmToX(cm);

// ---- Painting helpers -------------------------------------------------------------------------

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return [c, ctx];
}

function finish(
  c: HTMLCanvasElement,
  anisotropy: number,
  wrapU: THREE.Wrapping = THREE.ClampToEdgeWrapping,
  wrapV: THREE.Wrapping = THREE.ClampToEdgeWrapping,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = wrapU;
  tex.wrapT = wrapV;
  tex.needsUpdate = true;
  return tex;
}

/** A wobble that repeats across `w`: whole numbers of periods, so a texture tiles without a seam. */
function wobble(x: number, w: number, waves: ReadonlyArray<readonly [number, number, number]>) {
  let s = 0;
  for (const [k, amp, phase] of waves) s += amp * Math.sin((TAU * k * x) / w + phase);
  return s;
}

// ---- The metre rule: painting -----------------------------------------------------------------

/**
 * One segment of the rule's printed face: pale boxwood with ink ticks along the back edge (by the
 * wire), small numerals at every centimetre and large ones at every 10 cm, 0 to 100. u runs along
 * x. It paints the scale only, never a reading.
 */
export function makeRuleSegmentTexture(index: number, quality: QualityTier): THREE.CanvasTexture {
  const seg = ruleSegments(quality)[index];
  if (!seg) throw new Error(`no rule segment ${index}`);
  const [c, ctx] = canvas(seg.widthPx, seg.heightPx);
  const paint = () => paintRuleSegment(ctx, seg, quality, index);
  paint();
  const tex = finish(c, 8);
  tex.userData.repaint = paint;
  return tex;
}

function paintRuleSegment(
  ctx: CanvasRenderingContext2D,
  seg: RuleSegment,
  quality: QualityTier,
  index: number,
): void {
  const { widthPx: w, heightPx: h } = seg;
  const pxMm = rulePxPerCm(quality) / 10;
  const rnd = seededRandom(0xa11 + index * 17);
  // Pale boxwood with a few faint fibres. The albedo is a touch grey: the look's light lifts it
  // to a warm cream, where a brighter paint would burn out to lemon.
  ctx.fillStyle = "#d9d1bf";
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = Math.max(1, pxMm * 0.3);
  for (let i = 0; i < 46; i++) {
    const y = rnd() * h;
    ctx.strokeStyle = rnd() < 0.55 ? "rgba(140,104,56,0.12)" : "rgba(255,246,214,0.3)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + (rnd() - 0.5) * pxMm * 1.5);
    ctx.stroke();
  }
  // The long line the ticks hang from, along the back edge.
  ctx.fillStyle = INK_BLUE;
  ctx.fillRect(0, 0, w, Math.max(1.5, pxMm * 0.6));
  // Ticks hang from that line: 4, 6.5, 9.5 and 13 mm long, inked heavy enough to hold at 1 px a mm.
  const tick: Record<MarkKind, [number, number]> = {
    mm: [4 * pxMm, Math.max(1, pxMm * 0.42)],
    half: [6.5 * pxMm, Math.max(1.2, pxMm * 0.56)],
    cm: [9.5 * pxMm, Math.max(1.5, pxMm * 0.78)],
    ten: [13 * pxMm, Math.max(1.9, pxMm * 1.05)],
  };
  ctx.fillStyle = INK_BLUE;
  for (const m of ruleMarks()) {
    const x = markPx(seg, m.mm);
    const [len, width] = tick[m.kind];
    if (x < -width || x > w + width) continue;
    ctx.fillRect(x - width / 2, 0, width, len);
  }
  // Numerals. A numeral that straddles a cut is drawn on both sides; the canvas clips it.
  ctx.fillStyle = INK_BLUE;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const small = Math.round(9.2 * pxMm);
  const big = Math.round(29 * pxMm);
  for (let cm = 0; cm <= 100; cm++) {
    const x = markPx(seg, cm * 10);
    const ten = cm % 10 === 0;
    if (x < -big || x > w + big) continue;
    ctx.font = `bold ${ten ? big : small}px ${FONT}`;
    // "100" is three digits wide and the strip ends 9 mm past the mark: it ends 7 mm past it instead.
    ctx.textAlign = cm === 100 ? "right" : "center";
    // Baselines 20.5 mm (small, 6.4 mm tall) and 43 mm (large, 20 mm tall) below the back edge.
    ctx.fillText(String(cm), cm === 100 ? x + 7 * pxMm : x, (ten ? 43 : 20.5) * pxMm);
  }
}

// ---- The pine board ---------------------------------------------------------------------------

/**
 * Pale pine with a loud grain, after the reference: honey ground, long red-brown streaks that
 * bend together, fine dark lines, light flecks and a scatter of pores. Grain runs along u, and the
 * texture tiles across u without a seam (u 0 to 1 is 0.55 m of board; v 0 to 1 is its 0.12 m depth).
 */
export function makePineBoardTexture(quality: QualityTier): THREE.CanvasTexture {
  const hi = quality !== "low";
  const w = hi ? 1024 : 512;
  const h = hi ? 256 : 128;
  const k = w / 1024;
  const [c, ctx] = canvas(w, h);
  const rnd = seededRandom(0x91ee);
  const phase = rnd() * TAU;
  // One slow bend shared by every line, so neighbours move together like growth rings.
  const bend = (x: number, y: number) =>
    10 *
    k *
    Math.sin((TAU * x) / w + phase + (y / h) * 2.4) *
    (0.3 + 0.7 * Math.sin((Math.PI * y) / h));
  const wraps = [-w, 0, w];

  ctx.fillStyle = "#dac49c";
  ctx.fillRect(0, 0, w, h);
  // Soft mottling: long blobs, light and warm, repeated either side so the tile joins.
  for (let i = 0; i < (hi ? 70 : 36); i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const rx = (90 + rnd() * 260) * k;
    const ry = (8 + rnd() * 34) * k;
    const light = rnd() < 0.5;
    for (const dx of wraps) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
      const col = light ? "255,240,204" : "160,112,72";
      g.addColorStop(0, `rgba(${col},${light ? 0.2 : 0.12})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.save();
      ctx.translate(x + dx, y);
      ctx.scale(1, ry / rx);
      ctx.translate(-(x + dx), -y);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + dx, y, rx, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // A streak: a wavy line along u whose ink thickens and fades along its length (the same
  // strength at both ends, so the tile joins). `core` adds a thin dark line down its middle.
  const streak = (
    y0: number,
    width: number,
    rgb: string,
    alphaLo: number,
    alphaHi: number,
    core?: string,
  ) => {
    const waves: Array<readonly [number, number, number]> = [
      [1 + Math.floor(rnd() * 2), (1 + rnd() * 5) * k, rnd() * TAU],
      [3 + Math.floor(rnd() * 3), (0.4 + rnd() * 1.4) * k, rnd() * TAU],
    ];
    const stops = 7;
    const ink = (colour: string, lo: number, hi2: number) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      const a0 = lo + rnd() * (hi2 - lo);
      for (let s = 0; s <= stops; s++) {
        const a = s === 0 || s === stops ? a0 : lo + rnd() * (hi2 - lo);
        g.addColorStop(s / stops, `rgba(${colour},${a.toFixed(3)})`);
      }
      return g;
    };
    const trace = () => {
      ctx.beginPath();
      const step = 12 * k + 4;
      for (let x = -step; x <= w + step; x += step) {
        const y = y0 + bend(x, y0) + wobble(x, w, waves);
        if (x === -step) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };
    ctx.lineCap = "round";
    ctx.strokeStyle = ink(rgb, alphaLo, alphaHi);
    ctx.lineWidth = width;
    trace();
    ctx.stroke();
    if (core) {
      ctx.strokeStyle = ink(core, 0.12, 0.4);
      ctx.lineWidth = Math.max(0.7, width * 0.18);
      trace();
      ctx.stroke();
    }
  };

  // Fine dark lines and pale lines between them, then the broad red-brown streaks with a dark core.
  for (let i = 0; i < (hi ? 130 : 60); i++) {
    streak(rnd() * h, (0.6 + rnd() * 1.1) * k, "118,70,40", 0.06, 0.3);
  }
  for (let i = 0; i < (hi ? 60 : 28); i++) {
    streak(rnd() * h, (0.8 + rnd() * 1.6) * k, "255,244,214", 0.1, 0.3);
  }
  for (let i = 0; i < (hi ? 13 : 7); i++) {
    streak(rnd() * h, (2.6 + rnd() * 3.8) * k, "160,72,40", 0.2, 0.55, "92,44,22");
  }
  // Pores and resin flecks: short dashes lying along the grain; those at an edge are drawn on
  // the other side too, so the tile still joins.
  const dash = (x: number, y: number, len: number, thick: number, colour: string) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = thick;
    ctx.lineCap = "round";
    const tilt = (rnd() - 0.5) * 0.8 * k;
    for (const dx of wraps) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y);
      ctx.lineTo(x + dx + len, y + tilt);
      ctx.stroke();
    }
  };
  for (let i = 0; i < (hi ? 900 : 320); i++) {
    dash(
      rnd() * w,
      rnd() * h,
      (1.5 + rnd() * 4.5) * k,
      Math.max(0.9, (0.8 + rnd() * 1) * k),
      `rgba(78,40,20,${(0.3 + rnd() * 0.55).toFixed(2)})`,
    );
  }
  for (let i = 0; i < (hi ? 70 : 26); i++) {
    dash(
      rnd() * w,
      rnd() * h,
      (3 + rnd() * 6) * k,
      Math.max(0.9, (0.8 + rnd() * 0.8) * k),
      `rgba(255,242,206,${(0.35 + rnd() * 0.4).toFixed(2)})`,
    );
  }
  return finish(c, 8, THREE.RepeatWrapping);
}

/**
 * The sawn end of the pine board: growth rings as shallow arcs, a few checks, and pores. The
 * end of a 12 cm by 2 cm board fills the whole canvas (u across the 12 cm, v up the 2 cm).
 */
export function makeEndGrainTexture(quality: QualityTier): THREE.CanvasTexture {
  const hi = quality !== "low";
  const w = hi ? 768 : 384;
  const h = hi ? 128 : 64;
  const k = w / 768;
  const [c, ctx] = canvas(w, h);
  const rnd = seededRandom(0xe4d);
  ctx.fillStyle = "#cf9f63";
  ctx.fillRect(0, 0, w, h);
  // Rings: circles about a pith that lies off the board, below its face.
  const cx = w * (0.36 + rnd() * 0.2);
  const cy = h * 2.6;
  let r = h * 1.2;
  while (r < h * 6) {
    const dark = rnd() < 0.6;
    ctx.strokeStyle = dark
      ? `rgba(120,56,26,${(0.3 + rnd() * 0.45).toFixed(2)})`
      : `rgba(246,214,150,${(0.2 + rnd() * 0.3).toFixed(2)})`;
    ctx.lineWidth = (dark ? 1.4 + rnd() * 3.2 : 1 + rnd() * 2) * k;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    r += (3 + rnd() * 7) * k;
  }
  // Checks: thin splits running in from the sides.
  ctx.strokeStyle = "rgba(60,28,14,0.7)";
  ctx.lineWidth = 1.6 * k;
  for (let i = 0; i < 5; i++) {
    const x = rnd() * w;
    const y = rnd() < 0.5 ? 0 : h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 30 * k, y + (y === 0 ? 1 : -1) * (18 + rnd() * 34) * k);
    ctx.stroke();
  }
  for (let i = 0; i < (hi ? 500 : 180); i++) {
    ctx.fillStyle = `rgba(64,32,14,${(0.2 + rnd() * 0.4).toFixed(2)})`;
    ctx.fillRect(rnd() * w, rnd() * h, (0.8 + rnd() * 1.6) * k, (0.8 + rnd() * 1.6) * k);
  }
  return finish(c, 4);
}

// ---- Brass ------------------------------------------------------------------------------------

/**
 * Brushed brass, louder than the kit's: a warm ground with light and dark streaks along u, soft
 * tarnish and polish patches, pits and a few scratches. It tiles across u and v; a tile is
 * 5 cm square on the board's end blocks, and 4 cm on the tray's hardware.
 */
export function makeBrassTexture(quality: QualityTier, seed = 0xb7a55): THREE.CanvasTexture {
  const n = quality === "low" ? 128 : 256;
  const k = n / 256;
  const [c, ctx] = canvas(n, n);
  const rnd = seededRandom(seed);
  const wraps = [-n, 0, n];
  ctx.fillStyle = "#c29c48";
  ctx.fillRect(0, 0, n, n);
  // Tarnish (dark) and polish (light) patches, repeated on every side so the tile joins.
  for (let i = 0; i < 26; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const r = (18 + rnd() * 50) * k;
    const polish = rnd() < 0.5;
    const col = polish ? "250,226,150" : "110,76,24";
    for (const dx of wraps) {
      for (const dy of wraps) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, `rgba(${col},${polish ? 0.22 : 0.24})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
      }
    }
  }
  // Brushing: long fine strokes along u, light and dark.
  ctx.lineCap = "round";
  for (let i = 0; i < (quality === "low" ? 120 : 280); i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const len = (30 + rnd() * 150) * k;
    const light = rnd() < 0.5;
    ctx.strokeStyle = light
      ? `rgba(255,236,160,${(0.12 + rnd() * 0.3).toFixed(2)})`
      : `rgba(96,64,18,${(0.12 + rnd() * 0.28).toFixed(2)})`;
    ctx.lineWidth = (0.6 + rnd() * 0.9) * k;
    const tilt = (rnd() - 0.5) * 2 * k;
    for (const dx of wraps) {
      for (const dy of wraps) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(x + dx + len, y + dy + tilt);
        ctx.stroke();
      }
    }
  }
  // Pits and glints.
  for (let i = 0; i < (quality === "low" ? 24 : 70); i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const r = (0.5 + rnd() * 0.9) * k + 0.3;
    ctx.fillStyle =
      rnd() < 0.65
        ? `rgba(70,46,12,${(0.35 + rnd() * 0.35).toFixed(2)})`
        : `rgba(255,240,180,${(0.4 + rnd() * 0.3).toFixed(2)})`;
    for (const dx of wraps) {
      for (const dy of wraps) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, TAU);
        ctx.fill();
      }
    }
  }
  // A few scratches across the grain.
  for (let i = 0; i < 12; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const len = (20 + rnd() * 50) * k;
    const a = (rnd() - 0.5) * 0.9;
    ctx.strokeStyle = rnd() < 0.6 ? "rgba(246,222,150,0.3)" : "rgba(90,60,16,0.25)";
    ctx.lineWidth = 0.7 * k + 0.2;
    for (const dx of wraps) {
      for (const dy of wraps) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len);
        ctx.stroke();
      }
    }
  }
  return finish(c, 8, THREE.RepeatWrapping, THREE.RepeatWrapping);
}

// ---- Letters and the sandpaper ----------------------------------------------------------------

/** A single printed letter (X or Y) in the ink, on a transparent ground. */
export function makeLetterTexture(letter: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const paint = () => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = INK_BLUE;
    ctx.font = `bold 112px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // A capital sits on the baseline, 0.7 of the font size tall: centre it in the canvas.
    ctx.fillText(letter, 64, 64 + 0.35 * 112);
  };
  paint();
  const tex = finish(c, 4);
  tex.userData.repaint = paint;
  return tex;
}

/**
 * Repaints the textures once the Barlow Condensed face has loaded (they are first painted in a
 * fallback if it has not). Returns a cancel function. Runs once, never per frame.
 */
export function repaintWhenFontReady(textures: THREE.CanvasTexture[]): () => void {
  let live = true;
  if (typeof document === "undefined" || !document.fonts) return () => {};
  document.fonts
    .load('bold 32px "Barlow Condensed"')
    .then(() => {
      if (!live) return;
      for (const t of textures) {
        const repaint = t.userData.repaint as (() => void) | undefined;
        repaint?.();
        t.needsUpdate = true;
      }
    })
    .catch(() => {});
  return () => {
    live = false;
  };
}

/** Coarse grit for the sandpaper strip: a paper ground with dark and pale grains. */
export function makeGritTexture(rng: () => number): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = "#c2a67c";
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 9000; i++) {
    const v = rng();
    ctx.fillStyle =
      v < 0.4 ? "rgba(84,56,30,0.42)" : v < 0.8 ? "rgba(240,220,176,0.5)" : "rgba(140,76,44,0.32)";
    ctx.fillRect(rng() * 512, rng() * 256, 1 + rng() * 2, 1 + rng() * 2);
  }
  return finish(c, 4);
}
