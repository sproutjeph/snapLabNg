import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { outlineFor } from "../../quality/tier";
import { InkEffect } from "./InkEffect";
import { advanceInkFocus } from "./inkFocus";
import { useInkHulls } from "./inkHull";

export interface InkComposerProps {
  quality: QualityTier;
  /** 0 → 1 while the outlines draw themselves on; omitted means fully drawn. A ref, read per frame. */
  reveal?: { current: number };
}

interface Stack {
  composer: EffectComposer;
  effect: InkEffect;
  width: number;
  height: number;
  pixelRatio: number;
}

/**
 * The post-processing stack for every canvas (docs/plans/ink-look.md). No bloom.
 *   - High and mid: the scene, then the ink outline effect (depth, normal and ink-ID edges; the
 *     ID target at full and 0.75× size). It takes over the render loop (useFrame priority 1).
 *   - Low (and any device that cannot render to half-float targets): no post pass at all;
 *     inverted-hull lines on the parts (inkHull.ts), and r3f renders.
 * Tone mapping is off on every tier, so the paper is exactly --paper. The props are frozen.
 * `reveal` drives the draw-on sweep (ink-sweep.glsl) on both paths; its origin is set with
 * setInkSweep (inkSweep.ts).
 */
export function InkComposer({ quality, reveal }: InkComposerProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const stack = useRef<Stack | null>(null);
  const outline = outlineFor(quality);
  const { scale, multisampling } = outline;
  // The ID target is half float; without float colour-buffer targets, fall back to the hulls.
  const floatTargets = useMemo(
    () =>
      gl.extensions.has("EXT_color_buffer_float") ||
      gl.extensions.has("EXT_color_buffer_half_float"),
    [gl],
  );
  const mode = floatTargets ? outline.mode : "hull";
  const post = mode === "ink";

  useInkHulls(mode === "hull", reveal);

  useEffect(() => {
    const prev = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      gl.toneMapping = prev;
    };
  }, [gl]);

  useEffect(() => {
    if (!post) return;
    // The composer turns autoClear off (its passes clear); r3f gets it back on unmount.
    const autoClear = gl.autoClear;
    const composer = new EffectComposer(gl, {
      multisampling: Math.min(multisampling, gl.capabilities.maxSamples),
      // No bloom and no tone mapping, so no HDR to keep: 8-bit (sRGB-encoded) scene buffers.
      frameBufferType: THREE.UnsignedByteType,
    });
    const effect = new InkEffect(scene, camera, scale);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new EffectPass(camera, effect));
    stack.current = { composer, effect, width: -1, height: -1, pixelRatio: -1 };
    return () => {
      stack.current = null;
      // Disposes the passes, the effect's target and material, and the composer's buffers.
      composer.dispose();
      gl.autoClear = autoClear;
    };
  }, [gl, scene, camera, post, scale, multisampling]);

  useFrame(
    (state, delta) => {
      const s = stack.current;
      if (!s) return;
      advanceInkFocus(delta);
      const { width, height } = state.size;
      const pixelRatio = state.gl.getPixelRatio();
      if (width !== s.width || height !== s.height || pixelRatio !== s.pixelRatio) {
        s.composer.setSize(width, height, false);
        s.width = width;
        s.height = height;
        s.pixelRatio = pixelRatio;
      }
      s.effect.reveal.value = reveal ? Math.min(1, Math.max(0, reveal.current)) : 1;
      s.composer.render(delta);
    },
    // Priority 1 takes over rendering from r3f; 0 leaves it to r3f (the low tier).
    post ? 1 : 0,
  );

  return null;
}
