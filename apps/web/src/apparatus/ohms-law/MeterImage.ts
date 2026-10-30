import * as THREE from "three";
import { DIAL } from "./MeterDial";

// The mirror strip of a moving-coil meter shows a dim copy of the needle, as far behind the face
// as the needle floats in front of it. The student lines the pointer up with its image so her eye
// is square to the dial (docs/plans/ohms-law-vi.md, Readings). Pure appearance: no value here.

/** The needle floats this far above the dial: real parallax. */
export const NEEDLE_LIFT = 0.0024;
/** The round dial paper's bottom edge, and the front of the case, in the meter's own frame (metres). */
export const METER_DIAL_Y = 0.033;
export const METER_FACE_Z = 0.025;
/** The dial paper stands this far off the face, inside the bezel. */
export const METER_DIAL_LIFT = 0.0015;
/** The mirror strip sits this far above the dial paper. */
export const MIRROR_LIFT = 0.0004;
/** Where the loupe looks: the middle of the dial paper, in the meter's own frame. */
export const METER_DIAL_CENTER = {
  y: METER_DIAL_Y + DIAL.radius,
  z: METER_FACE_Z + METER_DIAL_LIFT,
} as const;

/** The image is the needle reflected in the mirror strip (relative to the dial plane). */
export const IMAGE_Z = -(NEEDLE_LIFT - 2 * MIRROR_LIFT);

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// What the eye sees in the strip is where the eye-to-image ray crosses the mirror plane, so the
// clip to the arc is taken at that crossing (not at the image's own xy), and the fragment gets
// the depth of that crossing: the face, a lead or the bezel in front of the strip still hide it.
// No stencil buffer is needed, so it works the same through any post-processing stack. It writes
// colour only (never depth), so a depth-reading outline pass is not disturbed.
const FRAG = /* glsl */ `
precision highp float;
uniform mat4 uToDial;
uniform mat4 uFromDial;
uniform mat4 uViewProj;
uniform vec3 uColour;
uniform float uOpacity;
uniform float uInner;
uniform float uOuter;
uniform float uHalfAngle;
uniform float uMirrorZ;
uniform float uBias;
varying vec3 vWorld;
void main() {
  vec3 f = (uToDial * vec4(vWorld, 1.0)).xyz;
  vec3 e = (uToDial * vec4(cameraPosition, 1.0)).xyz;
  float dz = f.z - e.z;
  if (e.z <= uMirrorZ || abs(dz) < 1e-7) discard;
  float t = (uMirrorZ - e.z) / dz;
  vec3 hit = e + t * (f - e);
  float r = length(hit.xy);
  if (t < 0.0 || t > 1.0 || r < uInner || r > uOuter) discard;
  if (abs(atan(hit.x, max(hit.y, 1e-5))) > uHalfAngle) discard;
  vec4 clip = uViewProj * (uFromDial * vec4(hit, 1.0));
  gl_FragDepth = clamp(clip.z / max(clip.w, 1e-5) * 0.5 + 0.5 - uBias, 0.0, 1.0);
  gl_FragColor = vec4(uColour, uOpacity);
}`;

export interface MirrorImage {
  material: THREE.ShaderMaterial;
  /** Call from the image mesh's onBeforeRender with the non-rotating pivot group and the camera. */
  syncPivot(pivot: THREE.Object3D, camera: THREE.Camera): void;
}

export function createMirrorImage(): MirrorImage {
  const toDial = new THREE.Matrix4();
  const fromDial = new THREE.Matrix4();
  const viewProj = new THREE.Matrix4();
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uToDial: { value: toDial },
      uFromDial: { value: fromDial },
      uViewProj: { value: viewProj },
      uColour: { value: new THREE.Color("#15110d") },
      uOpacity: { value: 0.45 },
      uInner: { value: DIAL.mirrorInner },
      uOuter: { value: DIAL.mirrorOuter },
      uHalfAngle: { value: (43 * Math.PI) / 180 },
      uMirrorZ: { value: MIRROR_LIFT },
      uBias: { value: 1.5e-4 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return {
    material,
    syncPivot(pivot, camera) {
      fromDial.copy(pivot.matrixWorld);
      toDial.copy(fromDial).invert();
      viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    },
  };
}
