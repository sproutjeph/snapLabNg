import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { INK_HEX } from "../scene/ink/palette";
import type { RevealPhases } from "./reveal";

/** How far her ink darkens towards the pen ink at the peak, and where it settles. */
const LIFT_PEAK = 0.85;
const LIFT_REST = 0.35;

/**
 * Her flattened page on the bench. As the reveal starts, her ink (the dark pixels) darkens
 * towards the blue-black pen ink, as if fresh, then eases back a little once the motes have
 * lifted off. A colour blend on the paper, not light: nothing glows.
 */
export function PageSheet({
  url,
  width,
  height,
  position,
  phases,
}: {
  url: string;
  width: number;
  height: number;
  position: readonly [number, number, number];
  phases: { current: RevealPhases };
}) {
  const map = useTexture(url);
  const { geometry, material, uniforms } = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const uniforms = { uLift: { value: 0 }, uInk: { value: new THREE.Color(INK_HEX) } };
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.92 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uLift = uniforms.uLift;
      shader.uniforms.uInk = uniforms.uInk;
      shader.fragmentShader =
        `uniform float uLift;\nuniform vec3 uInk;\n${shader.fragmentShader}`.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        float pageLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float inkAmount = 1.0 - smoothstep(0.30, 0.55, pageLum);
        diffuseColor.rgb = mix(diffuseColor.rgb, uInk, inkAmount * uLift);`,
        );
    };
    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.rotateX(-Math.PI / 2);
    return { geometry, material, uniforms };
  }, [map, width, height]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  // drei caches every loaded texture; one page per snap would otherwise pile up.
  useEffect(() => () => useTexture.clear(url), [url]);

  useFrame(() => {
    const p = phases.current;
    uniforms.uLift.value = p.glow * (LIFT_PEAK - (LIFT_PEAK - LIFT_REST) * p.sparks);
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[position[0], position[1], position[2]]}
      receiveShadow
    />
  );
}
