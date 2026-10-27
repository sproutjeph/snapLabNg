import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";
import { BURETTE_DIMS, FUNNEL_DIMS } from "./dimensions";
import type { TitrationVisualState } from "./types";

export interface FunnelProps {
  state: { current: TitrationVisualState };
  quality: QualityTier;
  onFunnelToggle?: (() => void) | undefined;
}

export function Funnel({ state, quality, onFunnelToggle }: FunnelProps) {
  const groupRef = useRef<THREE.Group>(null);

  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 14 : 28;
    const { coneTopRadius, coneBottomRadius, coneHeight, stemRadius, stemLength } = FUNNEL_DIMS;

    const coneGeo = new THREE.CylinderGeometry(
      coneTopRadius,
      coneBottomRadius,
      coneHeight,
      radialSegments,
      1,
      true,
    );
    const rimGeo = new THREE.TorusGeometry(coneTopRadius, 0.0014, 8, radialSegments);
    rimGeo.rotateX(Math.PI / 2);

    const stemGeo = new THREE.CylinderGeometry(
      stemRadius,
      stemRadius * 0.82,
      stemLength,
      radialSegments,
      1,
      true,
    );

    const hitGeo = new THREE.CylinderGeometry(
      coneTopRadius * 1.15,
      coneBottomRadius * 1.5,
      coneHeight + stemLength,
      12,
    );

    const glassMat =
      quality === "low"
        ? new THREE.MeshStandardMaterial({
            color: "#e0f2fe",
            transparent: true,
            opacity: 0.44,
            roughness: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: "#f0f9ff",
            transparent: true,
            opacity: 0.48,
            roughness: 0.06,
            metalness: 0.02,
            clearcoat: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false,
          });

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    return { coneGeo, rimGeo, stemGeo, hitGeo, glassMat, hitMat };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.coneGeo.dispose();
      res.rimGeo.dispose();
      res.stemGeo.dispose();
      res.hitGeo.dispose();
      res.glassMat.dispose();
      res.hitMat.dispose();
    };
  }, [res]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = state.current.funnelOn;
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onFunnelToggle?.();
  };

  const baseY = BURETTE_DIMS.topY + FUNNEL_DIMS.insertOffsetY;
  const stemCenterY = baseY + FUNNEL_DIMS.stemLength / 2;
  const coneCenterY = baseY + FUNNEL_DIMS.stemLength + FUNNEL_DIMS.coneHeight / 2;
  const rimY = baseY + FUNNEL_DIMS.stemLength + FUNNEL_DIMS.coneHeight;

  return (
    <group ref={groupRef} visible={state.current.funnelOn}>
      <mesh geometry={res.stemGeo} material={res.glassMat} position={[0, stemCenterY, 0]} />
      <mesh geometry={res.coneGeo} material={res.glassMat} position={[0, coneCenterY, 0]} />
      <mesh geometry={res.rimGeo} material={res.glassMat} position={[0, rimY, 0]} />
      {/* Invisible hit target for toggling the funnel on/off */}
      <mesh
        geometry={res.hitGeo}
        material={res.hitMat}
        position={[0, baseY + (FUNNEL_DIMS.stemLength + FUNNEL_DIMS.coneHeight) / 2, 0]}
        onPointerDown={handlePointerDown}
      />
    </group>
  );
}
