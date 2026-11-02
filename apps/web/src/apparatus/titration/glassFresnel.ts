import type * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";

/**
 * Cheap fresnel for the lab glass: toward the silhouette the wall gets darker, a faint
 * green-blue and more opaque, as thick glass seen edge-on does. Patches the standard fragment
 * shader of the given material (vNormal and vViewPosition exist there); it adds no uniform and no
 * texture. The low tier keeps the plain material.
 */
export function glassFresnel<M extends THREE.MeshStandardMaterial>(
  mat: M,
  quality: QualityTier,
): M {
  if (quality === "low") return mat;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `float glassFres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.20, 0.34, 0.36), clamp(glassFres * 0.85, 0.0, 0.85));
      gl_FragColor.a = clamp(gl_FragColor.a + glassFres * 0.5, 0.0, 0.9);
      #include <dithering_fragment>`,
    );
  };
  mat.customProgramCacheKey = () => "titration-glass-fresnel";
  return mat;
}
