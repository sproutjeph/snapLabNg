import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { createHullRegistry } from "./hullRegistry";
import { INK_THICKNESS_PX } from "./InkEffect";

// Low-tier ink (docs/plans/ink-look.md): drives the hull registry (hullRegistry.ts) for the
// canvas's scene. No post pass on this tier.

/** How often new meshes (a kit that mounts late, a lead the student adds) are picked up. */
const SCAN_S = 0.5;

/** Adds and keeps ink hulls on every inkable mesh of the scene while `enabled`. */
export function useInkHulls(enabled: boolean): void {
  const scene = useThree((s) => s.scene);
  const hulls = useMemo(() => createHullRegistry(INK_THICKNESS_PX), []);

  useEffect(() => {
    if (!enabled) return;
    hulls.timer = 0;
    return () => hulls.detach();
  }, [enabled, hulls]);

  useEffect(() => () => hulls.dispose(), [hulls]);

  useFrame((frame, delta) => {
    if (!enabled) return;
    frame.gl.getDrawingBufferSize(hulls.shared.inkResolution.value);
    hulls.shared.inkWidth.value = INK_THICKNESS_PX * frame.gl.getPixelRatio();
    hulls.timer -= delta;
    if (hulls.timer <= 0) {
      hulls.timer = SCAN_S;
      hulls.scan(scene);
    }
    hulls.sync();
  });
}
