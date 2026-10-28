import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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
