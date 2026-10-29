import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { NO_INK } from "../ink/inkPass";
import { PAPER_HEX } from "../ink/palette";
import { DeskProps } from "./DeskProps";
import { useLookTier } from "./lookTier";
import type { LookGroundProps } from "./types";

// The paper desk (docs/plans/exam-redesign.md, "The look": ground). A shader draws cream graph
// paper: a faint grid every GRID_M, a fainter one every GRID_FINE_M, both anti-aliased with
// fwidth, and a light paper grain. It is unlit, so it matches the --paper background exactly,
// and fades into it toward its edge. A ShadowMaterial catcher (#5b4027 at .42, stronger than the plan's .22 at the user's golden-frame review) takes the key
// light's soft shadows when the canvas has shadows. The exam desk's things (answer booklet,
// pencil, eraser, calculator) lie at its front edge as ink props. Nothing here writes depth or
// draws ink outlines of its own, apart from the props.

/** Graph-paper squares, in metres. */
export const GRID_M = 0.05;
export const GRID_FINE_M = 0.01;
export const GRID_COLOUR = "#c4b292";
export const SHADOW_CATCHER_COLOUR = "#5b4027";
export const SHADOW_CATCHER_OPACITY = 0.42;
const DEFAULT_SIZE_M = 8;

const vertexShader = /* glsl */ `
varying vec2 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
uniform vec3 paper;
uniform vec3 grid;
uniform float gridM;
uniform float fineM;
uniform float halfSize;
varying vec2 vWorld;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// 1 on a line every 'step' metres, widthPx screen pixels wide, anti-aliased.
float gridLine(vec2 p, float stepM, float widthPx) {
  vec2 q = p / max(stepM, 1e-5);
  vec2 d = abs(fract(q - 0.5) - 0.5);
  vec2 aa = max(fwidth(q), vec2(1e-5));
  vec2 l = 1.0 - smoothstep(aa * (widthPx * 0.5 - 0.5), aa * (widthPx * 0.5 + 0.5), d);
  // Lines thinner than a pixel on screen fade out instead of shimmering.
  vec2 seen = 1.0 - smoothstep(0.08, 0.3, aa);
  return max(l.x * seen.x, l.y * seen.y);
}

void main() {
  float major = gridLine(vWorld, gridM, 1.1);
  float edge = 1.0 - smoothstep(halfSize * 0.55, halfSize * 0.95, max(abs(vWorld.x), abs(vWorld.y)));
#ifdef PAPER_GRAIN
  float fine = gridLine(vWorld, fineM, 0.8);
  // Paper grain: fibres at about a millimetre, and a slow tone across the sheet.
  float grain = noise(vWorld * 900.0) * 0.6 + noise(vWorld * 2300.0) * 0.4;
  float tone = noise(vWorld * 3.0);
  vec3 col = paper * (1.0 + (grain - 0.5) * 0.035 + (tone - 0.5) * 0.02);
  float a = max(major * 0.36, fine * 0.12) * edge;
#else
  // Low tier: the grid alone, a quarter of the work per pixel.
  vec3 col = paper;
  float a = major * 0.36 * edge;
#endif
  col = mix(col, grid, a);
  col = mix(paper, col, edge);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function LookGround({ sizeM = DEFAULT_SIZE_M }: LookGroundProps) {
  const shadows = useThree((s) => s.gl.shadowMap.enabled);
  const grain = useLookTier() !== "low";
  const res = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(sizeM, sizeM);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      name: "LookGround",
      vertexShader,
      fragmentShader,
      uniforms: {
        paper: { value: new THREE.Color(PAPER_HEX) },
        grid: { value: new THREE.Color(GRID_COLOUR) },
        gridM: { value: GRID_M },
        fineM: { value: GRID_FINE_M },
        halfSize: { value: sizeM / 2 },
      },
      depthWrite: false,
    });
    if (grain) material.defines = { PAPER_GRAIN: 1 };
    const catcher = new THREE.ShadowMaterial({
      color: SHADOW_CATCHER_COLOUR,
      opacity: SHADOW_CATCHER_OPACITY,
      depthWrite: false,
    });
    return { geometry, material, catcher };
  }, [sizeM, grain]);
  useEffect(
    () => () => {
      res.geometry.dispose();
      res.material.dispose();
      res.catcher.dispose();
    },
    [res],
  );
  const noInk = { [NO_INK]: true };
  return (
    <group>
      <mesh geometry={res.geometry} material={res.material} renderOrder={-10} userData={noInk} />
      {shadows && (
        <mesh
          geometry={res.geometry}
          material={res.catcher}
          position-y={0.0005}
          renderOrder={-9}
          receiveShadow
          userData={noInk}
        />
      )}
      <DeskProps />
    </group>
  );
}
