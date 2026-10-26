import * as THREE from "three";
import type { Mat3 } from "../capture/types";
import { INK_FRAGMENT } from "./ink";

/** Flattened page size: exercise-book proportions (≈ 1 : 1.414), long side 1448 px. */
export const PAGE_W = 1024;
export const PAGE_H = 1448;
/** The ink mask is 1024 px on its long side (docs/04 §2 ①). */
export const INK_W = 724;
export const INK_H = 1024;

/** A row-major homography as a three.js Matrix3 (which stores column-major for GLSL). */
export function toMatrix3(h: Mat3): THREE.Matrix3 {
  return new THREE.Matrix3().set(h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], h[8]);
}

const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Page pixel (u, v), v measured down from the top, maps through H to photo pixels.
// The photo texture is uploaded without flipY, so its first row (the top) is t = 0.
const RECTIFY_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uPhoto;
uniform mat3 uH;
uniform vec2 uPhotoSize;
varying vec2 vUv;
void main() {
  vec3 p = uH * vec3(vUv.x, 1.0 - vUv.y, 1.0);
  vec2 px = p.xy / (abs(p.z) < 1e-5 ? 1e-5 : p.z);
  vec2 st = px / uPhotoSize;
  if (st.x < 0.0 || st.y < 0.0 || st.x > 1.0 || st.y > 1.0) {
    gl_FragColor = vec4(1.0);
    return;
  }
  gl_FragColor = vec4(texture2D(uPhoto, st).rgb, 1.0);
}
`;

export interface RectifiedPage {
  /**
   * The flattened page, PAGE_W × PAGE_H, top of the page at the top (standard UVs).
   * Both targets hold the photo's raw sRGB values with no colour space set: a 3D
   * consumer must tag the texture SRGBColorSpace, not treat it as linear.
   */
  page: THREE.WebGLRenderTarget;
  /** Ink in alpha (rgb = page colour), INK_W × INK_H. */
  ink: THREE.WebGLRenderTarget;
  dispose(): void;
}

function makeTarget(w: number, h: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
  });
}

/**
 * Flattens the photographed page with the capture homography and extracts the ink
 * mask, in two GPU passes (docs/04 §2 ①). Runs once per snap, not per frame.
 */
export function rectifyPage(
  gl: THREE.WebGLRenderer,
  photo: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
  photoWidth: number,
  photoHeight: number,
  homography: Mat3,
): RectifiedPage {
  const photoTex = new THREE.Texture(photo);
  photoTex.flipY = false;
  photoTex.generateMipmaps = false;
  photoTex.minFilter = THREE.LinearFilter;
  photoTex.needsUpdate = true;

  const page = makeTarget(PAGE_W, PAGE_H);
  const ink = makeTarget(INK_W, INK_H);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const rectifyMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: RECTIFY_FRAGMENT,
    uniforms: {
      uPhoto: { value: photoTex },
      uH: { value: toMatrix3(homography) },
      uPhotoSize: { value: new THREE.Vector2(photoWidth, photoHeight) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const inkMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: INK_FRAGMENT,
    uniforms: {
      uPage: { value: page.texture },
      uTexel: { value: new THREE.Vector2(1 / PAGE_W, 1 / PAGE_H) },
    },
    depthTest: false,
    depthWrite: false,
  });

  const previous = gl.getRenderTarget();
  quad.material = rectifyMat;
  gl.setRenderTarget(page);
  gl.render(quad, camera);
  quad.material = inkMat;
  gl.setRenderTarget(ink);
  gl.render(quad, camera);
  gl.setRenderTarget(previous);

  photoTex.dispose();
  rectifyMat.dispose();
  inkMat.dispose();
  quad.geometry.dispose();

  return {
    page,
    ink,
    dispose() {
      page.dispose();
      ink.dispose();
    },
  };
}
