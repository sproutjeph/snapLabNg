import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BRIDGE_WIRE, cmToX, JOCKEY_DIMS } from "./dimensions";
import type { MeterBridgeVisualState, QualityTier } from "./types";

export interface TubeWireProps {
  start: readonly [number, number, number];
  end: readonly [number, number, number];
  via?: ReadonlyArray<readonly [number, number, number]>;
  sag?: number;
  color?: string;
  radius?: number;
  quality: QualityTier;
  followJockeyState?: { current: MeterBridgeVisualState };
}

export function TubeWire({
  start,
  end,
  via,
  sag = -0.012,
  color = "#991b1b",
  radius = 0.0024,
  quality,
  followJockeyState,
}: TubeWireProps) {
  const dynamicGroupRef = useRef<THREE.Group>(null);

  const res = useMemo(() => {
    const tubularSegments = quality === "low" ? 20 : 40;
    const radialSegments = quality === "low" ? 6 : 12;

    if (followJockeyState) {
      // Normalized arch from (0, 0, 0) to (0, deltaY, 1) so useFrame can orient & scale Z with zero allocations
      const deltaY = end[1] - start[1];
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, Math.max(0.055, deltaY + 0.045), 0.32),
        new THREE.Vector3(0, deltaY + 0.05, 0.68),
        new THREE.Vector3(0, deltaY, 1),
      ]);
      const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.1,
      });
      return { geo, mat };
    }

    const pts: THREE.Vector3[] = [new THREE.Vector3(start[0], start[1], start[2])];
    if (via && via.length > 0) {
      for (const p of via) {
        pts.push(new THREE.Vector3(p[0], p[1], p[2]));
      }
    } else {
      const midX = (start[0] + end[0]) / 2;
      const midY = Math.max(0.004, (start[1] + end[1]) / 2 + sag);
      const midZ = (start[2] + end[2]) / 2;
      pts.push(new THREE.Vector3(midX, midY, midZ));
    }
    pts.push(new THREE.Vector3(end[0], end[1], end[2]));

    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.1,
    });

    return { geo, mat };
  }, [start, end, via, sag, color, radius, quality, followJockeyState]);

  useEffect(() => {
    return () => {
      res.geo.dispose();
      res.mat.dispose();
    };
  }, [res]);

  const jockeyTopOffset =
    JOCKEY_DIMS.bladeHeight + JOCKEY_DIMS.collarHeight + JOCKEY_DIMS.handleHeight + 0.008;

  useFrame(() => {
    if (!followJockeyState) return;
    const grp = dynamicGroupRef.current;
    if (!grp) return;

    const st = followJockeyState.current;
    const ex = cmToX(st.jockeyCm);
    const ey =
      BRIDGE_WIRE.y +
      BRIDGE_WIRE.renderRadius +
      (st.jockeyDown ? 0 : JOCKEY_DIMS.liftOffset) +
      jockeyTopOffset;
    const ez = BRIDGE_WIRE.z;

    const dx = ex - start[0];
    const dz = ez - start[2];
    const distXZ = Math.max(0.01, Math.hypot(dx, dz));

    grp.position.set(start[0], start[1], start[2]);
    grp.rotation.y = Math.atan2(dx, dz);
    // Keep end Y aligned when jockey lowers/lifts
    const baseDeltaY = end[1] - start[1];
    const currentDeltaY = ey - start[1];
    const scaleY = Math.abs(baseDeltaY) > 1e-4 ? currentDeltaY / baseDeltaY : 1;
    grp.scale.set(1, scaleY, distXZ);
  });

  if (followJockeyState) {
    return (
      <group ref={dynamicGroupRef} position={[start[0], start[1], start[2]]}>
        <mesh geometry={res.geo} material={res.mat} castShadow />
      </group>
    );
  }

  return <mesh geometry={res.geo} material={res.mat} castShadow />;
}
