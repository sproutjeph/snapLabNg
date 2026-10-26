import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BRIDGE_BASE,
  BRIDGE_WIRE,
  COPPER_STRIP,
  cmToX,
  METRE_RULE,
  TERMINAL_SCREW,
  xToCm,
} from "./dimensions";
import { Jockey } from "./Jockey";
import type { MeterBridgeVisualState, QualityTier } from "./types";

const MAX_SCRAPE_POOL = 24;

const _localPoint = new THREE.Vector3();
const _invMatrix = new THREE.Matrix4();
const _localRay = new THREE.Ray();
const _planeNormalY = new THREE.Vector3(0, 1, 0);
const _wirePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function rayToLocalCm(e: ThreeEvent<PointerEvent>): number {
  _invMatrix.copy(e.object.matrixWorld).invert();
  _localRay.copy(e.ray).applyMatrix4(_invMatrix);
  if (_localRay.intersectPlane(_wirePlane, _localPoint)) {
    return xToCm(_localPoint.x);
  }
  e.object.worldToLocal(_localPoint.copy(e.point));
  return xToCm(_localPoint.x);
}

export interface MeterBridgeProps {
  state: { current: MeterBridgeVisualState };
  unknownLabel: string;
  quality: QualityTier;
  onWireTap?: ((cm: number) => void) | undefined;
  onWireDrag?: ((fromCm: number, toCm: number) => void) | undefined;
}

export const BRIDGE_TERMINAL_POSITIONS = {
  A: [-0.5, 0.003, COPPER_STRIP.frontZ] as const,
  leftGapLeft: [
    COPPER_STRIP.leftGapCenterX - COPPER_STRIP.gapWidth / 2 - 0.015,
    0.003,
    COPPER_STRIP.backZ,
  ] as const,
  leftGapRight: [
    COPPER_STRIP.leftGapCenterX + COPPER_STRIP.gapWidth / 2 + 0.015,
    0.003,
    COPPER_STRIP.backZ,
  ] as const,
  B: [0, 0.003, COPPER_STRIP.backZ] as const,
  rightGapLeft: [
    COPPER_STRIP.rightGapCenterX - COPPER_STRIP.gapWidth / 2 - 0.015,
    0.003,
    COPPER_STRIP.backZ,
  ] as const,
  rightGapRight: [
    COPPER_STRIP.rightGapCenterX + COPPER_STRIP.gapWidth / 2 + 0.015,
    0.003,
    COPPER_STRIP.backZ,
  ] as const,
  C: [0.5, 0.003, COPPER_STRIP.frontZ] as const,
} as const;

function createMetreRuleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Ivory/boxwood rule background
    ctx.fillStyle = "#f3ead2";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle wood/rule border
    ctx.strokeStyle = "#b8a67e";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);

    ctx.strokeStyle = "#1c1917";
    ctx.fillStyle = "#1c1917";
    ctx.font = "bold 24px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const padX = 24;
    const usableW = canvas.width - padX * 2;

    // Draw mm, 5 mm, and cm ticks from 0 to 1000 mm
    for (let mm = 0; mm <= 1000; mm++) {
      const x = padX + (mm / 1000) * usableW;
      const isCm = mm % 10 === 0;
      const isHalfCm = mm % 5 === 0;
      const tickLen = isCm ? 38 : isHalfCm ? 26 : 15;
      ctx.lineWidth = isCm ? 2.4 : isHalfCm ? 1.6 : 1.0;

      // Top edge ticks (facing the wire)
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, tickLen);
      ctx.stroke();

      // Bottom edge cm ticks
      if (isCm) {
        ctx.beginPath();
        ctx.moveTo(x, canvas.height);
        ctx.lineTo(x, canvas.height - 20);
        ctx.stroke();
      }
    }

    // Numbers every 10 cm
    for (let cm = 0; cm <= 100; cm += 10) {
      const x = padX + (cm / 100) * usableW;
      ctx.fillText(String(cm), x, 92);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createBridgeLabelsTexture(unknownLabel: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f7e7c4";
    ctx.font = "bold 36px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const xToPx = (x: number) => ((x + BRIDGE_BASE.length / 2) / BRIDGE_BASE.length) * canvas.width;

    ctx.fillText("A", xToPx(-0.525), 95);
    ctx.fillText("R", xToPx(COPPER_STRIP.leftGapCenterX), 46);
    ctx.fillText("B", xToPx(0), 46);
    ctx.fillText(unknownLabel || "X", xToPx(COPPER_STRIP.rightGapCenterX), 46);
    ctx.fillText("C", xToPx(0.525), 95);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function MeterBridge({
  state,
  unknownLabel,
  quality,
  onWireTap,
  onWireDrag,
}: MeterBridgeProps) {
  const getThree = useThree((s) => s.get);
  const terminalsPostRef = useRef<THREE.InstancedMesh>(null);
  const terminalsCapRef = useRef<THREE.InstancedMesh>(null);
  const scrapeMeshesRef = useRef<Array<THREE.Mesh | null>>([]);
  const pointerStateRef = useRef<{
    active: boolean;
    pointerId: number;
    downClientX: number;
    downClientY: number;
    startCm: number;
    lastCm: number;
    dragged: boolean;
  }>({
    active: false,
    pointerId: -1,
    downClientX: 0,
    downClientY: 0,
    startCm: 50,
    lastCm: 50,
    dragged: false,
  });

  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 8 : 16;

    const baseGeo = new THREE.BoxGeometry(
      BRIDGE_BASE.length,
      BRIDGE_BASE.height,
      BRIDGE_BASE.depth,
    );
    const ruleGeo = new THREE.BoxGeometry(
      METRE_RULE.length + 0.02,
      METRE_RULE.thickness,
      METRE_RULE.depth,
    );
    const labelPlaneGeo = new THREE.PlaneGeometry(BRIDGE_BASE.length, BRIDGE_BASE.depth);

    // Copper strip geometries
    const leftBackLength =
      COPPER_STRIP.leftGapCenterX - COPPER_STRIP.gapWidth / 2 - (-0.5 - COPPER_STRIP.width / 2);
    const leftBackCenterX =
      (-0.5 - COPPER_STRIP.width / 2 + (COPPER_STRIP.leftGapCenterX - COPPER_STRIP.gapWidth / 2)) /
      2;

    const middleLength =
      COPPER_STRIP.rightGapCenterX -
      COPPER_STRIP.gapWidth / 2 -
      (COPPER_STRIP.leftGapCenterX + COPPER_STRIP.gapWidth / 2);

    const armDepth = COPPER_STRIP.frontZ - COPPER_STRIP.backZ + COPPER_STRIP.width;
    const armCenterZ = (COPPER_STRIP.frontZ + COPPER_STRIP.backZ) / 2;

    const endBackStripGeo = new THREE.BoxGeometry(
      leftBackLength,
      COPPER_STRIP.thickness,
      COPPER_STRIP.width,
    );
    const endSideArmGeo = new THREE.BoxGeometry(
      COPPER_STRIP.width,
      COPPER_STRIP.thickness,
      armDepth,
    );
    const middleStripGeo = new THREE.BoxGeometry(
      middleLength,
      COPPER_STRIP.thickness,
      COPPER_STRIP.width,
    );

    // Constantan wire (rotated cylinder along X axis) + bright sheen highlight core
    const wireGeo = new THREE.CylinderGeometry(
      BRIDGE_WIRE.renderRadius,
      BRIDGE_WIRE.renderRadius,
      BRIDGE_WIRE.length,
      radialSegments,
    );
    wireGeo.rotateZ(Math.PI / 2);

    const wireHighlightGeo = new THREE.BoxGeometry(BRIDGE_WIRE.length, 0.0008, 0.0012);

    const scrapeGeo = new THREE.BoxGeometry(1, 0.0014, 0.0038);
    const hitBoxGeo = new THREE.BoxGeometry(
      BRIDGE_WIRE.length,
      BRIDGE_WIRE.hitBoxHeight,
      BRIDGE_WIRE.hitBoxDepth,
    );

    const terminalPostGeo = new THREE.CylinderGeometry(
      TERMINAL_SCREW.postRadius,
      TERMINAL_SCREW.baseRadius,
      TERMINAL_SCREW.postHeight,
      radialSegments,
    );
    const terminalCapGeo = new THREE.CylinderGeometry(
      TERMINAL_SCREW.capRadius,
      TERMINAL_SCREW.capRadius,
      TERMINAL_SCREW.capHeight,
      radialSegments,
    );

    const ruleTexture = createMetreRuleTexture();

    const woodMat = new THREE.MeshStandardMaterial({
      color: "#6b3e23",
      roughness: 0.62,
      metalness: 0.05,
    });
    const ruleSideMat = new THREE.MeshStandardMaterial({
      color: "#d9cca8",
      roughness: 0.55,
      metalness: 0.02,
    });
    const ruleTopMat = new THREE.MeshStandardMaterial({
      map: ruleTexture,
      roughness: 0.48,
      metalness: 0.02,
    });
    const copperMat = new THREE.MeshStandardMaterial({
      color: "#b86b35",
      metalness: 0.76,
      roughness: 0.28,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      metalness: 0.82,
      roughness: 0.24,
    });
    const wireMat = new THREE.MeshStandardMaterial({
      color: "#c8cdd4",
      metalness: 0.85,
      roughness: 0.2,
    });
    const wireHighlightMat = new THREE.MeshBasicMaterial({
      color: "#e6ebf2",
    });
    const scrapeMat = new THREE.MeshBasicMaterial({
      color: "#f59e0b",
    });
    const hitBoxMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    return {
      baseGeo,
      ruleGeo,
      labelPlaneGeo,
      endBackStripGeo,
      endSideArmGeo,
      middleStripGeo,
      leftBackCenterX,
      armCenterZ,
      wireGeo,
      wireHighlightGeo,
      scrapeGeo,
      hitBoxGeo,
      terminalPostGeo,
      terminalCapGeo,
      ruleTexture,
      woodMat,
      ruleSideMat,
      ruleTopMat,
      copperMat,
      brassMat,
      wireMat,
      wireHighlightMat,
      scrapeMat,
      hitBoxMat,
    };
  }, [quality]);

  const labelMat = useMemo(() => {
    const tex = createBridgeLabelsTexture(unknownLabel);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    return { tex, mat };
  }, [unknownLabel]);

  useEffect(() => {
    return () => {
      labelMat.tex.dispose();
      labelMat.mat.dispose();
    };
  }, [labelMat]);

  useEffect(() => {
    return () => {
      res.baseGeo.dispose();
      res.ruleGeo.dispose();
      res.labelPlaneGeo.dispose();
      res.endBackStripGeo.dispose();
      res.endSideArmGeo.dispose();
      res.middleStripGeo.dispose();
      res.wireGeo.dispose();
      res.wireHighlightGeo.dispose();
      res.scrapeGeo.dispose();
      res.hitBoxGeo.dispose();
      res.terminalPostGeo.dispose();
      res.terminalCapGeo.dispose();
      res.ruleTexture.dispose();
      res.woodMat.dispose();
      res.ruleSideMat.dispose();
      res.ruleTopMat.dispose();
      res.copperMat.dispose();
      res.brassMat.dispose();
      res.wireMat.dispose();
      res.wireHighlightMat.dispose();
      res.scrapeMat.dispose();
      res.hitBoxMat.dispose();
    };
  }, [res]);

  // Populate instanced binding screws whenever geometry resources are built
  useEffect(() => {
    const postMesh = terminalsPostRef.current;
    const capMesh = terminalsCapRef.current;
    if (!postMesh || !capMesh || !res.terminalPostGeo || !res.terminalCapGeo) return;

    const terminalCoords: Array<readonly [number, number, number]> = [
      BRIDGE_TERMINAL_POSITIONS.A,
      [-0.5, 0.003, COPPER_STRIP.backZ],
      BRIDGE_TERMINAL_POSITIONS.leftGapLeft,
      BRIDGE_TERMINAL_POSITIONS.leftGapRight,
      BRIDGE_TERMINAL_POSITIONS.B,
      BRIDGE_TERMINAL_POSITIONS.rightGapLeft,
      BRIDGE_TERMINAL_POSITIONS.rightGapRight,
      [0.5, 0.003, COPPER_STRIP.backZ],
      BRIDGE_TERMINAL_POSITIONS.C,
    ];

    const dummy = new THREE.Object3D();
    terminalCoords.forEach((pos, idx) => {
      dummy.position.set(pos[0], pos[1] + TERMINAL_SCREW.postHeight / 2, pos[2]);
      dummy.updateMatrix();
      postMesh.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(
        pos[0],
        pos[1] + TERMINAL_SCREW.postHeight + TERMINAL_SCREW.capHeight / 2,
        pos[2],
      );
      dummy.updateMatrix();
      capMesh.setMatrixAt(idx, dummy.matrix);
    });
    postMesh.instanceMatrix.needsUpdate = true;
    capMesh.instanceMatrix.needsUpdate = true;
  }, [res]);

  // Update wire scrape meshes inside useFrame without allocating (show last 24 segments)
  useFrame(() => {
    const scrapes = state.current.scrapesCm;
    const meshes = scrapeMeshesRef.current;
    const count = scrapes.length;
    const startIdx = Math.max(0, count - MAX_SCRAPE_POOL);
    const visibleCount = count - startIdx;
    for (let i = 0; i < MAX_SCRAPE_POOL; i++) {
      const mesh = meshes[i];
      if (!mesh) continue;
      const seg = i < visibleCount ? scrapes[startIdx + i] : undefined;
      if (!seg) {
        mesh.visible = false;
        continue;
      }
      const x0 = cmToX(seg[0]);
      const x1 = cmToX(seg[1]);
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const width = Math.max(0.004, maxX - minX);
      mesh.visible = true;
      mesh.position.x = (minX + maxX) / 2;
      mesh.scale.x = width;
    }
  });

  const setControlsEnabled = (enabled: boolean) => {
    const controls = getThree().controls;
    if (controls && "enabled" in controls) {
      (controls as { enabled: boolean }).enabled = enabled;
    }
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    e.object.worldToLocal(_localPoint.copy(e.point));
    _wirePlane.set(_planeNormalY, -_localPoint.y);
    const cm = xToCm(_localPoint.x);
    pointerStateRef.current.active = true;
    pointerStateRef.current.pointerId = e.pointerId;
    pointerStateRef.current.downClientX = e.nativeEvent.clientX;
    pointerStateRef.current.downClientY = e.nativeEvent.clientY;
    pointerStateRef.current.startCm = cm;
    pointerStateRef.current.lastCm = cm;
    pointerStateRef.current.dragged = false;
    setControlsEnabled(false);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const ps = pointerStateRef.current;
    if (!ps.active || e.pointerId !== ps.pointerId) return;
    e.stopPropagation();
    const dx = e.nativeEvent.clientX - ps.downClientX;
    const dy = e.nativeEvent.clientY - ps.downClientY;
    const dist = Math.hypot(dx, dy);
    const cm = rayToLocalCm(e);
    if (dist >= 4) {
      ps.dragged = true;
      if (Math.abs(cm - ps.lastCm) > 0.05) {
        onWireDrag?.(ps.lastCm, cm);
        ps.lastCm = cm;
      }
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    const ps = pointerStateRef.current;
    if (!ps.active || e.pointerId !== ps.pointerId) return;
    e.stopPropagation();
    ps.active = false;
    ps.pointerId = -1;
    setControlsEnabled(true);
    const target = e.target as Element;
    if (target.hasPointerCapture?.(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    const dx = e.nativeEvent.clientX - ps.downClientX;
    const dy = e.nativeEvent.clientY - ps.downClientY;
    const dist = Math.hypot(dx, dy);
    const cm = rayToLocalCm(e);
    if (!ps.dragged && dist < 4) {
      onWireTap?.(cm);
    }
  };

  const handlePointerCancel = (e: ThreeEvent<PointerEvent>) => {
    const ps = pointerStateRef.current;
    if (!ps.active) return;
    ps.active = false;
    ps.pointerId = -1;
    setControlsEnabled(true);
    const target = e.target as Element;
    if (target.hasPointerCapture?.(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
  };

  const handleLostPointerCapture = () => {
    const ps = pointerStateRef.current;
    if (!ps.active) return;
    ps.active = false;
    ps.pointerId = -1;
    setControlsEnabled(true);
  };

  const ruleMaterials = useMemo(
    () => [
      res.ruleSideMat,
      res.ruleSideMat,
      res.ruleTopMat,
      res.ruleSideMat,
      res.ruleSideMat,
      res.ruleSideMat,
    ],
    [res.ruleSideMat, res.ruleTopMat],
  );

  const scrapeIndices = useMemo(() => Array.from({ length: MAX_SCRAPE_POOL }, (_, idx) => idx), []);

  return (
    <group>
      {/* Wooden metre bridge base (top surface at y = 0) */}
      <mesh
        geometry={res.baseGeo}
        material={res.woodMat}
        position={[0, -BRIDGE_BASE.height / 2, 0]}
        receiveShadow
        castShadow
      />

      {/* Crisp painted labels (A, R, B, X, C) on top of the wooden base */}
      <mesh
        geometry={res.labelPlaneGeo}
        material={labelMat.mat}
        position={[0, 0.0004, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* 100 cm boxwood metre rule with mm and cm graduations */}
      <mesh
        geometry={res.ruleGeo}
        material={ruleMaterials}
        position={[0, METRE_RULE.thickness / 2, METRE_RULE.z]}
        receiveShadow
      />

      {/* Thick copper strips: Left L-shaped strip (end A to left gap) */}
      <mesh
        geometry={res.endBackStripGeo}
        material={res.copperMat}
        position={[res.leftBackCenterX, COPPER_STRIP.thickness / 2, COPPER_STRIP.backZ]}
        receiveShadow
        castShadow
      />
      <mesh
        geometry={res.endSideArmGeo}
        material={res.copperMat}
        position={[-0.5, COPPER_STRIP.thickness / 2, res.armCenterZ]}
        receiveShadow
        castShadow
      />

      {/* Middle copper strip between left gap (R) and right gap (X) */}
      <mesh
        geometry={res.middleStripGeo}
        material={res.copperMat}
        position={[0, COPPER_STRIP.thickness / 2, COPPER_STRIP.backZ]}
        receiveShadow
        castShadow
      />

      {/* Right L-shaped copper strip (right gap to end C) */}
      <mesh
        geometry={res.endBackStripGeo}
        material={res.copperMat}
        position={[-res.leftBackCenterX, COPPER_STRIP.thickness / 2, COPPER_STRIP.backZ]}
        receiveShadow
        castShadow
      />
      <mesh
        geometry={res.endSideArmGeo}
        material={res.copperMat}
        position={[0.5, COPPER_STRIP.thickness / 2, res.armCenterZ]}
        receiveShadow
        castShadow
      />

      {/* Instanced brass binding-screw terminals (9 total) */}
      <instancedMesh
        ref={terminalsPostRef}
        args={[res.terminalPostGeo, res.brassMat, 9]}
        castShadow
      />
      <instancedMesh
        ref={terminalsCapRef}
        args={[res.terminalCapGeo, res.brassMat, 9]}
        castShadow
      />

      {/* 100 cm constantan wire + thin bright highlight line so it never vanishes on phone screens */}
      <mesh
        geometry={res.wireGeo}
        material={res.wireMat}
        position={[0, BRIDGE_WIRE.y, BRIDGE_WIRE.z]}
      />
      <mesh
        geometry={res.wireHighlightGeo}
        material={res.wireHighlightMat}
        position={[0, BRIDGE_WIRE.y + BRIDGE_WIRE.renderRadius * 0.75, BRIDGE_WIRE.z]}
      />

      {/* Pool of reusable scratch meshes drawn where the jockey was dragged */}
      {scrapeIndices.map((idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            scrapeMeshesRef.current[idx] = el;
          }}
          geometry={res.scrapeGeo}
          material={res.scrapeMat}
          position={[0, BRIDGE_WIRE.y + BRIDGE_WIRE.renderRadius, BRIDGE_WIRE.z]}
          visible={false}
        />
      ))}

      {/* Invisible wider hit box for tap and drag along the wire */}
      <mesh
        geometry={res.hitBoxGeo}
        material={res.hitBoxMat}
        position={[0, BRIDGE_WIRE.y + 0.004, BRIDGE_WIRE.z]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
      />

      {/* Sliding/tapping knife-edge jockey */}
      <Jockey state={state} quality={quality} />
    </group>
  );
}
