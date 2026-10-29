import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { NO_INK } from "../ink/inkPass";
import type { BlobShadowProps } from "./types";

// A soft radial shadow under a part (docs/plans/exam-redesign.md, "The look": light). On mid and
// high it sits under the real shadow and grounds the part where the shadow map is thin; on low
// it is the only shadow. Warm brown, not ink: #5b4027, like the shadow catcher. It writes no
// depth and draws no ink.

export const BLOB_COLOUR = "#5b4027";
/** Give the radius about 1.4× the part's half-diagonal, so the blob shows round its foot. */
export const BLOB_OPACITY = 0.32;
/** Lifted off the desk just enough not to fight it. */
const LIFT_M = 0.0008;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
uniform vec3 blobColour;
uniform float blobOpacity;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  // Densest under the part, easing out to nothing at the rim.
  float a = 1.0 - smoothstep(0.0, 1.0, r);
  a = sqrt(a) * a;
  gl_FragColor = vec4(blobColour, a * blobOpacity);
  #include <colorspace_fragment>
}
`;

export function BlobShadow({ position, radiusM, opacity = BLOB_OPACITY }: BlobShadowProps) {
  const res = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2, 2);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      name: "BlobShadow",
      vertexShader,
      fragmentShader,
      uniforms: {
        blobColour: { value: new THREE.Color(BLOB_COLOUR) },
        // Written below on every render, so a new opacity needs no new material.
        blobOpacity: { value: BLOB_OPACITY },
      },
      transparent: true,
      depthWrite: false,
    });
    return { geometry, material };
  }, []);
  (res.material.uniforms.blobOpacity as { value: number }).value = opacity;
  useEffect(
    () => () => {
      res.geometry.dispose();
      res.material.dispose();
    },
    [res],
  );
  const r = Math.max(1e-3, radiusM);
  return (
    <mesh
      geometry={res.geometry}
      material={res.material}
      position={[position[0], position[1] + LIFT_M, position[2]]}
      scale={[r, 1, r]}
      renderOrder={-5}
      userData={{ [NO_INK]: true }}
    />
  );
}
