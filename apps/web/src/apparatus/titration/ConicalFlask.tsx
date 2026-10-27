import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";
import { FLASK_DIMS, flaskInnerRadiusAtHeight, flaskLiquidHeight } from "./dimensions";
import type { TitrationVisualState } from "./types";

export interface ConicalFlaskProps {
  state: { current: TitrationVisualState };
  quality: QualityTier;
  position?: readonly [number, number, number];
  onSwirl?: (() => void) | undefined;
}

interface LiquidMeshData {
  geo: THREE.CylinderGeometry;
  vertexKind: Uint8Array; // 0 = bottom center, 1 = bottom ring, 2 = top ring, 3 = top center
  unitX: Float32Array;
  unitZ: Float32Array;
}

function createDynamicLiquidGeometry(radialSegments: number): LiquidMeshData {
  const geo = new THREE.CylinderGeometry(1, 1, 1, radialSegments, 1, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const vertexKind = new Uint8Array(count);
  const unitX = new Float32Array(count);
  const unitZ = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (y < 0) {
      if (r < 1e-4) {
        vertexKind[i] = 0;
      } else {
        vertexKind[i] = 1;
        unitX[i] = x / r;
        unitZ[i] = z / r;
      }
    } else {
      if (r < 1e-4) {
        vertexKind[i] = 3;
      } else {
        vertexKind[i] = 2;
        unitX[i] = x / r;
        unitZ[i] = z / r;
      }
    }
  }

  return { geo, vertexKind, unitX, unitZ };
}

function updateLiquidVertices(
  data: LiquidMeshData,
  baseH: number,
  swirlPhase: number,
  rBottom: number,
): void {
  const pos = data.geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const swirlActive = swirlPhase > 1e-4;
  const swirlAngle = swirlPhase * Math.PI * 6;
  const dirX = swirlActive ? Math.cos(swirlAngle) : 0;
  const dirZ = swirlActive ? Math.sin(swirlAngle) : 0;
  const waveAmp = swirlActive ? Math.sin(swirlPhase * Math.PI) * Math.min(0.007, baseH * 0.35) : 0;

  for (let i = 0; i < count; i++) {
    const kind = data.vertexKind[i];
    if (kind === 0) {
      pos.setXYZ(i, 0, 0, 0);
    } else if (kind === 1) {
      const ux = data.unitX[i] ?? 0;
      const uz = data.unitZ[i] ?? 0;
      pos.setXYZ(i, ux * rBottom, 0, uz * rBottom);
    } else if (kind === 2) {
      const ux = data.unitX[i] ?? 0;
      const uz = data.unitZ[i] ?? 0;
      const localH = Math.max(0.001, baseH + (ux * dirX + uz * dirZ) * waveAmp);
      const localR = Math.max(0.004, flaskInnerRadiusAtHeight(localH) - 0.0008);
      pos.setXYZ(i, ux * localR, localH, uz * localR);
    } else {
      // Slightly depressed centre for concave surface / vortex during swirl
      const dip = swirlActive ? Math.sin(swirlPhase * Math.PI) * 0.0025 : 0.0008;
      pos.setXYZ(i, 0, Math.max(0.0005, baseH - dip), 0);
    }
  }

  pos.needsUpdate = true;
  data.geo.computeVertexNormals();
}

