import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { QualityTier } from "../meter-bridge/types";
import { BURETTE_DIMS, FLASK_DIMS, volumeToY } from "./dimensions";
import type { TitrationVisualState } from "./types";

export interface BuretteProps {
  state: { current: TitrationVisualState };
  quality: QualityTier;
  onStopcockChange?: ((open: number) => void) | undefined;
  onFunnelToggle?: (() => void) | undefined;
}

const GRAD_TEX_WIDTH = 256;
const GRAD_TEX_HEIGHT = 2048;
const GRAD_PAD_PX = 48;
const GRAD_USABLE_PX = GRAD_TEX_HEIGHT - GRAD_PAD_PX * 2;
const GRAD_MESH_HEIGHT = BURETTE_DIMS.gradLength * (GRAD_TEX_HEIGHT / GRAD_USABLE_PX);
const GRAD_ARC_ANGLE = Math.PI * 0.72;
const GRAD_ARC_RADIUS = BURETTE_DIMS.outerRadius + 0.00035;
const GRAD_ARC_WIDTH = GRAD_ARC_RADIUS * GRAD_ARC_ANGLE;
// Pre-squash vertical glyph scale so 1 px in X and 1 px in Y map to equal physical metres on the cylinder
const GRAD_TEXT_SCALE_Y = GRAD_ARC_WIDTH / GRAD_TEX_WIDTH / (GRAD_MESH_HEIGHT / GRAD_TEX_HEIGHT);

function createBuretteGraduationsTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = GRAD_TEX_WIDTH;
  canvas.height = GRAD_TEX_HEIGHT;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle white backing strip behind the numbers for contrast from any angle
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(52, GRAD_PAD_PX - 22, 152, GRAD_USABLE_PX + 44);

    ctx.font = "bold 46px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // 500 subdivisions = every 0.1 cm³ from 0.0 to 50.0
    for (let tenth = 0; tenth <= 500; tenth++) {
      const y = GRAD_PAD_PX + (tenth / 500) * GRAD_USABLE_PX;
      const isWhole = tenth % 10 === 0;
      const isHalf = tenth % 5 === 0;

      const xStart = 58;
      const tickLen = isWhole ? 58 : isHalf ? 40 : 24;

      // Dark halo outline for legibility against both bright and dark backgrounds
      ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
      ctx.lineWidth = isWhole ? 2.8 : isHalf ? 2.0 : 1.35;
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xStart + tickLen, y);
      ctx.stroke();

      // High-contrast ceramic white graduation ink
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = isWhole ? 1.65 : isHalf ? 1.15 : 0.75;
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xStart + tickLen, y);
      ctx.stroke();

      if (isWhole) {
        const cm3 = tenth / 10;
        const label = String(cm3);
        ctx.save();
        ctx.translate(xStart + tickLen + 10, y);
        ctx.scale(1, GRAD_TEXT_SCALE_Y);
        ctx.lineWidth = 5.5;
        ctx.strokeStyle = "rgba(15, 23, 42, 0.92)";
        ctx.strokeText(label, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function Burette({ state, quality, onStopcockChange, onFunnelToggle }: BuretteProps) {
  const liquidColumnRef = useRef<THREE.Mesh>(null);
  const meniscusGroupRef = useRef<THREE.Group>(null);
  const stopcockHandleRef = useRef<THREE.Group>(null);
  const dropMeshRef = useRef<THREE.Mesh>(null);
  const dropPhaseRef = useRef(0);
  const holdingStopcockRef = useRef(false);
  const onStopcockChangeRef = useRef(onStopcockChange);
  onStopcockChangeRef.current = onStopcockChange;

  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 16 : 32;
    const {
      innerRadius,
      outerRadius,
      jetTipY,
      jetTopY,
      stopcockY,
      tubeBottomY,
      topY,
      meniscusDepth,
    } = BURETTE_DIMS;

    const mainTubeHeight = topY - tubeBottomY;
    const mainTubeGeo = new THREE.CylinderGeometry(
      outerRadius,
      outerRadius,
      mainTubeHeight,
      radialSegments,
      1,
      true,
    );

    const topLipGeo = new THREE.TorusGeometry(outerRadius + 0.0006, 0.0014, 8, radialSegments);
    topLipGeo.rotateX(Math.PI / 2);

    // Front graduation overlay arc (-0.36π to +0.36π around +Z)
    const gradOverlayGeo = new THREE.CylinderGeometry(
      outerRadius + 0.00035,
      outerRadius + 0.00035,
      GRAD_MESH_HEIGHT,
      radialSegments,
      1,
      true,
      -Math.PI * 0.36,
      Math.PI * 0.72,
    );

    // Unit cylinder for the liquid column, scaled along Y inside useFrame
    const liquidColGeo = new THREE.CylinderGeometry(
      innerRadius * 0.95,
      innerRadius * 0.95,
      1,
      radialSegments,
    );

    // Concave meniscus cup: outer rim rises to meniscusDepth, inner center touches y = 0 (reading line)
    const meniscusProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(innerRadius * 0.45, meniscusDepth * 0.18),
      new THREE.Vector2(innerRadius * 0.78, meniscusDepth * 0.52),
      new THREE.Vector2(innerRadius * 0.95, meniscusDepth),
      new THREE.Vector2(innerRadius * 0.95, 0),
    ];
    const meniscusCupGeo = new THREE.LatheGeometry(meniscusProfile, radialSegments);
    const meniscusBottomRingGeo = new THREE.TorusGeometry(
      innerRadius * 0.92,
      0.00045,
      8,
      radialSegments,
    );
    meniscusBottomRingGeo.rotateX(Math.PI / 2);

    // Stopcock housing and rotatable PTFE key
    const valveBodyHeight = tubeBottomY - jetTopY;
    const valveSleeveGeo = new THREE.CylinderGeometry(
      outerRadius * 1.15,
      outerRadius * 1.05,
      valveBodyHeight,
      radialSegments,
    );
    const barrelGeo = new THREE.CylinderGeometry(0.0065, 0.0055, 0.036, radialSegments);
    barrelGeo.rotateZ(Math.PI / 2);

    const handleBarGeo = new THREE.BoxGeometry(0.005, 0.028, 0.009);
    const nutGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.005, 12);
    nutGeo.rotateZ(Math.PI / 2);

    // Tapering delivery jet from jetTopY down to jetTipY
    const jetHeight = jetTopY - jetTipY;
    const jetGeo = new THREE.CylinderGeometry(
      outerRadius * 0.72,
      0.0018,
      jetHeight,
      radialSegments,
    );
    const jetLiquidGeo = new THREE.CylinderGeometry(
      innerRadius * 0.55,
      0.0011,
      jetHeight,
      radialSegments,
    );

    // Falling droplet geometry
    const dropGeo = new THREE.SphereGeometry(0.0022, 12, 12);
    dropGeo.scale(0.85, 1.35, 0.85);

    // Hitboxes for stopcock and burette top
    const stopcockHitGeo = new THREE.BoxGeometry(0.055, 0.045, 0.045);
    const topHitGeo = new THREE.CylinderGeometry(outerRadius * 2.4, outerRadius * 2.4, 0.05, 12);

    const gradTex = createBuretteGraduationsTexture();

    const glassMat =
      quality === "low"
        ? new THREE.MeshStandardMaterial({
            color: "#e0f2fe",
            transparent: true,
            opacity: 0.32,
            roughness: 0.16,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: "#f0f9ff",
            transparent: true,
            opacity: 0.34,
            roughness: 0.06,
            metalness: 0.02,
            clearcoat: 0.92,
            side: THREE.DoubleSide,
            depthWrite: false,
          });

    const gradMat = new THREE.MeshBasicMaterial({
      map: gradTex,
      transparent: true,
      depthWrite: false,
    });

    const titrantMat = new THREE.MeshStandardMaterial({
      color: "#93c5fd",
      transparent: true,
      opacity: 0.52,
      roughness: 0.12,
      depthWrite: false,
    });

    const meniscusRimMat = new THREE.MeshBasicMaterial({
      color: "#1e3a8a",
      transparent: true,
      opacity: 0.75,
    });

    const ptfeWhiteMat = new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.35,
      metalness: 0.02,
    });

    const ptfeHandleMat = new THREE.MeshStandardMaterial({
      color: "#2563eb",
      roughness: 0.32,
      metalness: 0.08,
    });

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    return {
      mainTubeGeo,
      topLipGeo,
      gradOverlayGeo,
      liquidColGeo,
      meniscusCupGeo,
      meniscusBottomRingGeo,
      valveSleeveGeo,
      barrelGeo,
      handleBarGeo,
      nutGeo,
      jetGeo,
      jetLiquidGeo,
      dropGeo,
      stopcockHitGeo,
      topHitGeo,
      gradTex,
      glassMat,
      gradMat,
      titrantMat,
      meniscusRimMat,
      ptfeWhiteMat,
      ptfeHandleMat,
      hitMat,
      mainTubeHeight,
      valveBodyHeight,
      jetHeight,
      stopcockY,
    };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.mainTubeGeo.dispose();
      res.topLipGeo.dispose();
      res.gradOverlayGeo.dispose();
      res.liquidColGeo.dispose();
      res.meniscusCupGeo.dispose();
      res.meniscusBottomRingGeo.dispose();
      res.valveSleeveGeo.dispose();
      res.barrelGeo.dispose();
      res.handleBarGeo.dispose();
      res.nutGeo.dispose();
      res.jetGeo.dispose();
      res.jetLiquidGeo.dispose();
      res.dropGeo.dispose();
      res.stopcockHitGeo.dispose();
      res.topHitGeo.dispose();
      res.gradTex.dispose();
      res.glassMat.dispose();
      res.gradMat.dispose();
      res.titrantMat.dispose();
      res.meniscusRimMat.dispose();
      res.ptfeWhiteMat.dispose();
      res.ptfeHandleMat.dispose();
      res.hitMat.dispose();
    };
  }, [res]);

  useEffect(() => {
    const handleWindowUp = () => {
      if (holdingStopcockRef.current) {
        holdingStopcockRef.current = false;
        onStopcockChangeRef.current?.(0);
      }
    };
    window.addEventListener("pointerup", handleWindowUp);
    window.addEventListener("pointercancel", handleWindowUp);
    return () => {
      window.removeEventListener("pointerup", handleWindowUp);
      window.removeEventListener("pointercancel", handleWindowUp);
    };
  }, []);

  // Unmount-only guard: close the stopcock if the kit unmounts while held open
  useEffect(() => {
    return () => {
      if (holdingStopcockRef.current) {
        holdingStopcockRef.current = false;
        onStopcockChangeRef.current?.(0);
      }
    };
  }, []);

  useFrame((_, delta) => {
    const cur = state.current;
    const meniscusY = volumeToY(cur.buretteReadingCm3);
    const colBottomY = BURETTE_DIMS.tubeBottomY;
    const colHeight = Math.max(0.001, meniscusY - colBottomY);

    if (liquidColumnRef.current) {
      liquidColumnRef.current.scale.y = colHeight;
      liquidColumnRef.current.position.y = colBottomY + colHeight / 2;
    }

    if (meniscusGroupRef.current) {
      // Bottom of the concave meniscus sits exactly at meniscusY
      meniscusGroupRef.current.position.y = meniscusY;
    }

    if (stopcockHandleRef.current) {
      // Closed (0) = horizontal (Math.PI / 2), Open (1) = vertical (0)
      const open = Math.min(1, Math.max(0, cur.stopcockOpen));
      stopcockHandleRef.current.rotation.x = (1 - open) * (Math.PI / 2);
    }

    if (dropMeshRef.current) {
      if (cur.dropping) {
        dropMeshRef.current.visible = true;
        dropPhaseRef.current = (dropPhaseRef.current + delta * 4.5) % 1;
        const t = dropPhaseRef.current;
        const fallStart = BURETTE_DIMS.jetTipY - 0.002;
        const fallEnd = FLASK_DIMS.baseY + 0.025;
        dropMeshRef.current.position.y = fallStart - t * t * (fallStart - fallEnd);
      } else {
        dropMeshRef.current.visible = false;
        dropPhaseRef.current = 0;
      }
    }
  });

  const handleStopcockDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    holdingStopcockRef.current = true;
    onStopcockChange?.(1);
  };

  const handleStopcockUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (holdingStopcockRef.current) {
      holdingStopcockRef.current = false;
      onStopcockChange?.(0);
    }
  };

  const handleTopPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onFunnelToggle?.();
  };

  const { jetTipY, tubeBottomY, gradBottomY, gradTopY, topY, stopcockY } = BURETTE_DIMS;
  const gradCenterY = (gradTopY + gradBottomY) / 2;
  const initialMeniscusY = volumeToY(0);
  const initialColHeight = initialMeniscusY - tubeBottomY;

  return (
    <group>
      {/* Titrant liquid column inside the burette */}
      <mesh
        ref={liquidColumnRef}
        geometry={res.liquidColGeo}
        material={res.titrantMat}
        position={[0, tubeBottomY + initialColHeight / 2, 0]}
        scale={[1, initialColHeight, 1]}
        renderOrder={1}
      />

      {/* Concave meniscus with bottom resting at volumeToY(buretteReadingCm3) */}
      <group ref={meniscusGroupRef} position={[0, initialMeniscusY, 0]}>
        <mesh geometry={res.meniscusCupGeo} material={res.titrantMat} renderOrder={1} />
        <mesh geometry={res.meniscusBottomRingGeo} material={res.meniscusRimMat} renderOrder={2} />
      </group>

      {/* Main borosilicate glass burette tube */}
      <mesh
        geometry={res.mainTubeGeo}
        material={res.glassMat}
        position={[0, tubeBottomY + res.mainTubeHeight / 2, 0]}
        renderOrder={2}
      />
      <mesh geometry={res.topLipGeo} material={res.glassMat} position={[0, topY, 0]} />

      {/* Front graduation markings (0.0 at top to 50.0 at bottom) */}
      <mesh
        geometry={res.gradOverlayGeo}
        material={res.gradMat}
        position={[0, gradCenterY, 0]}
        renderOrder={3}
      />

      {/* Stopcock assembly at stopcockY */}
      <group position={[0, stopcockY, 0]}>
        <mesh geometry={res.valveSleeveGeo} material={res.glassMat} />
        <mesh geometry={res.barrelGeo} material={res.ptfeWhiteMat} castShadow />
        <mesh
          geometry={res.nutGeo}
          material={res.ptfeHandleMat}
          position={[-0.02, 0, 0]}
          castShadow
        />
        <group ref={stopcockHandleRef} position={[0.02, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh geometry={res.handleBarGeo} material={res.ptfeHandleMat} castShadow />
        </group>
        <mesh
          geometry={res.stopcockHitGeo}
          material={res.hitMat}
          onPointerDown={handleStopcockDown}
          onPointerUp={handleStopcockUp}
        />
      </group>

      {/* Tapering delivery jet reaching ~2 cm inside the flask mouth */}
      <mesh
        geometry={res.jetLiquidGeo}
        material={res.titrantMat}
        position={[0, jetTipY + res.jetHeight / 2, 0]}
        renderOrder={1}
      />
      <mesh
        geometry={res.jetGeo}
        material={res.glassMat}
        position={[0, jetTipY + res.jetHeight / 2, 0]}
        renderOrder={2}
      />

      {/* Falling drop when state.dropping is true */}
      <mesh
        ref={dropMeshRef}
        geometry={res.dropGeo}
        material={res.titrantMat}
        position={[0, jetTipY - 0.01, 0]}
        visible={false}
      />

      {/* Top rim hitbox to toggle funnel when funnel is off */}
      <mesh
        geometry={res.topHitGeo}
        material={res.hitMat}
        position={[0, topY + 0.01, 0]}
        onPointerDown={handleTopPointerDown}
      />
    </group>
  );
}
