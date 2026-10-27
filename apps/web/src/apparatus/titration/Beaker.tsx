import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";
import { BEAKER_DIMS } from "./dimensions";

export interface BeakerProps {
  quality: QualityTier;
  position?: readonly [number, number, number];
}

function createBeakerScaleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(248, 250, 252, 0.85)";
    ctx.fillStyle = "rgba(248, 250, 252, 0.9)";
    ctx.lineWidth = 3;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Draw 250 cm³ header and graduation marks (50, 100, 150, 200)
    ctx.fillText("250 cm³", 72, 34);
    const marks = [50, 100, 150, 200];
    for (const m of marks) {
      const y = 224 - ((m - 25) / 200) * 160;
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(132, y);
      ctx.stroke();
      ctx.fillText(String(m), 140, y);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function Beaker({ quality, position = [0, 0, 0] }: BeakerProps) {
  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 16 : 32;
    const { radius, height, wallThickness, liquidHeight } = BEAKER_DIMS;

    const wallGeo = new THREE.CylinderGeometry(radius, radius, height, radialSegments, 1, true);
    const baseGeo = new THREE.CylinderGeometry(radius, radius, wallThickness * 1.5, radialSegments);
    const rimGeo = new THREE.TorusGeometry(radius, wallThickness * 0.9, 8, radialSegments);
    rimGeo.rotateX(Math.PI / 2);

    const liquidGeo = new THREE.CylinderGeometry(
      radius - wallThickness * 1.2,
      radius - wallThickness * 1.2,
      liquidHeight,
      radialSegments,
    );

    const scaleGeo = new THREE.CylinderGeometry(
      radius + 0.0003,
      radius + 0.0003,
      height * 0.78,
      16,
      1,
      true,
      -Math.PI * 0.25,
      Math.PI * 0.5,
    );

    const scaleTex = createBeakerScaleTexture();

    const glassMat =
      quality === "low"
        ? new THREE.MeshStandardMaterial({
            color: "#e0f2fe",
            transparent: true,
            opacity: 0.34,
            roughness: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: "#ecfeff",
            transparent: true,
            opacity: 0.36,
            roughness: 0.06,
            metalness: 0.02,
            clearcoat: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false,
          });

    const liquidMat = new THREE.MeshStandardMaterial({
      color: "#bae6fd",
      transparent: true,
      opacity: 0.42,
      roughness: 0.15,
      depthWrite: false,
    });

    const scaleMat = new THREE.MeshBasicMaterial({
      map: scaleTex,
      transparent: true,
      depthWrite: false,
    });

    return {
      wallGeo,
      baseGeo,
      rimGeo,
      liquidGeo,
      scaleGeo,
      scaleTex,
      glassMat,
      liquidMat,
      scaleMat,
    };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.wallGeo.dispose();
      res.baseGeo.dispose();
      res.rimGeo.dispose();
      res.liquidGeo.dispose();
      res.scaleGeo.dispose();
      res.scaleTex.dispose();
      res.glassMat.dispose();
      res.liquidMat.dispose();
      res.scaleMat.dispose();
    };
  }, [res]);

  const { height, wallThickness, liquidHeight } = BEAKER_DIMS;

  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh
        geometry={res.liquidGeo}
        material={res.liquidMat}
        position={[0, wallThickness * 1.5 + liquidHeight / 2, 0]}
      />
      <mesh
        geometry={res.baseGeo}
        material={res.glassMat}
        position={[0, (wallThickness * 1.5) / 2, 0]}
      />
      <mesh geometry={res.wallGeo} material={res.glassMat} position={[0, height / 2, 0]} />
      <mesh geometry={res.rimGeo} material={res.glassMat} position={[0, height, 0]} />
      <mesh geometry={res.scaleGeo} material={res.scaleMat} position={[0, height * 0.5, 0]} />
    </group>
  );
}
