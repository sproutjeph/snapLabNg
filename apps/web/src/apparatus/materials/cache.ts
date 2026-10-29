import type * as THREE from "three";
import {
  bakeliteTexture,
  brushedBrassTexture,
  type LabelOptions,
  labelTexture,
  mahoganyTexture,
  pineTexture,
  type Tier,
} from "./textures";

// A module-level texture cache for the materials kit, so a texture is painted once per
// (kind, seed, tier) however many parts use it, and freed when the last part lets go. Painting
// is the expensive step (per-pixel noise), so this keeps it off the main thread's critical path
// when the bench's parts mount together.

export type KitKind = "mahogany" | "pine" | "bakelite" | "brass";

/** One shared seed per kind: the parts differ by material jitter, not by repainting. */
export const KIT_SEEDS: Readonly<Record<KitKind, number>> = {
  mahogany: 11,
  pine: 12,
  bakelite: 13,
  brass: 14,
};

interface Entry {
  tex: THREE.Texture;
  refs: number;
}
const CACHE = new Map<string, Entry>();

/**
 * The texture for `key`, painted by `make` the first time and shared after. Each call must be
 * matched by one `releaseTexture`. (React's dev double render may leave one extra count; the
 * texture then simply lives until the page closes.)
 */
export function acquireTexture<T extends THREE.Texture>(key: string, make: () => T): T {
  const hit = CACHE.get(key);
  if (hit) {
    hit.refs++;
    return hit.tex as T;
  }
  const tex = make();
  tex.userData.kitKey = key;
  CACHE.set(key, { tex, refs: 1 });
  return tex;
}

/** Lets go of a texture from `acquireTexture`; at zero holders it is disposed and forgotten. */
export function releaseTexture(tex: THREE.Texture): void {
  const key = tex.userData.kitKey as string | undefined;
  if (!key) return;
  const e = CACHE.get(key);
  if (!e || e.tex !== tex) return;
  e.refs--;
  if (e.refs <= 0) {
    CACHE.delete(key);
    tex.dispose();
  }
}

/** How many textures are held (for tests). */
export const cachedTextureCount = () => CACHE.size;

const PAINTERS: Record<KitKind, (seed: number, tier: Tier) => THREE.CanvasTexture> = {
  mahogany: mahoganyTexture,
  pine: pineTexture,
  bakelite: bakeliteTexture,
  brass: brushedBrassTexture,
};

/** The shared mahogany, pine, bakelite or brass texture for a tier. */
export function kitTexture(kind: KitKind, tier: Tier): THREE.CanvasTexture {
  const seed = KIT_SEEDS[kind];
  return acquireTexture(`${kind}:${seed}:${tier}`, () => PAINTERS[kind](seed, tier));
}

/** A paper label, shared by its text and size. `px` is chosen from the tier. */
export function kitLabel(opts: Omit<LabelOptions, "px">, tier: Tier): THREE.CanvasTexture {
  const px = tier === "low" ? 256 : tier === "mid" ? 512 : 768;
  const key = `label:${opts.lines.join("|")}:${opts.width}x${opts.height}:${opts.seed ?? 5}:${px}`;
  return acquireTexture(key, () => labelTexture({ ...opts, px }));
}

/**
 * Disposes what a part's resource bag owns and releases the cache's textures it borrowed
 * (arrays and nested bags included). Anything without a dispose method is skipped.
 */
export function disposeKitBag(bag: Record<string, unknown>): void {
  const one = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) one(x);
      return;
    }
    if (!v || typeof (v as { dispose?: unknown }).dispose !== "function") return;
    const t = v as THREE.Texture;
    if (t.userData?.kitKey) releaseTexture(t);
    else (v as { dispose: () => void }).dispose();
  };
  for (const v of Object.values(bag)) one(v);
}
