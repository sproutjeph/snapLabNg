import * as THREE from "three";
import { seededRandom } from "./noise";

// Matte materials for the apparatus (roughness 0.6 or more, a small seeded colour jitter), so
// they suit the ink-outline pass. Brass is warm and a little rough; wood, bakelite and paper
// sit at 0.85–0.95 as the look recipe says.

/** `hex` nudged in hue, saturation and lightness by up to ±`amount`, from `rnd`. */
export function jitter(hex: string, rnd: () => number, amount = 0.03): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + (rnd() - 0.5) * amount * 0.4 + 1) % 1,
    Math.min(1, Math.max(0, hsl.s + (rnd() - 0.5) * amount)),
    Math.min(1, Math.max(0, hsl.l + (rnd() - 0.5) * amount * 1.4)),
  );
  return c;
}

export interface SurfaceOptions {
  map?: THREE.Texture;
  /** Tint multiplied over the map (default white). */
  tint?: string;
  roughness?: number;
  metalness?: number;
  /** Colour jitter amount (default 0.03). */
  amount?: number;
}

function surface(base: string, seed: number, o: SurfaceOptions, rough: number, metal: number) {
  const rnd = seededRandom(seed);
  const mat = new THREE.MeshStandardMaterial({
    color: jitter(o.tint ?? base, rnd, o.amount ?? 0.03),
    roughness: Math.max(0.6, o.roughness ?? rough),
    metalness: o.metalness ?? metal,
  });
  if (o.map) mat.map = o.map;
  return mat;
}

/** Wood (mahogany or pine) under `map`: roughness 0.9. */
export function woodMaterial(seed: number, o: SurfaceOptions = {}) {
  return surface("#ffffff", seed, o, 0.9, 0);
}

/** Speckled black bakelite or ebonite: roughness 0.8. */
export function bakeliteMaterial(seed: number, o: SurfaceOptions = {}) {
  return surface("#ffffff", seed, o, 0.8, 0);
}

/** Warm brass, slightly rough (0.62, a little metal) so it takes the environment lightly. */
export function brassSurface(seed: number, o: SurfaceOptions = {}) {
  return surface(o.map ? "#fff6e0" : "#c9a24a", seed, o, 0.62, 0.3);
}

/** A printed paper label. */
export function paperMaterial(seed: number, o: SurfaceOptions = {}) {
  return surface("#ffffff", seed, { amount: 0.004, ...o }, 0.92, 0);
}

/** A plain painted or moulded part (black plug heads, cell wrappers): roughness 0.85. */
export function paintMaterial(hex: string, seed: number, o: SurfaceOptions = {}) {
  return surface(hex, seed, o, 0.85, 0);
}

export { seededRandom };
