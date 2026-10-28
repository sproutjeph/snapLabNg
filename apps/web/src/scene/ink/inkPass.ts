import * as THREE from "three";
import { readInk } from "./ink";
import fragmentShader from "./ink-id.frag.glsl?raw";
import vertexShader from "./ink-id.vert.glsl?raw";

// The ink-ID pass (docs/plans/ink-look.md): the scene drawn once more with one override
// material into a small target, writing each mesh's view-space normal and ink tag. The outline
// effect finds creases and part boundaries in it. The material reads `userData.ink` per object
// in `onBeforeRender`, so the apparatus needs no ink-specific materials.

/** Set `userData.noInk = true` on a mesh to keep it out of the ink pass (the paper desk). */
export const NO_INK = "noInk";

type AnyMaterial = THREE.Material & {
  map?: THREE.Texture | null;
};

/**
 * Meshes that must not draw ink: non-meshes (lines, points, sprites), troika text, additive
 * sparks and glows, invisible hit boxes (opacity 0), and alpha-mapped decals that do not write
 * depth (labels lying on a part would otherwise draw their quad).
 */
export function skipsInk(object: THREE.Object3D, material: THREE.Material | undefined): boolean {
  if (!(object as THREE.Mesh).isMesh) return true;
  if (object.userData[NO_INK] === true) return true;
  if ((object as { isTroikaText?: boolean }).isTroikaText) return true;
  if (!material) return false;
  const m = material as AnyMaterial;
  if (!m.colorWrite) return true;
  if (m.blending === THREE.AdditiveBlending) return true;
  if (m.transparent && m.opacity < 0.05) return true;
  if (m.transparent && !m.depthWrite && m.map) return true;
  return false;
}

/** id * 2 + thin: one exact half-float channel. Untagged meshes are id 0. */
export function inkCode(object: THREE.Object3D): number {
  const tag = readInk(object);
  if (!tag) return 0;
  const id = Math.max(0, Math.min(255, Math.round(tag.id)));
  return id * 2 + (tag.thin ? 1 : 0);
}

function materialOf(object: THREE.Object3D, group: THREE.Group | null): THREE.Material | undefined {
  const m = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
  if (!Array.isArray(m)) return m;
  const index = (group as unknown as { materialIndex?: number } | null)?.materialIndex ?? 0;
  return m[index];
}

type Clippable = THREE.Material & {
  clippingPlanes: THREE.Plane[] | null;
  clipIntersection: boolean;
};

export function createInkIdMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    name: "InkIdMaterial",
    vertexShader,
    fragmentShader,
    uniforms: {
      inkCode: { value: 0 },
      inkSkip: { value: 0 },
    },
    blending: THREE.NoBlending,
    clipping: true,
  });
  const uniforms = material.uniforms as {
    inkCode: { value: number };
    inkSkip: { value: number };
  };
  material.onBeforeRender = (renderer, _scene, camera, _geometry, object, group) => {
    const source = materialOf(object, group as unknown as THREE.Group | null) as
      | Clippable
      | undefined;
    uniforms.inkSkip.value = skipsInk(object, source) ? 1 : 0;
    uniforms.inkCode.value = inkCode(object);
    // Cull like the object does, so faces the scene never shows (the underside of a part
    // that is still below its clip line) draw no ink either.
    material.side = source?.side ?? THREE.FrontSide;
    // Follow the object's clipping planes, so a kit that is still rising draws no ink above
    // its clip line.
    const planes = source?.clippingPlanes ?? null;
    if (material.clippingPlanes !== planes) material.clippingPlanes = planes;
    material.clipIntersection = source?.clipIntersection ?? false;
    if (planes && planes.length > 0) writeViewPlanes(renderer, material, camera, planes);
    material.uniformsNeedUpdate = true;
  };
  return material;
}

const viewPlane = new THREE.Plane();
const viewNormal = new THREE.Matrix3();

/**
 * Three caches a material's view-space clipping planes and, when the same material draws twice
 * in a row (always, for an override material), reuses them without re-projecting. Here every
 * object brings its own planes and the camera and clip line move, so the cached array is
 * rewritten in place per object. Once three has made the array (the first clipped draw), this
 * allocates nothing. No global renderer.clippingPlanes are used in these scenes (offset 0).
 */
function writeViewPlanes(
  renderer: THREE.WebGLRenderer,
  material: THREE.Material,
  camera: THREE.Camera,
  planes: THREE.Plane[],
): void {
  const props = renderer.properties.get(material) as { clippingState?: Float32Array | null };
  const out = props.clippingState;
  if (!out || out.length < planes.length * 4 || renderer.clippingPlanes.length > 0) return;
  viewNormal.getNormalMatrix(camera.matrixWorldInverse);
  for (let i = 0; i < planes.length; i++) {
    const p = planes[i];
    if (!p) continue;
    viewPlane.copy(p).applyMatrix4(camera.matrixWorldInverse, viewNormal);
    out[i * 4] = viewPlane.normal.x;
    out[i * 4 + 1] = viewPlane.normal.y;
    out[i * 4 + 2] = viewPlane.normal.z;
    out[i * 4 + 3] = viewPlane.constant;
  }
}

const prevClear = new THREE.Color();

/**
 * Draws the ink-ID pass of `scene` into `target`: no background, no shadow-map update, cleared
 * to zero. Restores everything it touches. Allocates nothing.
 */
export function renderInkPass(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  material: THREE.Material,
  target: THREE.WebGLRenderTarget,
): void {
  const background = scene.background;
  const override = scene.overrideMaterial;
  const shadows = renderer.shadowMap.enabled;
  const autoClear = renderer.autoClear;
  renderer.getClearColor(prevClear);
  const prevAlpha = renderer.getClearAlpha();

  scene.background = null;
  scene.overrideMaterial = material;
  renderer.shadowMap.enabled = false;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(target);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);

  scene.background = background;
  scene.overrideMaterial = override;
  renderer.shadowMap.enabled = shadows;
  renderer.autoClear = autoClear;
  renderer.setClearColor(prevClear, prevAlpha);
}
