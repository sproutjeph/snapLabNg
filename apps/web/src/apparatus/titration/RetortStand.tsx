import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";
import { BURETTE_DIMS, RETORT_STAND_DIMS } from "./dimensions";

export interface RetortStandProps {
  quality: QualityTier;
}

export function RetortStand({ quality }: RetortStandProps) {
  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 10 : 20;

    const baseGeo = new THREE.BoxGeometry(
      RETORT_STAND_DIMS.baseWidth,
      RETORT_STAND_DIMS.baseHeight,
      RETORT_STAND_DIMS.baseDepth,
    );
    const socketGeo = new THREE.CylinderGeometry(0.013, 0.016, 0.022, radialSegments);
    const rodGeo = new THREE.CylinderGeometry(
      RETORT_STAND_DIMS.rodRadius,
      RETORT_STAND_DIMS.rodRadius,
      RETORT_STAND_DIMS.rodHeight,
      radialSegments,
    );
    const bossheadGeo = new THREE.BoxGeometry(0.028, 0.032, 0.028);
    const screwShaftGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.022, radialSegments);
    screwShaftGeo.rotateZ(Math.PI / 2);
    const screwKnobGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.006, radialSegments);
    screwKnobGeo.rotateZ(Math.PI / 2);

    const dx = -RETORT_STAND_DIMS.rodX;
    const dz = -RETORT_STAND_DIMS.rodZ;
    const armLen = Math.hypot(dx, dz) - BURETTE_DIMS.outerRadius - 0.012;
    const armAngleY = Math.atan2(dx, dz);

    const armGeo = new THREE.CylinderGeometry(0.0045, 0.0045, armLen, radialSegments);
    armGeo.rotateX(Math.PI / 2);

    const yokeGeo = new THREE.BoxGeometry(0.026, 0.014, 0.012);
    const jawGeo = new THREE.TorusGeometry(
      BURETTE_DIMS.outerRadius + 0.0035,
      0.0032,
      8,
      radialSegments,
      Math.PI * 0.85,
    );
    jawGeo.rotateX(Math.PI / 2);

    const castIronMat = new THREE.MeshStandardMaterial({
      color: "#1e293b",
      roughness: 0.65,
      metalness: 0.45,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.25,
      metalness: 0.85,
    });
    const aluminumMat = new THREE.MeshStandardMaterial({
      color: "#94a3b8",
      roughness: 0.38,
      metalness: 0.72,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      roughness: 0.26,
      metalness: 0.82,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: "#7f1d1d",
      roughness: 0.78,
      metalness: 0.05,
    });

    return {
      baseGeo,
      socketGeo,
      rodGeo,
      bossheadGeo,
      screwShaftGeo,
      screwKnobGeo,
      armGeo,
      yokeGeo,
      jawGeo,
      armLen,
      armAngleY,
      castIronMat,
      steelMat,
      aluminumMat,
      brassMat,
      rubberMat,
    };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.baseGeo.dispose();
      res.socketGeo.dispose();
      res.rodGeo.dispose();
      res.bossheadGeo.dispose();
      res.screwShaftGeo.dispose();
      res.screwKnobGeo.dispose();
      res.armGeo.dispose();
      res.yokeGeo.dispose();
      res.jawGeo.dispose();
      res.castIronMat.dispose();
      res.steelMat.dispose();
      res.aluminumMat.dispose();
      res.brassMat.dispose();
      res.rubberMat.dispose();
    };
  }, [res]);

  const { rodX, rodZ, baseHeight, rodHeight, clampY } = RETORT_STAND_DIMS;

  return (
    <group>
      {/* Heavy cast-iron base positioned cleanly behind the white tile */}
      <mesh
        geometry={res.baseGeo}
        material={res.castIronMat}
        position={[rodX + 0.035, baseHeight / 2, rodZ - 0.025]}
        castShadow
        receiveShadow
      />

      {/* Threaded collar socket */}
      <mesh
        geometry={res.socketGeo}
        material={res.castIronMat}
        position={[rodX, baseHeight + 0.011, rodZ]}
        castShadow
      />

      {/* Vertical 0.90 m steel rod */}
      <mesh
        geometry={res.rodGeo}
        material={res.steelMat}
        position={[rodX, baseHeight + rodHeight / 2, rodZ]}
        castShadow
      />

      {/* Bosshead block and brass thumbscrews at clampY */}
      <group position={[rodX, clampY, rodZ]}>
        <mesh geometry={res.bossheadGeo} material={res.aluminumMat} castShadow />
        <mesh
          geometry={res.screwShaftGeo}
          material={res.brassMat}
          position={[-0.018, 0.005, 0]}
          castShadow
        />
        <mesh
          geometry={res.screwKnobGeo}
          material={res.brassMat}
          position={[-0.03, 0.005, 0]}
          castShadow
        />
        <mesh
          geometry={res.screwShaftGeo}
          material={res.brassMat}
          position={[0, -0.006, -0.018]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow
        />
        <mesh
          geometry={res.screwKnobGeo}
          material={res.brassMat}
          position={[0, -0.006, -0.03]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow
        />
      </group>

      {/* Clamp arm reaching from the rod to the burette at (0, clampY, 0) */}
      <group position={[rodX, clampY, rodZ]} rotation={[0, res.armAngleY, 0]}>
        <mesh
          geometry={res.armGeo}
          material={res.steelMat}
          position={[0, 0, res.armLen / 2]}
          castShadow
        />
        <mesh
          geometry={res.yokeGeo}
          material={res.aluminumMat}
          position={[0, 0, res.armLen]}
          castShadow
        />
      </group>

      {/* Dual rubber-lined jaws gripping the burette */}
      <group position={[0, clampY, 0]}>
        <mesh
          geometry={res.jawGeo}
          material={res.rubberMat}
          rotation={[0, 0.15, 0]}
          position={[0, 0.008, 0]}
          castShadow
        />
        <mesh
          geometry={res.jawGeo}
          material={res.rubberMat}
          rotation={[0, Math.PI + 0.15, 0]}
          position={[0, -0.008, 0]}
          castShadow
        />
      </group>
    </group>
  );
}
