import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";

export interface GlassGlintsProps {
  /** Radius at the top and bottom of the glass wall the glint hugs, in metres. */
  rTop: number;
  rBottom: number;
  height: number;
  position?: readonly [number, number, number];
  /** Angle of the window reflection around the glass axis (0 faces +z, towards the viewer). */
  theta?: number;
  quality: QualityTier;
}

const noRay = () => null;

/**
 * Two thin white streaks sitting just outside a glass wall: the window reflection a real flask,
 * beaker or burette shows. They are part of the model's look only (no value, no raycast).
 */
export function GlassGlints({
  rTop,
  rBottom,
  height,
  position = [0, 0, 0],
  theta = 0.55,
  quality,
}: GlassGlintsProps) {
  const res = useMemo(() => {
    const seg = quality === "low" ? 1 : 2;
    const wide = new THREE.CylinderGeometry(
      rTop * 1.012,
      rBottom * 1.012,
      height * 0.86,
      seg,
      1,
      true,
      theta - 0.1,
      0.2,
    );
    const thin = new THREE.CylinderGeometry(
      rTop * 1.012,
      rBottom * 1.012,
      height * 0.7,
      seg,
      1,
      true,
      theta + 0.26,
      0.06,
    );
    const mat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    return { wide, thin, mat };
  }, [rTop, rBottom, height, theta, quality]);

  useEffect(
    () => () => {
      res.wide.dispose();
      res.thin.dispose();
      res.mat.dispose();
    },
    [res],
  );

  return (
    <group position={[position[0], position[1] + height / 2, position[2]]}>
      <mesh geometry={res.wide} material={res.mat} raycast={noRay} renderOrder={3} />
      <mesh geometry={res.thin} material={res.mat} raycast={noRay} renderOrder={3} />
    </group>
  );
}
