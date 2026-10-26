import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { LECLANCHE_DIMS, TERMINAL_SCREW } from "./dimensions";
import type { QualityTier } from "./types";

export interface LeclancheCellProps {
  quality: QualityTier;
  position?: readonly [number, number, number];
}

export function LeclancheCell({ quality, position = [0, 0, 0] }: LeclancheCellProps) {
  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 14 : 28;

    const jarGeo = new THREE.CylinderGeometry(
      LECLANCHE_DIMS.jarRadius,
      LECLANCHE_DIMS.jarRadius * 0.96,
      LECLANCHE_DIMS.jarHeight,
      radialSegments,
    );
    const pitchRimGeo = new THREE.CylinderGeometry(
      LECLANCHE_DIMS.jarRadius * 1.02,
      LECLANCHE_DIMS.jarRadius * 1.01,
      0.016,
      radialSegments,
    );
    const electrolyteGeo = new THREE.CylinderGeometry(
      LECLANCHE_DIMS.jarRadius * 0.92,
      LECLANCHE_DIMS.jarRadius * 0.9,
      LECLANCHE_DIMS.jarHeight * 0.72,
      radialSegments,
    );
    const porousPotGeo = new THREE.CylinderGeometry(
      LECLANCHE_DIMS.potRadius,
      LECLANCHE_DIMS.potRadius * 0.96,
      LECLANCHE_DIMS.potHeight,
      radialSegments,
    );
    const carbonRodGeo = new THREE.CylinderGeometry(
      LECLANCHE_DIMS.carbonRadius,
      LECLANCHE_DIMS.carbonRadius,
      LECLANCHE_DIMS.carbonHeight,
      radialSegments,
    );
    const carbonCapGeo = new THREE.CylinderGeometry(
      LECLANCHE_DIMS.carbonRadius * 1.35,
      LECLANCHE_DIMS.carbonRadius * 1.35,
      0.01,
      radialSegments,
    );
    const zincRodGeo = new THREE.CylinderGeometry(
      LECLANCHE_DIMS.zincRadius,
      LECLANCHE_DIMS.zincRadius,
      LECLANCHE_DIMS.zincHeight,
      radialSegments,
    );
    const terminalCapGeo = new THREE.CylinderGeometry(
      TERMINAL_SCREW.capRadius,
      TERMINAL_SCREW.capRadius,
      TERMINAL_SCREW.capHeight,
      12,
    );

    const glassMat =
      quality === "low"
        ? new THREE.MeshStandardMaterial({
            color: "#d8f3dc",
            transparent: true,
            opacity: 0.34,
            roughness: 0.2,
            depthWrite: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: "#e2f1e8",
            transparent: true,
            opacity: 0.36,
            roughness: 0.08,
            metalness: 0.04,
            clearcoat: 0.85,
            depthWrite: false,
          });

    const electrolyteMat = new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      transparent: true,
      opacity: 0.28,
      roughness: 0.25,
      depthWrite: false,
    });
    const pitchMat = new THREE.MeshStandardMaterial({
      color: "#18181b",
      roughness: 0.45,
      metalness: 0.05,
    });
    const porousPotMat = new THREE.MeshStandardMaterial({
      color: "#c89d7c",
      roughness: 0.82,
      metalness: 0.02,
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: "#27272a",
      roughness: 0.65,
      metalness: 0.15,
    });
    const zincMat = new THREE.MeshStandardMaterial({
      color: "#94a3b8",
      roughness: 0.32,
      metalness: 0.78,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      metalness: 0.82,
      roughness: 0.24,
    });

    return {
      jarGeo,
      pitchRimGeo,
      electrolyteGeo,
      porousPotGeo,
      carbonRodGeo,
      carbonCapGeo,
      zincRodGeo,
      terminalCapGeo,
      glassMat,
      electrolyteMat,
      pitchMat,
      porousPotMat,
      carbonMat,
      zincMat,
      brassMat,
    };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.jarGeo.dispose();
      res.pitchRimGeo.dispose();
      res.electrolyteGeo.dispose();
      res.porousPotGeo.dispose();
      res.carbonRodGeo.dispose();
      res.carbonCapGeo.dispose();
      res.zincRodGeo.dispose();
      res.terminalCapGeo.dispose();
      res.glassMat.dispose();
      res.electrolyteMat.dispose();
      res.pitchMat.dispose();
      res.porousPotMat.dispose();
      res.carbonMat.dispose();
      res.zincMat.dispose();
      res.brassMat.dispose();
    };
  }, [res]);

  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* Central porous pot (MnO2 + carbon depolariser) */}
      <mesh
        geometry={res.porousPotGeo}
        material={res.porousPotMat}
        position={[0, LECLANCHE_DIMS.potHeight / 2 + 0.003, 0]}
        castShadow
        receiveShadow
      />

      {/* Positive carbon rod electrode + brass cap terminal */}
      <mesh
        geometry={res.carbonRodGeo}
        material={res.carbonMat}
        position={[0, LECLANCHE_DIMS.carbonHeight / 2 + 0.004, 0]}
        castShadow
      />
      <mesh
        geometry={res.carbonCapGeo}
        material={res.brassMat}
        position={[0, LECLANCHE_DIMS.carbonHeight + 0.006, 0]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[0, LECLANCHE_DIMS.carbonHeight + 0.013, 0]}
        castShadow
      />

      {/* Negative amalgamated zinc rod + brass terminal */}
      <mesh
        geometry={res.zincRodGeo}
        material={res.zincMat}
        position={[LECLANCHE_DIMS.zincOffsetX, LECLANCHE_DIMS.zincHeight / 2 + 0.004, 0.01]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[LECLANCHE_DIMS.zincOffsetX, LECLANCHE_DIMS.zincHeight + 0.007, 0.01]}
        castShadow
      />

      {/* Black bitumen/pitch top collar rim */}
      <mesh
        geometry={res.pitchRimGeo}
        material={res.pitchMat}
        position={[0, LECLANCHE_DIMS.jarHeight - 0.008, 0]}
        castShadow
      />

      {/* Ammonium chloride solution level inside the jar */}
      <mesh
        geometry={res.electrolyteGeo}
        material={res.electrolyteMat}
        position={[0, (LECLANCHE_DIMS.jarHeight * 0.72) / 2 + 0.003, 0]}
      />

      {/* Outer glass jar */}
      <mesh
        geometry={res.jarGeo}
        material={res.glassMat}
        position={[0, LECLANCHE_DIMS.jarHeight / 2, 0]}
      />
    </group>
  );
}
