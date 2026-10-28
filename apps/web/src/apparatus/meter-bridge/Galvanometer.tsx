import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GALVANOMETER_DIMS, TERMINAL_SCREW } from "./dimensions";
import type { MeterBridgeVisualState, QualityTier } from "./types";

export interface GalvanometerProps {
  state: { current: Pick<MeterBridgeVisualState, "needleDeg"> };
  quality: QualityTier;
  position?: readonly [number, number, number];
}

function createGalvanometerDialTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const cx = 256;
    const cy = 256;

    // Cream dial plate
    ctx.fillStyle = "#faf6eb";
    ctx.beginPath();
    ctx.arc(cx, cy, 248, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Scale arc center sits slightly towards the bottom of the circular face
    const pivotX = cx;
    const pivotY = cy + 64;
    const arcRadius = 186;

    // Draw scale arc from -45 deg to +45 deg around straight-up (-PI/2)
    const degToCanvasAngle = (deg: number) => -Math.PI / 2 + (deg * Math.PI) / 180;

    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, arcRadius, degToCanvasAngle(-45), degToCanvasAngle(45));
    ctx.stroke();

    ctx.fillStyle = "#18181b";
    ctx.font = "bold 24px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Readings -30 ... 0 ... +30 mapped across -42 deg to +42 deg
    for (let val = -30; val <= 30; val += 2) {
      const deg = (val / 30) * 42;
      const angle = degToCanvasAngle(deg);
      const isMajor = val % 10 === 0;
      const isMid = val % 5 === 0;
      const innerR = arcRadius - (isMajor ? 22 : isMid ? 15 : 10);
      const outerR = arcRadius;

      ctx.lineWidth = isMajor ? 3.2 : 1.6;
      ctx.beginPath();
      ctx.moveTo(pivotX + Math.cos(angle) * innerR, pivotY + Math.sin(angle) * innerR);
      ctx.lineTo(pivotX + Math.cos(angle) * outerR, pivotY + Math.sin(angle) * outerR);
      ctx.stroke();

      if (isMajor) {
        const labelR = arcRadius - 42;
        const label = val > 0 ? `+${val}` : String(val);
        ctx.fillText(label, pivotX + Math.cos(angle) * labelR, pivotY + Math.sin(angle) * labelR);
      }
    }

    // Centre-zero G label
    ctx.font = "bold 36px Georgia, serif";
    ctx.fillText("G", cx, cy + 12);
    ctx.font = "20px Georgia, serif";
    ctx.fillStyle = "#52525b";
    ctx.fillText("CENTRE ZERO", cx, cy + 122);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function Galvanometer({ state, quality, position = [0, 0, 0] }: GalvanometerProps) {
  const needleGroupRef = useRef<THREE.Group>(null);

  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 16 : 32;

    const caseGeo = new THREE.CylinderGeometry(
      GALVANOMETER_DIMS.radius * 0.96,
      GALVANOMETER_DIMS.radius,
      GALVANOMETER_DIMS.height,
      radialSegments,
    );
    const bezelGeo = new THREE.TorusGeometry(
      GALVANOMETER_DIMS.dialRadius + 0.004,
      0.0045,
      12,
      radialSegments,
    );
    bezelGeo.rotateX(Math.PI / 2);
    const dialGeo = new THREE.CircleGeometry(GALVANOMETER_DIMS.dialRadius, radialSegments);
    const glassGeo = new THREE.CylinderGeometry(
      GALVANOMETER_DIMS.dialRadius,
      GALVANOMETER_DIMS.dialRadius,
      0.002,
      radialSegments,
    );
    const needleGeo = new THREE.BoxGeometry(0.0022, 0.0012, GALVANOMETER_DIMS.needleLength);
    const pivotCapGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 12);
    const stopPinGeo = new THREE.CylinderGeometry(0.0012, 0.0012, 0.005, 8);

    const terminalPostGeo = new THREE.CylinderGeometry(
      TERMINAL_SCREW.postRadius,
      TERMINAL_SCREW.baseRadius,
      TERMINAL_SCREW.postHeight,
      12,
    );
    const terminalCapGeo = new THREE.CylinderGeometry(
      TERMINAL_SCREW.capRadius,
      TERMINAL_SCREW.capRadius,
      TERMINAL_SCREW.capHeight,
      12,
    );

    const dialTexture = createGalvanometerDialTexture();

    const bakeliteMat = new THREE.MeshStandardMaterial({
      color: "#1c1917",
      roughness: 0.36,
      metalness: 0.1,
    });
    const dialMat = new THREE.MeshStandardMaterial({
      map: dialTexture,
      roughness: 0.5,
      metalness: 0.02,
    });
    const needleMat = new THREE.MeshStandardMaterial({
      color: "#dc2626",
      roughness: 0.35,
      metalness: 0.2,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      metalness: 0.82,
      roughness: 0.24,
    });
    const glassMat =
      quality === "low"
        ? new THREE.MeshStandardMaterial({
            color: "#e2e8f0",
            transparent: true,
            opacity: 0.2,
            roughness: 0.15,
            depthWrite: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: "#f1f5f9",
            transparent: true,
            opacity: 0.24,
            roughness: 0.06,
            metalness: 0.05,
            clearcoat: 0.9,
            depthWrite: false,
          });

    return {
      caseGeo,
      bezelGeo,
      dialGeo,
      glassGeo,
      needleGeo,
      pivotCapGeo,
      stopPinGeo,
      terminalPostGeo,
      terminalCapGeo,
      dialTexture,
      bakeliteMat,
      dialMat,
      needleMat,
      brassMat,
      glassMat,
    };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.caseGeo.dispose();
      res.bezelGeo.dispose();
      res.dialGeo.dispose();
      res.glassGeo.dispose();
      res.needleGeo.dispose();
      res.pivotCapGeo.dispose();
      res.stopPinGeo.dispose();
      res.terminalPostGeo.dispose();
      res.terminalCapGeo.dispose();
      res.dialTexture.dispose();
      res.bakeliteMat.dispose();
      res.dialMat.dispose();
      res.needleMat.dispose();
      res.brassMat.dispose();
      res.glassMat.dispose();
    };
  }, [res]);

  useFrame(() => {
    const needleGrp = needleGroupRef.current;
    if (!needleGrp) return;
    const rawDeg = state.current.needleDeg;
    const clampedDeg = Math.max(
      -GALVANOMETER_DIMS.maxDeg,
      Math.min(GALVANOMETER_DIMS.maxDeg, rawDeg),
    );
    needleGrp.rotation.y = -(clampedDeg * Math.PI) / 180;
  });

  const topY = GALVANOMETER_DIMS.height;
  const pivotZ = 0.012;
  const stopRadius = 0.034;
  const stopAngleRad = (GALVANOMETER_DIMS.maxDeg * Math.PI) / 180;

  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* Cylindrical Bakelite casing */}
      <mesh
        geometry={res.caseGeo}
        material={res.bakeliteMat}
        position={[0, GALVANOMETER_DIMS.height / 2, 0]}
        castShadow
        receiveShadow
      />

      {/* Brass top bezel ring */}
      <mesh
        geometry={res.bezelGeo}
        material={res.brassMat}
        position={[0, topY + 0.001, 0]}
        castShadow
      />

      {/* Centre-zero dial face (-30 ... 0 ... +30) */}
      <mesh
        geometry={res.dialGeo}
        material={res.dialMat}
        position={[0, topY + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* Stop pins at -45 deg and +45 deg */}
      <mesh
        geometry={res.stopPinGeo}
        material={res.brassMat}
        position={[
          -Math.sin(stopAngleRad) * stopRadius,
          topY + 0.0025,
          pivotZ - Math.cos(stopAngleRad) * stopRadius,
        ]}
      />
      <mesh
        geometry={res.stopPinGeo}
        material={res.brassMat}
        position={[
          Math.sin(stopAngleRad) * stopRadius,
          topY + 0.0025,
          pivotZ - Math.cos(stopAngleRad) * stopRadius,
        ]}
      />

      {/* Pivoted red pointer needle */}
      <group ref={needleGroupRef} position={[0, topY + 0.002, pivotZ]}>
        <mesh
          geometry={res.needleGeo}
          material={res.needleMat}
          position={[0, 0.001, -GALVANOMETER_DIMS.needleLength / 2 + 0.004]}
        />
        <mesh geometry={res.pivotCapGeo} material={res.brassMat} position={[0, 0.0015, 0]} />
      </group>

      {/* Protective glass window */}
      <mesh geometry={res.glassGeo} material={res.glassMat} position={[0, topY + 0.0055, 0]} />

      {/* Left and right binding terminals on the front rim */}
      <mesh
        geometry={res.terminalPostGeo}
        material={res.brassMat}
        position={[-0.036, topY * 0.45, GALVANOMETER_DIMS.radius + 0.004]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[-0.036, topY * 0.45, GALVANOMETER_DIMS.radius + 0.01]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      />
      <mesh
        geometry={res.terminalPostGeo}
        material={res.brassMat}
        position={[0.036, topY * 0.45, GALVANOMETER_DIMS.radius + 0.004]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[0.036, topY * 0.45, GALVANOMETER_DIMS.radius + 0.01]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      />
    </group>
  );
}
