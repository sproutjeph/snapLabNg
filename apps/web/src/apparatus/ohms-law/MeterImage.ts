import * as THREE from "three";
import { DIAL } from "./MeterDial";

// The mirror strip of a moving-coil meter shows a dim copy of the needle, as far behind the face
// as the needle floats in front of it. The student lines the pointer up with its image so her eye
// is square to the dial (docs/plans/ohms-law-vi.md, Readings). Pure appearance: no value here.

/** The needle floats this far above the dial: real parallax. */
export const NEEDLE_LIFT = 0.0045;
/** The dial paper's bottom edge, and the front of the case, in the meter's own frame (metres). */
export const METER_DIAL_Y = 0.032;
export const METER_FACE_Z = 0.025;
/** The mirror strip sits this far above the dial paper. */
export const MIRROR_LIFT = 0.0004;
/** Where the loupe looks: the middle of the dial paper, in the meter's own frame. */
export const METER_DIAL_CENTER = {
  y: METER_DIAL_Y + DIAL.height / 2,
  z: METER_FACE_Z + 0.0002,
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

// Draws only inside the mirror arc (radius band and angle about the pivot, in the dial's own
// frame) and only when the eye is in front of the dial. No stencil buffer is needed, so it works
// the same through any post-processing stack.
const FRAG = /* glsl */ `
precision highp float;
uniform mat4 uToDial;
uniform vec3 uColour;
uniform float uOpacity;
uniform float uInner;
uniform float uOuter;
uniform float uHalfAngle;
varying vec3 vWorld;
void main() {
  vec3 p = (uToDial * vec4(vWorld, 1.0)).xyz;
  vec3 eye = (uToDial * vec4(cameraPosition, 1.0)).xyz;
  float r = length(p.xy);
  if (eye.z <= 0.0 || r < uInner || r > uOuter) discard;
  if (abs(atan(p.x, max(p.y, 1e-5))) > uHalfAngle) discard;
  gl_FragColor = vec4(uColour, uOpacity);
}`;

export interface MirrorImage {
  material: THREE.ShaderMaterial;
  /** Call from the image mesh's onBeforeRender with the non-rotating pivot group. */
  syncPivot(pivot: THREE.Object3D): void;
}

export function createMirrorImage(): MirrorImage {
  const toDial = new THREE.Matrix4();
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uToDial: { value: toDial },
      uColour: { value: new THREE.Color("#15110d") },
      uOpacity: { value: 0.45 },
      uInner: { value: DIAL.mirrorInner },
      uOuter: { value: DIAL.mirrorOuter },
      uHalfAngle: { value: (43 * Math.PI) / 180 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return {
    material,
    syncPivot(pivot) {
      toDial.copy(pivot.matrixWorld).invert();
    },
  };
}
