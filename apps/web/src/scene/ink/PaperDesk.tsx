import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";

export interface PaperDeskProps {
  quality: QualityTier;
  /** World size of the desk top, in metres. */
  size?: readonly [number, number];
  /** Height of the desk top (y). */
  y?: number;
}

/**
 * The warm-paper desk under every bench (docs/plans/ink-look.md). STUB (Wave 0): a flat
 * paper-coloured plane; the ink slice adds the faint ruled lines and lighting. Props frozen.
 */
export function PaperDesk({ size = [2.4, 1.6], y = 0 }: PaperDeskProps) {
  const [w, d] = size;
  const res = useMemo(() => {
    const geo = new THREE.PlaneGeometry(w, d);
    const mat = new THREE.MeshStandardMaterial({ color: "#f4ecdc", roughness: 0.95 });
    return { geo, mat };
  }, [w, d]);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [res],
  );
  return (
    <mesh
      geometry={res.geo}
      material={res.mat}
      rotation-x={-Math.PI / 2}
      position-y={y}
      receiveShadow
    />
  );
}
