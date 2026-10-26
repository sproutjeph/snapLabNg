import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BRIDGE_WIRE, cmToX, JOCKEY_DIMS } from "./dimensions";
import type { MeterBridgeVisualState, QualityTier } from "./types";

export interface JockeyProps {
  state: { current: MeterBridgeVisualState };
  quality: QualityTier;
}

export function Jockey({ state, quality }: JockeyProps) {
  const groupRef = useRef<THREE.Group>(null);

  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 10 : 20;

    // Tapered knife-edge brass contact blade (wedges down to a sharp edge along the x-axis)
    const bladeGeo = new THREE.BoxGeometry(
      JOCKEY_DIMS.bladeThickness,
      JOCKEY_DIMS.bladeHeight,
      JOCKEY_DIMS.bladeWidth,
    );
    const collarGeo = new THREE.CylinderGeometry(
      JOCKEY_DIMS.collarRadius,
      JOCKEY_DIMS.collarRadius,
      JOCKEY_DIMS.collarHeight,
      radialSegments,
    );
    const handleGeo = new THREE.CylinderGeometry(
      JOCKEY_DIMS.handleRadiusTop,
      JOCKEY_DIMS.handleRadiusBottom,
      JOCKEY_DIMS.handleHeight,
      radialSegments,
    );
    const terminalPostGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.01, radialSegments);
    const terminalNutGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.004, radialSegments);

    const brassMat = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      metalness: 0.78,
      roughness: 0.26,
    });
    const handleMat = new THREE.MeshStandardMaterial({
      color: "#1f1d1b",
      metalness: 0.08,
      roughness: 0.45,
    });
    const redRingMat = new THREE.MeshStandardMaterial({
      color: "#9e2a2b",
      metalness: 0.1,
      roughness: 0.5,
    });

    return {
      bladeGeo,
      collarGeo,
      handleGeo,
      terminalPostGeo,
      terminalNutGeo,
      brassMat,
      handleMat,
      redRingMat,
    };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.bladeGeo.dispose();
      res.collarGeo.dispose();
      res.handleGeo.dispose();
      res.terminalPostGeo.dispose();
      res.terminalNutGeo.dispose();
      res.brassMat.dispose();
      res.handleMat.dispose();
      res.redRingMat.dispose();
    };
  }, [res]);

  useFrame(() => {
    const grp = groupRef.current;
    if (!grp) return;
    const current = state.current;
    const targetX = cmToX(current.jockeyCm);
    const targetY =
      BRIDGE_WIRE.y + BRIDGE_WIRE.renderRadius + (current.jockeyDown ? 0 : JOCKEY_DIMS.liftOffset);
    grp.position.x = targetX;
    grp.position.y = targetY;
  });

  const bladeCenterY = JOCKEY_DIMS.bladeHeight / 2;
  const collarCenterY = JOCKEY_DIMS.bladeHeight + JOCKEY_DIMS.collarHeight / 2;
  const handleCenterY =
    JOCKEY_DIMS.bladeHeight + JOCKEY_DIMS.collarHeight + JOCKEY_DIMS.handleHeight / 2;
  const topY = JOCKEY_DIMS.bladeHeight + JOCKEY_DIMS.collarHeight + JOCKEY_DIMS.handleHeight;

  return (
    <group
      ref={groupRef}
      position={[
        cmToX(state.current.jockeyCm),
        BRIDGE_WIRE.y +
          BRIDGE_WIRE.renderRadius +
          (state.current.jockeyDown ? 0 : JOCKEY_DIMS.liftOffset),
        BRIDGE_WIRE.z,
      ]}
    >
      <mesh
        geometry={res.bladeGeo}
        material={res.brassMat}
        position={[0, bladeCenterY, 0]}
        castShadow
      />
      <mesh
        geometry={res.collarGeo}
        material={res.brassMat}
        position={[0, collarCenterY, 0]}
        castShadow
      />
      <mesh
        geometry={res.handleGeo}
        material={res.handleMat}
        position={[0, handleCenterY, 0]}
        castShadow
      />
      <mesh
        geometry={res.terminalPostGeo}
        material={res.brassMat}
        position={[0, topY + 0.005, 0]}
      />
      <mesh geometry={res.terminalNutGeo} material={res.brassMat} position={[0, topY + 0.008, 0]} />
    </group>
  );
}
