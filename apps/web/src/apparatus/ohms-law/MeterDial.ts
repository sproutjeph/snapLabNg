import { METER_FULL_DEG, METER_STOP_DEG, METER_ZERO_DEG } from "@snaplab/engine";
import type * as THREE from "three";
import { canvasTexture, makeCanvas, seeded } from "./MeterMaterials";

// The dial of a d.c. moving-coil meter, painted once from the engine's scale (fullScale and
// division). It paints only what the real face shows: ticks, scale numbers and the letter.
// The window is round, as on the school meters in the reference images; the scale itself is the
// engine's 80 degrees (METER_ZERO_DEG to METER_FULL_DEG), not the reference's wider arc.

/** The dial in metres. The paper is a disc; the needle pivots below its middle. */
export const DIAL = {
  /** The paper disc behind the glass. */
  radius: 0.0375,
  /** The frame the readings loupe fits across the screen (it adds a margin of its own). */
  width: 0.068,
  height: 0.068,
  /** The needle pivots this far below the middle of the disc. */
  pivotDown: 0.0235,
  /** The scale arc and the mirror band, as radii from the pivot. */
  arcRadius: 0.0365,
  mirrorInner: 0.0322,
  mirrorOuter: 0.0348,
} as const;

/** Tick lengths, from the arc outward, in metres. */
export const TICK_LEN = { major: 0.0042, mid: 0.0032, minor: 0.0022 } as const;
/**
 * Scale numbers: the font size, and how far past the longest tick their middle sits. A dial that
 * carries four numbers (the voltmeter's 0 1 2 3) has room for larger ones than a dial with six.
 */
export const numeralFontM = (numbers: number): number => (numbers <= 4 ? 0.007 : 0.0058);
const NUMERAL_GAP_M = 0.0038;
const LETTER_M = 0.0135;
const UNIT_NOTE = "d.c.";
/** The needle's length from its pivot: just into the ticks. */
export const NEEDLE_LEN = DIAL.arcRadius + 0.002;

/**
 * A point on the dial `r` metres from the pivot at `deg` from straight up, as metres from the
 * middle of the paper disc with y up. The painter and the tests share it.
 */
export function dialPoint(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, Math.cos(a) * r - DIAL.pivotDown];
}

/** Where the scale number of the tick at `deg` is centred. */
export function numeralPoint(deg: number): [number, number] {
  return dialPoint(deg, DIAL.arcRadius + TICK_LEN.major + NUMERAL_GAP_M);
}

/** Scale numbers read as short as a real dial prints them: 0, 0.2, 1, 1.5. */
export function scaleLabel(value: number): string {
  return String(+value.toFixed(3));
}

/**
 * How many divisions between numbered ticks, so a dial carries four to six numbers: the 1 A
 * ammeter (50 divisions) is numbered 0 0.2 ... 1, and the 3 V voltmeter (60 divisions) 0 1 2 3.
 */
export function majorEvery(divisions: number): number {
  if (divisions >= 60) return 20;
  return divisions >= 40 ? 10 : 5;
}

export interface DialSpec {
  fullScale: number;
  division: number;
  letter: "A" | "V";
  /** Texture width in px; 1024 on mid and high, 512 on low. */
  px: number;
}

export type TickKind = "major" | "mid" | "minor";

export interface DialTick {
  /** 0 at the zero mark, `n` at full scale. */
  index: number;
  /** Where the tick stands on the dial, from straight up, in degrees. */
  deg: number;
  kind: TickKind;
  /** The scale number printed beside it: a multiple of the division, never a reading. */
  label: string | null;
}

/** The needle angle of tick `i` of `n`: zero at METER_ZERO_DEG, full scale at METER_FULL_DEG. */
export function tickDeg(i: number, n: number): number {
  return METER_ZERO_DEG + (i / n) * (METER_FULL_DEG - METER_ZERO_DEG);
}

/** Every tick of the scale, with the scale numbers on the numbered ones. */
export function dialTicks(fullScale: number, division: number): DialTick[] {
  const n = Math.max(1, Math.round(fullScale / division));
  const every = majorEvery(n);
  const half = Math.max(1, Math.floor(every / 2));
  const ticks: DialTick[] = [];
  for (let i = 0; i <= n; i++) {
    const major = i % every === 0;
    ticks.push({
      index: i,
      deg: tickDeg(i, n),
      kind: major ? "major" : i % half === 0 ? "mid" : "minor",
      label: major ? scaleLabel(i * division) : null,
    });
  }
  return ticks;
}

/** Everything the dial prints: the scale numbers, the letter and the note that it is d.c. */
export function dialTexts(spec: Pick<DialSpec, "fullScale" | "division" | "letter">): string[] {
  const numbers = dialTicks(spec.fullScale, spec.division).flatMap((t) =>
    t.label === null ? [] : [t.label],
  );
  return [...numbers, spec.letter, UNIT_NOTE];
}

/**
 * The angle the needle is drawn at: the engine's, with the slam's buzz added, never past the
 * stops at +-METER_STOP_DEG (a needle that meets its stop bounces back; it does not go through).
 */
export function needleAngleDeg(deg: number, buzzDeg = 0): number {
  const a =
    (Number.isFinite(deg) ? deg : METER_ZERO_DEG) + (Number.isFinite(buzzDeg) ? buzzDeg : 0);
  return Math.max(-METER_STOP_DEG, Math.min(METER_STOP_DEG, a));
}

