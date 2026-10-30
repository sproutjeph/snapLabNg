import * as THREE from "three";
import { tileFbm } from "./benchTextures";
import { acquireTexture, releaseTexture } from "./cache";
import { clamp01, seededRandom } from "./noise";
import type { Tier } from "./textures";

// Surface relief for the bench parts (docs/plans/wave-2-lean.md, row 2a-real; Backcountry 101
// bumps its bark at scale 5): one small seeded height field per surface, used as the material's
// bumpMap (red channel) and its roughnessMap (green channel, a factor on the material's
// roughness). Painted once from mulberry32 and tiling value fbm, so the same seed always gives
// the same pixels; shared through the kit's cache by every part (one texture per kind, whatever
// the tier) and released when the last material holding it is disposed. Linear data (not sRGB),
// mipmapped, anisotropy 8. The low tier gets none: no extra fetches on a low-end phone.
//
// Each tiles once per uv unit, the same unit as the colour maps (boxProjectUV's tile metres), so
// the grain of the relief runs along u with the painted grain.

export type ReliefKind = "wood" | "bakelite" | "ebonite" | "brass";

export interface ReliefSpec {
  /** Texture size in px (each ≤ 512). */
  w: number;
  h: number;
  seed: number;
  /** three's bumpScale: height difference per screen pixel × this tilts the normal. */
  bumpScale: number;
  /** The lowest roughness factor the map paints (green channel); the highest is 1. */
  gMin: number;
}

export const RELIEF: Readonly<Record<ReliefKind, ReliefSpec>> = {
  // Mahogany and pine: tile 0.3 × 0.09 m (pine 0.2 × 0.1), grain along u, open pores.
  wood: { w: 512, h: 256, seed: 41, bumpScale: 4, gMin: 0.84 },
  // The meters' moulded case: tile 0.12 m, a fine orange peel and a few pits.
  bakelite: { w: 256, h: 256, seed: 42, bumpScale: 2.2, gMin: 0.88 },
  // Turned ebonite knobs: tile 0.02 m (lathe uv), the same peel at a coarser cell.
  ebonite: { w: 128, h: 128, seed: 43, bumpScale: 1.2, gMin: 0.88 },
  // Brass: light brushing along u and a few scratches. Tile 0.1–0.12 m.
  brass: { w: 256, h: 256, seed: 44, bumpScale: 0.9, gMin: 0.86 },
};

/** Matte parts stay at roughness 0.6 or more after the map's factor (the ink look's rule). */
export const MIN_ROUGHNESS = 0.6;

/**
 * The relief pixels for `kind`, RGBA 8-bit: r = height, g = roughness factor × 255, b = height,
 * a = 255. Pure (no canvas, no WebGL), so it is testable; the same kind always gives the same bytes.
 */
export function paintRelief(kind: ReliefKind, spec: ReliefSpec = RELIEF[kind]): Uint8Array {
  const { w, h, seed, gMin } = spec;
  const out = new Uint8Array(w * h * 4);
  const rnd = seededRandom(seed);
  // Scratches on brass and pits in bakelite: a few seeded marks, in uv.
  const marks = Array.from({ length: kind === "brass" ? 14 : kind === "wood" ? 0 : 22 }, () => ({
    u: rnd(),
    v: rnd(),
    len: 0.05 + rnd() * 0.25,
    r: 0.004 + rnd() * 0.008,
    tilt: (rnd() - 0.5) * 0.3,
  }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      let height: number;
      let rough: number;
      if (kind === "wood") {
        // Grain lines: long along u, fine across v, ridged so each line is a soft groove.
        const g = tileFbm(seed, u, v, 2, 3, 40);
        const ridge = 1 - Math.abs(2 * g - 1);
        const broad = tileFbm(seed + 1, u, v, 3, 2, 4);
        // Pores: short dark dashes along the grain.
        const pore = tileFbm(seed + 2, u, v, 24, 1, 128);
        const pit = pore > 0.72 ? (pore - 0.72) * 3 : 0;
        height = 0.5 + 0.45 * (ridge - 0.5) + 0.2 * (broad - 0.5) - pit;
        rough = 1 - (1 - gMin) * (0.4 * ridge + 0.6 * broad) + pit;
      } else if (kind === "brass") {
        const streak = tileFbm(seed, u, v, 2, 3, 96);
        const tarnish = tileFbm(seed + 1, u, v, 3, 2);
        height = 0.5 + 0.5 * (streak - 0.5);
        rough = 1 - (1 - gMin) * (0.6 * streak + 0.4 * (1 - tarnish));
      } else {
        // Orange peel: fine, even, round cells.
        const cells = kind === "ebonite" ? 6 : 28;
        const peel = tileFbm(seed, u, v, cells, 3);
        const smudge = tileFbm(seed + 1, u, v, 3, 2);
        height = 0.5 + 0.6 * (peel - 0.5);
        rough = 1 - (1 - gMin) * smudge;
      }
      for (const m of marks) {
        // Wrapped distance to the mark (a short line along u for a scratch, a dot for a pit).
        let du = u - m.u;
        du -= Math.round(du);
        let dv = v - m.v - du * m.tilt;
        dv -= Math.round(dv);
        if (kind === "brass") {
          if (Math.abs(du) < m.len / 2 && Math.abs(dv) < m.r * 0.25) {
            height -= 0.18;
            rough = 1;
          }
        } else if (du * du + dv * dv < m.r * m.r) {
          height -= 0.25;
          rough = 1;
        }
      }
      const i = (y * w + x) * 4;
      const hb = Math.round(clamp01(height) * 255);
      out[i] = hb;
      out[i + 1] = Math.round(Math.max(gMin, Math.min(1, rough)) * 255);
      out[i + 2] = hb;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** The relief texture for `kind`, painted once (repeating, mipmapped, linear, anisotropy 8). */
export function reliefTexture(kind: ReliefKind): THREE.DataTexture {
  const spec = RELIEF[kind];
  return acquireTexture(`relief:${kind}:${spec.seed}`, () => {
    const tex = new THREE.DataTexture(paintRelief(kind, spec), spec.w, spec.h);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.name = `Relief.${kind}`;
    tex.needsUpdate = true;
    return tex;
  });
}

/**
 * Gives `mat` the shared relief of `kind` as its bumpMap and roughnessMap (none on the low tier),
 * raising its roughness just enough that the map's lowest factor keeps it at 0.6 or more. The
 * texture is released when the material is disposed (once, however often dispose is called).
 * `scale` multiplies the kind's bumpScale. Returns `mat`.
 */
export function withRelief<M extends THREE.MeshStandardMaterial>(
  mat: M,
  kind: ReliefKind,
  tier: Tier,
  scale = 1,
): M {
  if (tier === "low") return mat;
  const spec = RELIEF[kind];
  const tex = reliefTexture(kind);
  mat.bumpMap = tex;
  mat.bumpScale = spec.bumpScale * scale;
  mat.roughnessMap = tex;
  mat.roughness = Math.min(1, Math.max(mat.roughness, MIN_ROUGHNESS / spec.gMin));
  const release = () => {
    mat.removeEventListener("dispose", release);
    releaseTexture(tex);
  };
  mat.addEventListener("dispose", release);
  return mat;
}
