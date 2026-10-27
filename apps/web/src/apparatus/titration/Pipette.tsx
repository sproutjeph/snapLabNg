import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";
import { PIPETTE_DIMS } from "./dimensions";

export interface PipetteProps {
  quality: QualityTier;
  position?: readonly [number, number, number];
}

export function Pipette({ quality, position = [0, 0, 0] }: PipetteProps) {
  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 12 : 24;
    const { totalLength, stemRadius, tipRadius, bulbRadius, bulbLength, restHeight } = PIPETTE_DIMS;

    // Orient along Z axis on the bench: total length 0.45 m (-0.225 to +0.225)
    const tipLen = 0.035;
    const stemLen = (totalLength - bulbLength - tipLen) / 2;

    const tipGeo = new THREE.CylinderGeometry(tipRadius, stemRadius, tipLen, radialSegments);
    tipGeo.rotateX(Math.PI / 2);

    const lowerStemGeo = new THREE.CylinderGeometry(
      stemRadius,
      stemRadius,
      stemLen,
      radialSegments,
    );
    lowerStemGeo.rotateX(Math.PI / 2);

    const bulbGeo = new THREE.CylinderGeometry(
      bulbRadius,
      bulbRadius,
      bulbLength * 0.65,
      radialSegments,
    );
    bulbGeo.rotateX(Math.PI / 2);

    const bulbTaperFrontGeo = new THREE.CylinderGeometry(
      stemRadius,
      bulbRadius,
      bulbLength * 0.175,
      radialSegments,
    );
    bulbTaperFrontGeo.rotateX(Math.PI / 2);

    const bulbTaperBackGeo = new THREE.CylinderGeometry(
      bulbRadius,
      stemRadius,
      bulbLength * 0.175,
      radialSegments,
    );
    bulbTaperBackGeo.rotateX(Math.PI / 2);

    const upperStemGeo = new THREE.CylinderGeometry(
      stemRadius,
      stemRadius,
      stemLen,
      radialSegments,
    );
    upperStemGeo.rotateX(Math.PI / 2);

    const markRingGeo = new THREE.TorusGeometry(stemRadius + 0.0004, 0.0005, 8, radialSegments);

    const restBlockGeo = new THREE.BoxGeometry(0.036, restHeight, 0.012);

    const glassMat =
      quality === "low"
        ? new THREE.MeshStandardMaterial({
            color: "#e0f2fe",
            transparent: true,
            opacity: 0.42,
            roughness: 0.18,
            depthWrite: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: "#ecfeff",
            transparent: true,
            opacity: 0.44,
            roughness: 0.06,
            metalness: 0.02,
            clearcoat: 0.9,
            depthWrite: false,
          });

    const markMat = new THREE.MeshBasicMaterial({ color: "#f8fafc" });
    const woodRestMat = new THREE.MeshStandardMaterial({
      color: "#78350f",
      roughness: 0.72,
      metalness: 0.04,
    });

    return {
      tipGeo,
      lowerStemGeo,
      bulbGeo,
      bulbTaperFrontGeo,
      bulbTaperBackGeo,
      upperStemGeo,
      markRingGeo,
      restBlockGeo,
      glassMat,
      markMat,
      woodRestMat,
      tipLen,
      stemLen,
      bulbLength,
      restHeight,
    };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.tipGeo.dispose();
      res.lowerStemGeo.dispose();
      res.bulbGeo.dispose();
      res.bulbTaperFrontGeo.dispose();
      res.bulbTaperBackGeo.dispose();
      res.upperStemGeo.dispose();
      res.markRingGeo.dispose();
      res.restBlockGeo.dispose();
      res.glassMat.dispose();
      res.markMat.dispose();
      res.woodRestMat.dispose();
    };
  }, [res]);

  const yCenter = res.restHeight + PIPETTE_DIMS.bulbRadius * 0.35;
  const halfBulbBody = (res.bulbLength * 0.65) / 2;
  const taperLen = res.bulbLength * 0.175;
  const halfBulbTotal = res.bulbLength / 2;

  return (
    <group position={[position[0], position[1], position[2]]} rotation={[0, -0.12, 0]}>
      {/* Two wooden bench cradles keeping the 25 cm³ pipette off the bench */}
      <mesh
        geometry={res.restBlockGeo}
        material={res.woodRestMat}
        position={[0, res.restHeight / 2, -0.11]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={res.restBlockGeo}
        material={res.woodRestMat}
        position={[0, res.restHeight / 2, 0.11]}
        castShadow
        receiveShadow
      />

      {/* Central 25 cm³ bulb and tapers */}
      <mesh geometry={res.bulbGeo} material={res.glassMat} position={[0, yCenter, 0]} />
      <mesh
        geometry={res.bulbTaperFrontGeo}
        material={res.glassMat}
        position={[0, yCenter, halfBulbBody + taperLen / 2]}
      />
      <mesh
        geometry={res.bulbTaperBackGeo}
        material={res.glassMat}
        position={[0, yCenter, -(halfBulbBody + taperLen / 2)]}
      />

      {/* Delivery stem and jet tip (+Z) */}
      <mesh
        geometry={res.lowerStemGeo}
        material={res.glassMat}
        position={[0, yCenter, halfBulbTotal + res.stemLen / 2]}
      />
      <mesh
        geometry={res.tipGeo}
        material={res.glassMat}
        position={[0, yCenter, halfBulbTotal + res.stemLen + res.tipLen / 2]}
      />

      {/* Suction stem and calibration ring (-Z) */}
      <mesh
        geometry={res.upperStemGeo}
        material={res.glassMat}
        position={[0, yCenter, -(halfBulbTotal + res.stemLen / 2)]}
      />
      <mesh
        geometry={res.markRingGeo}
        material={res.markMat}
        position={[0, yCenter, -(halfBulbTotal + res.stemLen * 0.42)]}
      />
    </group>
  );
}