/** The paper: warm cream with fibre, a few age stains, and the rim darkened where the bezel shades it. */
function paintPaper(ctx: CanvasRenderingContext2D, size: number, rnd: () => number): void {
  const c = size / 2;
  ctx.fillStyle = "#f3ead3";
  ctx.fillRect(0, 0, size, size);
  // Soft age stains, warmer toward one side.
  for (let i = 0; i < 7; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = size * (0.12 + rnd() * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rnd() < 0.7;
    g.addColorStop(0, warm ? "rgba(196,150,84,0.13)" : "rgba(150,140,120,0.09)");
    g.addColorStop(1, "rgba(196,150,84,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  // Paper fibre: short faint strokes.
  ctx.lineWidth = Math.max(1, size / 700);
  for (let i = 0; i < 520; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const a = rnd() * Math.PI;
    const l = size * (0.006 + rnd() * 0.016);
    ctx.strokeStyle = rnd() < 0.5 ? "rgba(120,92,52,0.07)" : "rgba(255,255,248,0.20)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // The rim: darker and browner under the bezel's lip.
  const rim = ctx.createRadialGradient(c, c, size * 0.36, c, c, size * 0.5);
  rim.addColorStop(0, "rgba(96,64,28,0)");
  rim.addColorStop(0.72, "rgba(96,64,28,0.16)");
  rim.addColorStop(1, "rgba(48,30,14,0.55)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);
}

/** The glass's soft highlight, upper left (toward the key light): painted white on clear. */
export function createGlassTexture(px: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(px, px);
  if (ctx) {
    ctx.clearRect(0, 0, px, px);
    const c = px / 2;
    const r = px * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r * 0.985, 0, Math.PI * 2);
    ctx.clip();
    // A broad sheen over the upper left.
    const sheen = ctx.createRadialGradient(c * 0.55, c * 0.5, 0, c * 0.55, c * 0.5, r * 0.95);
    sheen.addColorStop(0, "rgba(255,255,255,0.28)");
    sheen.addColorStop(0.55, "rgba(255,255,255,0.12)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, px, px);
    // A thin curved glint just inside the rim, the way a dome catches a window.
    ctx.strokeStyle = "rgba(255,255,255,0.62)";
    ctx.lineCap = "round";
    ctx.lineWidth = px * 0.018;
    ctx.beginPath();
    ctx.arc(c, c, r * 0.9, Math.PI * 1.08, Math.PI * 1.42);
    ctx.stroke();
    ctx.lineWidth = px * 0.008;
    ctx.beginPath();
    ctx.arc(c, c, r * 0.9, Math.PI * 1.47, Math.PI * 1.56);
    ctx.stroke();
    ctx.restore();
  }
  return canvasTexture(canvas, 4);
}

/**
 * A soft dark glow that fades out toward the edge of a square plane, for a part's contact shadow
 * on a face: full strength from the middle out to `solidFrac` of the half width, then fading to
 * clear at the edge. Painted black on clear; the plane that carries it hides under the part.
 */
export function createShadowTexture(
  px: number,
  solidFrac: number,
  strength = 0.55,
): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(px, px);
  if (ctx) {
    ctx.clearRect(0, 0, px, px);
    const c = px / 2;
    const g = ctx.createRadialGradient(c, c, c * solidFrac, c, c, c);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(0.45, `rgba(0,0,0,${strength * 0.35})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(canvas, 2);
}

export function createDialTexture(spec: DialSpec): THREE.CanvasTexture {
  const size = spec.px;
  const { canvas, ctx } = makeCanvas(size, size);
  if (ctx) {
    const s = size / (2 * DIAL.radius); // px per metre
    const px = size / 2;
    const py = size / 2 + DIAL.pivotDown * s;
    const R = DIAL.arcRadius * s;
    const rnd = seeded(spec.letter === "A" ? 7 : 19);

    paintPaper(ctx, size, rnd);

    // A point on the canvas (y down) from dialPoint's metres (y up).
    const toCanvas = ([x, y]: [number, number]): [number, number] => [
      size / 2 + x * s,
      size / 2 - y * s,
    ];
    const at = (deg: number, r: number): [number, number] => toCanvas(dialPoint(deg, r / s));

    ctx.strokeStyle = "#1a1816";
    ctx.fillStyle = "#1a1816";
    ctx.lineCap = "butt";
    ctx.lineWidth = Math.max(1.5, 0.00042 * s);
    ctx.beginPath();
    ctx.arc(
      px,
      py,
      R,
      -Math.PI / 2 + (METER_ZERO_DEG * Math.PI) / 180,
      -Math.PI / 2 + (METER_FULL_DEG * Math.PI) / 180,
    );
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ticks = dialTicks(spec.fullScale, spec.division);
    const fontPx = Math.round(numeralFontM(ticks.filter((t) => t.label !== null).length) * s);
    ctx.font = `bold ${fontPx}px Georgia, serif`;
    for (const t of ticks) {
      const len = TICK_LEN[t.kind] * s;
      ctx.lineWidth = Math.max(1.2, (t.kind === "major" ? 0.00046 : 0.00024) * s);
      const [x0, y0] = at(t.deg, R);
      const [x1, y1] = at(t.deg, R + len);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (t.label !== null) {
        const [lx, ly] = toCanvas(numeralPoint(t.deg));
        ctx.fillText(t.label, lx, ly);
      }
    }

    // The letter in the middle of the fan, and a small "d.c." low on the right.
    ctx.font = `bold ${Math.round(LETTER_M * s)}px Georgia, serif`;
    ctx.fillText(spec.letter, px, py - 0.0165 * s);
    ctx.font = `italic ${Math.round(0.0029 * s)}px Georgia, serif`;
    ctx.fillStyle = "#4a443c";
    ctx.fillText(UNIT_NOTE, px + 0.0155 * s, py - 0.0032 * s);
  }
  return canvasTexture(canvas, spec.px > 512 ? 8 : 2);
}
