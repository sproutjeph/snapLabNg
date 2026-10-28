import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";

// Canvas textures for the wire board, drawn once (never per frame). Each caller disposes its own.

/** The rule is longer than a metre by this much at each end (m): a margin before 0 and after 100. */
export const RULE_MARGIN_M = 0.01;
/** Rule texture: 2048 px for 1.02 m, so 2 px per mm. */
const RULE_PX = 2048;
const RULE_ROWS = 64;
/** Rule depth (m): 64 px at 2 px per mm. */
export const RULE_DEPTH_M = 0.032;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/** Plain wood with grain running along x (u). */
export function makeWoodTexture(rng: () => number, quality: QualityTier): THREE.CanvasTexture {
  const w = quality === "low" ? 512 : 1024;
  const h = quality === "low" ? 64 : 128;
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = "#b98a56";
  ctx.fillRect(0, 0, w, h);
  const strokes = quality === "low" ? 50 : 130;
  for (let i = 0; i < strokes; i++) {
    const y = rng() * h;
    const dark = rng() < 0.6;
    ctx.strokeStyle = dark
      ? `rgba(92, 58, 28, ${0.08 + rng() * 0.14})`
      : `rgba(222, 180, 128, ${0.08 + rng() * 0.12})`;
    ctx.lineWidth = 0.6 + rng() * 1.6;
    ctx.beginPath();
    const phase = rng() * 6;
    const amp = 0.6 + rng() * 2.2;
    const x0 = rng() * w * 0.4;
    ctx.moveTo(x0, y);
    for (let x = x0; x <= w; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.013 + phase) * amp);
    ctx.stroke();
  }
  // A knot or two.
  for (let k = 0; k < 2; k++) {
    const kx = rng() * w;
    const ky = h * (0.25 + rng() * 0.5);
    for (let r = 4; r > 0; r--) {
      ctx.strokeStyle = `rgba(80, 48, 22, ${0.1 + (4 - r) * 0.05})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 4 + r * 5, 2 + r * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return finish(c, 4);
}

/**
 * The metre rule's face: a pale boxwood strip with mm ticks, longer ticks at 5 mm, and a
 * number at every cm. u runs along x from 0 to 1 across 1.02 m (zero is 1 cm in); the top edge
 * of the canvas is the edge by the wire. It paints the scale only, never a reading.
 */
export function makeRuleTexture(): THREE.CanvasTexture {
  // Full size on every tier: at half size the mm ticks run together.
  const w = RULE_PX;
  const h = RULE_ROWS;
  const [c, ctx] = canvas(w, h);
  const paint = () => paintRule(ctx, w, h);
  paint();
  const tex = finish(c, 8);
  tex.userData.repaint = paint;
  return tex;
}

function paintRule(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sx = w / (1.02 * 1000); // px per mm
  ctx.fillStyle = "#e6d3a2";
  ctx.fillRect(0, 0, w, h);
  // Faint grain.
  ctx.strokeStyle = "rgba(150, 110, 60, 0.12)";
  ctx.lineWidth = 1;
  for (let y = 3; y < h; y += 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + 1);
    ctx.stroke();
  }
  ctx.fillStyle = "#cdb678";
  ctx.fillRect(0, h - 2 * (h / RULE_ROWS), w, 2 * (h / RULE_ROWS)); // a darker lower edge
  const k = h / RULE_ROWS; // 1 on full size
  ctx.strokeStyle = "#1d1a14";
  ctx.fillStyle = "#1d1a14";
  for (let mm = 0; mm <= 1000; mm++) {
    const x = (mm + 10) * sx;
    const cm = mm % 10 === 0;
    const half = mm % 5 === 0;
    const len = (cm ? 20 : half ? 13 : 8) * k;
    ctx.lineWidth = (cm ? 1.6 : 1) * Math.max(0.7, k);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, len);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `bold ${Math.round(15 * k)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  for (let cm = 0; cm <= 100; cm++) {
    const x = (cm * 10 + 10) * sx;
    ctx.fillText(String(cm), x, 23 * k);
  }
  ctx.font = `bold ${Math.round(10 * k)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("cm", 14 * sx * 10 + 6, 43 * k);
}

/** A single stamped letter (X or Y) on a transparent ground. */
export function makeLetterTexture(letter: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  const paint = () => {
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = "#2a1b0e";
    ctx.font = 'bold 46px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, 32, 34);
  };
  paint();
  const tex = finish(c, 2);
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

/** Fine grit for the sandpaper strip. */
export function makeGritTexture(rng: () => number): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 128);
  ctx.fillStyle = "#b99a68";
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 2600; i++) {
    const v = rng();
    ctx.fillStyle = v < 0.5 ? "rgba(70,50,28,0.35)" : "rgba(230,205,160,0.4)";
    ctx.fillRect(rng() * 256, rng() * 128, 1 + rng() * 1.6, 1 + rng() * 1.6);
  }
  return finish(c, 2);
}
