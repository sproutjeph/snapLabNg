import { METER_FULL_DEG, METER_ZERO_DEG } from "@snaplab/engine";
import type * as THREE from "three";
import { canvasTexture, makeCanvas } from "./MeterMaterials";

// The dial of a d.c. moving-coil meter, painted once from the engine's scale (fullScale and
// division). It paints only what the real face shows: ticks, scale numbers and the letter.

/** Dial paper size in metres, and where the needle pivots on it (from the bottom edge). */
export const DIAL = {
  width: 0.1,
  height: 0.075,
  pivotUp: 0.0045,
  /** The scale arc and the mirror band, as radii from the pivot. */
  arcRadius: 0.058,
  mirrorInner: 0.0505,
  mirrorOuter: 0.0545,
} as const;

/** Scale numbers read as short as a real dial prints them: 0, 0.2, 1, 1.5. */
export function scaleLabel(value: number): string {
  return String(+value.toFixed(3));
}

/** How many divisions between numbered ticks, so a dial carries about five to six numbers. */
export function majorEvery(divisions: number): number {
  return divisions >= 40 ? 10 : 5;
}

export interface DialSpec {
  fullScale: number;
  division: number;
  letter: "A" | "V";
  /** Texture width in px; 1024 on mid and high, 512 on low. */
  px: number;
}

export function createDialTexture(spec: DialSpec): THREE.CanvasTexture {
  const w = spec.px;
  const h = Math.round((w * DIAL.height) / DIAL.width);
  const { canvas, ctx } = makeCanvas(w, h);
  if (ctx) {
    const s = w / DIAL.width; // px per metre
    const px = w / 2;
    const py = h - DIAL.pivotUp * s;
    const R = DIAL.arcRadius * s;

    ctx.fillStyle = "#f6f0de";
    ctx.fillRect(0, 0, w, h);

    const at = (deg: number, r: number): [number, number] => {
      const a = (deg * Math.PI) / 180;
      return [px + Math.sin(a) * r, py - Math.cos(a) * r];
    };
    const degFor = (i: number, n: number) =>
      METER_ZERO_DEG + (i / n) * (METER_FULL_DEG - METER_ZERO_DEG);

    const n = Math.max(1, Math.round(spec.fullScale / spec.division));
    const every = majorEvery(n);

    ctx.strokeStyle = "#1a1816";
    ctx.fillStyle = "#1a1816";
    ctx.lineWidth = Math.max(1.5, 0.0003 * s);
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
    const fontPx = Math.round(0.0042 * s);
    ctx.font = `bold ${fontPx}px Georgia, serif`;
    for (let i = 0; i <= n; i++) {
      const major = i % every === 0;
      const mid = !major && i % 5 === 0;
      const len = (major ? 0.0044 : mid ? 0.0032 : 0.0022) * s;
      ctx.lineWidth = Math.max(1, (major ? 0.00034 : 0.00019) * s);
      const deg = degFor(i, n);
      const [x0, y0] = at(deg, R);
      const [x1, y1] = at(deg, R + len);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (major) {
        const [lx, ly] = at(deg, R + 0.0044 * s + fontPx * 0.8);
        ctx.fillText(scaleLabel(i * spec.division), lx, ly);
      }
    }

    // The letter in the middle of the fan, and a small "d.c." under the pivot.
    ctx.font = `bold ${Math.round(0.014 * s)}px Georgia, serif`;
    ctx.fillText(spec.letter, px, py - 0.027 * s);
    ctx.font = `italic ${Math.round(0.0028 * s)}px Georgia, serif`;
    ctx.fillStyle = "#4a443c";
    ctx.fillText("d.c.", px + 0.036 * s, py - 0.001 * s);
  }
  return canvasTexture(canvas, spec.px > 512 ? 8 : 2);
}
