import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Bevelled boxes and box-projected uvs for the apparatus: every box edge catches a little light,
// which is what the ink pass draws as a crease. Sizes in metres.

/** A rounded box of w × h × d centred on the origin; `radius` is capped to a third of the thinnest side. */
export function bevelBox(
  w: number,
  h: number,
  d: number,
  radius = 0.003,
  segments = 3,
): THREE.BufferGeometry {
  const r = Math.min(radius, Math.min(w, h, d) / 3);
  return new RoundedBoxGeometry(w, h, d, Math.max(1, segments), r);
}

/** Bevel segments by quality tier: fewer on low. */
export const bevelSegments = (quality: "low" | "mid" | "high") =>
  quality === "low" ? 1 : quality === "mid" ? 2 : 3;

/**
 * Rewrites `geo`'s uv from its positions so a texture keeps one scale on every face: the dominant
 * axis of each normal picks the plane, and `tileM` is how many metres one texture tile covers
 * across (x) and down (y). Grain runs along the part's x on the top and front faces. Call after
 * the geometry is in its final place.
 */
export function boxProjectUV(geo: THREE.BufferGeometry, tileM: readonly [number, number]): void {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = x;
      v = z;
    } else if (az >= ax) {
      u = x;
      v = y;
    } else {
      u = z;
      v = y;
    }
    uv[i * 2] = u / tileM[0];
    uv[i * 2 + 1] = v / tileM[1];
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/** Moves `geo` in place and returns it. */
export function moved<T extends THREE.BufferGeometry>(geo: T, x: number, y: number, z: number): T {
  geo.translate(x, y, z);
  return geo;
}

/**
 * Merges pieces into one geometry (one draw call): position, normal and uv only. The inputs are
 * disposed. Pieces may be indexed or not.
 */
export function mergePieces(geos: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geos.map((g) => {
    const out = g.index ? g.toNonIndexed() : g;
    if (out !== g) g.dispose();
    for (const name of Object.keys(out.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") out.deleteAttribute(name);
    }
    if (!out.getAttribute("uv")) {
      out.setAttribute(
        "uv",
        new THREE.BufferAttribute(new Float32Array(out.getAttribute("position").count * 2), 2),
      );
    }
    return out;
  });
  const merged = mergeGeometries(flat, false);
  for (const g of flat) g.dispose();
  return merged ?? new THREE.BufferGeometry();
}
