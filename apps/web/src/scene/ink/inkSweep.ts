import * as THREE from "three";

// The draw-on sweep's origin and reach (ink-sweep.glsl), shared by the outline effect and the
// low-tier hulls. One set per page: the hero reveal (lab/RevealClip.tsx) writes them; every
// other canvas draws fully (reveal 1) and never reads them. Made once, written through `.value`.

export const inkSweepUniforms = {
  inkSweepOrigin: new THREE.Uniform(new THREE.Vector3()),
  inkSweepReach: new THREE.Uniform(1),
};

/** Points the sweep: it starts at `origin` and has passed everything within `reach` metres. */
export function setInkSweep(x: number, y: number, z: number, reach: number): void {
  inkSweepUniforms.inkSweepOrigin.value.set(x, y, z);
  inkSweepUniforms.inkSweepReach.value = Math.max(reach, 1e-3);
}
