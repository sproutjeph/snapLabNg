import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { RevealPhases } from "./reveal";

/** Above 1, so bloom picks the glowing ink up on the tiers that have bloom. */
const GLOW_COLOUR = new THREE.Color(0.25, 1.1, 1.7);

/**
 * Her flattened page on the bench. Its ink (the dark pixels) glows as the reveal starts and
 * settles to a faint shimmer once the sparks have lifted off.
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
    const uniforms = { uGlow: { value: 0 }, uGlowColour: { value: GLOW_COLOUR } };
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.92 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGlow = uniforms.uGlow;
      shader.uniforms.uGlowColour = uniforms.uGlowColour;
      shader.fragmentShader =
        `uniform float uGlow;\nuniform vec3 uGlowColour;\n${shader.fragmentShader}`.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
        float pageLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float inkAmount = 1.0 - smoothstep(0.30, 0.55, pageLum);
        totalEmissiveRadiance += uGlowColour * inkAmount * uGlow;`,
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
    uniforms.uGlow.value = 0.7 * p.glow * (1 - 0.9 * p.sparks);
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