export function ConicalFlask({ state, quality, position = [0, 0, 0], onSwirl }: ConicalFlaskProps) {
  const liquidMeshRef = useRef<THREE.Mesh>(null);
  const flaskGroupRef = useRef<THREE.Group>(null);
  const lastVolRef = useRef<number>(-1);
  const lastSwirlRef = useRef<number>(-1);

  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 18 : 36;
    const { baseRadius, neckRadius, bodyHeight, neckHeight, totalHeight, wallThickness } =
      FLASK_DIMS;

    const baseDiscGeo = new THREE.CylinderGeometry(
      baseRadius,
      baseRadius,
      wallThickness,
      radialSegments,
    );
    const bodyGeo = new THREE.CylinderGeometry(
      neckRadius,
      baseRadius,
      bodyHeight,
      radialSegments,
      1,
      true,
    );
    const neckGeo = new THREE.CylinderGeometry(
      neckRadius,
      neckRadius,
      neckHeight,
      radialSegments,
      1,
      true,
    );
    const lipGeo = new THREE.TorusGeometry(neckRadius + 0.0008, 0.0018, 8, radialSegments);
    lipGeo.rotateX(Math.PI / 2);

    const hitGeo = new THREE.CylinderGeometry(neckRadius * 1.3, baseRadius * 1.05, totalHeight, 12);

    const liquidData = createDynamicLiquidGeometry(radialSegments);
    const initialH = flaskLiquidHeight(25);
    updateLiquidVertices(liquidData, initialH, 0, FLASK_DIMS.innerBaseRadius - 0.0008);

    const glassMat =
      quality === "low"
        ? new THREE.MeshStandardMaterial({
            color: "#e0f2fe",
            transparent: true,
            opacity: 0.34,
            roughness: 0.16,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: "#f0f9ff",
            transparent: true,
            opacity: 0.36,
            roughness: 0.06,
            metalness: 0.02,
            clearcoat: 0.92,
            side: THREE.DoubleSide,
            depthWrite: false,
          });

    const liquidMat = new THREE.MeshStandardMaterial({
      color: "#f472b6",
      transparent: true,
      opacity: 0.78,
      roughness: 0.12,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    return {
      baseDiscGeo,
      bodyGeo,
      neckGeo,
      lipGeo,
      hitGeo,
      liquidData,
      glassMat,
      liquidMat,
      hitMat,
    };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.baseDiscGeo.dispose();
      res.bodyGeo.dispose();
      res.neckGeo.dispose();
      res.lipGeo.dispose();
      res.hitGeo.dispose();
      res.liquidData.geo.dispose();
      res.glassMat.dispose();
      res.liquidMat.dispose();
      res.hitMat.dispose();
    };
  }, [res]);

  useFrame(() => {
    const cur = state.current;
    const vol = cur.flaskVolumeCm3;
    const swirl = cur.swirlPhase;
    const [r, g, b] = cur.flaskColor;

    res.liquidMat.color.setRGB(r, g, b, THREE.LinearSRGBColorSpace);

    const liquidMesh = liquidMeshRef.current;
    if (liquidMesh) {
      if (vol <= 0.01) {
        liquidMesh.visible = false;
      } else {
        liquidMesh.visible = true;
        if (
          Math.abs(vol - lastVolRef.current) > 1e-4 ||
          Math.abs(swirl - lastSwirlRef.current) > 1e-4
        ) {
          const h = flaskLiquidHeight(vol);
          updateLiquidVertices(res.liquidData, h, swirl, FLASK_DIMS.innerBaseRadius - 0.0008);
          lastVolRef.current = vol;
          lastSwirlRef.current = swirl;
        }
      }
    }

    if (flaskGroupRef.current) {
      if (swirl > 1e-4) {
        const orbitAngle = swirl * Math.PI * 6;
        const env = Math.sin(swirl * Math.PI);
        flaskGroupRef.current.position.x = position[0] + Math.cos(orbitAngle) * 0.0022 * env;
        flaskGroupRef.current.position.z = position[2] + Math.sin(orbitAngle) * 0.0022 * env;
      } else {
        flaskGroupRef.current.position.x = position[0];
        flaskGroupRef.current.position.z = position[2];
      }
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSwirl?.();
  };

  const { bodyHeight, neckHeight, totalHeight, wallThickness } = FLASK_DIMS;

  return (
    <group ref={flaskGroupRef} position={[position[0], position[1], position[2]]}>
      {/* Liquid column inside the conical flask */}
      <mesh
        ref={liquidMeshRef}
        geometry={res.liquidData.geo}
        material={res.liquidMat}
        position={[0, wallThickness + 0.0005, 0]}
        renderOrder={1}
      />

      {/* Conical flask glass base, frustum body, cylindrical neck and rolled lip */}
      <mesh
        geometry={res.baseDiscGeo}
        material={res.glassMat}
        position={[0, wallThickness / 2, 0]}
        renderOrder={2}
      />
      <mesh
        geometry={res.bodyGeo}
        material={res.glassMat}
        position={[0, bodyHeight / 2, 0]}
        renderOrder={2}
      />
      <mesh
        geometry={res.neckGeo}
        material={res.glassMat}
        position={[0, bodyHeight + neckHeight / 2, 0]}
        renderOrder={2}
      />
      <mesh
        geometry={res.lipGeo}
        material={res.glassMat}
        position={[0, totalHeight, 0]}
        renderOrder={2}
      />

      {/* Invisible hit target to trigger swirling on tap */}
      <mesh
        geometry={res.hitGeo}
        material={res.hitMat}
        position={[0, totalHeight / 2, 0]}
        onPointerDown={handlePointerDown}
      />
    </group>
  );
}
