import * as THREE from "three";

// Small geometry helpers for the V–I bench's box, key and cells. Sizes in metres.

/**
 * Multiplies a geometry's uv by (su, sv), in place, so a tiling texture repeats on it: a lathe's
 * uv run 0..1 round and along, so `su` whole repeats round a knob keep its texture seamless.
 */
export function scaleUV(geo: THREE.BufferGeometry, su: number, sv: number): void {
  const uv = geo.getAttribute("uv");
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

/** Moves a geometry's uv by (du, dv), in place, so parts that share a texture show other parts of it. */
export function offsetUV(geo: THREE.BufferGeometry, du: number, dv: number): void {
  const uv = geo.getAttribute("uv");
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
  uv.needsUpdate = true;
}

/**
 * Gives every triangle a flat uv from the axis its face looks along (the part's x, y or z), at
 * `tileM` metres a tile. The geometry becomes non-indexed (each triangle owns its vertices), so
 * one triangle's projection never blends into the next: on a speckle the seams cannot be seen,
 * and a dome has no pole where the texture pinches into a starburst. Returns the geometry to use.
 */
export function projectUVPerTriangle(
  geo: THREE.BufferGeometry,
  tileM: number,
): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  if (flat !== geo) geo.dispose();
  const pos = flat.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let t = 0; t + 2 < pos.count; t += 3) {
    const e1x = pos.getX(t + 1) - pos.getX(t);
    const e1y = pos.getY(t + 1) - pos.getY(t);
    const e1z = pos.getZ(t + 1) - pos.getZ(t);
    const e2x = pos.getX(t + 2) - pos.getX(t);
    const e2y = pos.getY(t + 2) - pos.getY(t);
    const e2z = pos.getZ(t + 2) - pos.getZ(t);
    const nx = Math.abs(e1y * e2z - e1z * e2y);
    const ny = Math.abs(e1z * e2x - e1x * e2z);
    const nz = Math.abs(e1x * e2y - e1y * e2x);
    for (let j = 0; j < 3; j++) {
      const x = pos.getX(t + j);
      const y = pos.getY(t + j);
      const z = pos.getZ(t + j);
      const horizontal = ny >= nx && ny >= nz;
      const u = horizontal || nz >= nx ? x : z;
      const v = horizontal ? z : y;
      uv[(t + j) * 2] = u / tileM;
      uv[(t + j) * 2 + 1] = v / tileM;
    }
  }
  flat.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return flat;
}

/** A lathe from (radius, height) pairs, standing on y = 0, `segments` round. */
export function latheOf(
  profile: ReadonlyArray<readonly [number, number]>,
  segments: number,
): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly length: number,
    private readonly turns: number,
    private readonly radius: number,
  ) {
    super();
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set(t * this.length, Math.cos(a) * this.radius, Math.sin(a) * this.radius);
  }
}

/**
 * A coil spring of round wire along +x from x = 0 to `length`: `turns` turns of radius `coilR`
 * about the x axis, wire of radius `wireR` with `radial` sides round it (8 or more keeps it round
 * under the ink pass), and `perTurn` steps along each turn. Starts at (0, coilR, 0).
 */
export function helixTube(
  length: number,
  turns: number,
  coilR: number,
  wireR: number,
  perTurn: number,
  radial: number,
): THREE.TubeGeometry {
  const steps = Math.max(4, Math.round(turns * perTurn));
  return new THREE.TubeGeometry(new HelixCurve(length, turns, coilR), steps, wireR, radial, false);
}
