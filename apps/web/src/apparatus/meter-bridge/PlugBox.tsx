import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PLUG_BOX_DIMS, plugPositions, TERMINAL_SCREW } from "./dimensions";
import type { MeterBridgeVisualState, QualityTier } from "./types";

export interface PlugBoxProps {
  state: { current: MeterBridgeVisualState };
  plugLabels: string[];
  quality: QualityTier;
  position?: readonly [number, number, number];
  onPlugToggle?: ((index: number) => void) | undefined;
}

function createPlugLabelsTexture(
  labels: string[],
  xs: number[],
  boxWidth: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4e8c1";
    ctx.font = "bold 24px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < labels.length; i++) {
      const raw = labels[i] ?? "";
      const x = xs[i] ?? 0;
      const text = raw.includes("Ω") ? raw : `${raw}Ω`;
      const px = ((x + boxWidth / 2) / boxWidth) * canvas.width;
      ctx.fillText(text, px, canvas.height / 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function PlugBox({
  state,
  plugLabels,
  quality,
  position = [0, 0, 0],
  onPlugToggle,
}: PlugBoxProps) {
  const plugGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const xs = useMemo(() => plugPositions(plugLabels.length), [plugLabels.length]);

  const blocksLayout = useMemo(() => {
    const halfW = PLUG_BOX_DIMS.width / 2 - 0.008;
    const gap = PLUG_BOX_DIMS.blockGap;
    if (xs.length === 0) {
      return [{ centerX: 0, width: halfW * 2 }];
    }
    const items: Array<{ centerX: number; width: number }> = [];
    for (let i = 0; i <= xs.length; i++) {
      const leftEdge = i === 0 ? -halfW : (xs[i - 1] ?? 0) + gap / 2;
      const rightEdge = i === xs.length ? halfW : (xs[i] ?? 0) - gap / 2;
      const w = Math.max(0.006, rightEdge - leftEdge);
      items.push({ centerX: (leftEdge + rightEdge) / 2, width: w });
    }
    return items;
  }, [xs]);

  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 10 : 18;
    const bodyHeight = PLUG_BOX_DIMS.height - PLUG_BOX_DIMS.topThickness;

    const woodBodyGeo = new THREE.BoxGeometry(
      PLUG_BOX_DIMS.width - 0.004,
      bodyHeight,
      PLUG_BOX_DIMS.depth - 0.004,
    );
    const eboniteTopGeo = new THREE.BoxGeometry(
      PLUG_BOX_DIMS.width,
      PLUG_BOX_DIMS.topThickness,
      PLUG_BOX_DIMS.depth,
    );
    const unitBlockGeo = new THREE.BoxGeometry(
      1,
      PLUG_BOX_DIMS.blockHeight,
      PLUG_BOX_DIMS.blockDepth,
    );
    const labelPlaneGeo = new THREE.PlaneGeometry(PLUG_BOX_DIMS.width, 0.022);

    const plugShaftGeo = new THREE.CylinderGeometry(
      PLUG_BOX_DIMS.plugShaftRadiusTop,
      PLUG_BOX_DIMS.plugShaftRadiusBottom,
      PLUG_BOX_DIMS.plugShaftHeight,
      radialSegments,
    );
    const plugHeadGeo = new THREE.CylinderGeometry(
      PLUG_BOX_DIMS.plugHeadRadius,
      PLUG_BOX_DIMS.plugHeadRadius * 0.9,
      PLUG_BOX_DIMS.plugHeadHeight,
      radialSegments,
    );
    const plugHitGeo = new THREE.CylinderGeometry(
      PLUG_BOX_DIMS.plugHeadRadius * 1.45,
      PLUG_BOX_DIMS.plugHeadRadius * 1.45,
      PLUG_BOX_DIMS.plugShaftHeight + PLUG_BOX_DIMS.plugHeadHeight + 0.01,
      8,
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

    const woodMat = new THREE.MeshStandardMaterial({
      color: "#5c3317",
      roughness: 0.58,
      metalness: 0.06,
    });
    const eboniteMat = new THREE.MeshStandardMaterial({
      color: "#18181b",
      roughness: 0.38,
      metalness: 0.08,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      metalness: 0.82,
      roughness: 0.24,
    });
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    return {
      bodyHeight,
      woodBodyGeo,
      eboniteTopGeo,
      unitBlockGeo,
      labelPlaneGeo,
      plugShaftGeo,
      plugHeadGeo,
      plugHitGeo,
      terminalPostGeo,
      terminalCapGeo,
      woodMat,
      eboniteMat,
      brassMat,
      hitMat,
    };
  }, [quality]);

  const labelRes = useMemo(() => {
    const tex = createPlugLabelsTexture(plugLabels, xs, PLUG_BOX_DIMS.width);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    return { tex, mat };
  }, [plugLabels, xs]);

  useEffect(() => {
    return () => {
      labelRes.tex.dispose();
      labelRes.mat.dispose();
    };
  }, [labelRes]);

  useEffect(() => {
    return () => {
      res.woodBodyGeo.dispose();
      res.eboniteTopGeo.dispose();
      res.unitBlockGeo.dispose();
      res.labelPlaneGeo.dispose();
      res.plugShaftGeo.dispose();
      res.plugHeadGeo.dispose();
      res.plugHitGeo.dispose();
      res.terminalPostGeo.dispose();
      res.terminalCapGeo.dispose();
      res.woodMat.dispose();
      res.eboniteMat.dispose();
      res.brassMat.dispose();
      res.hitMat.dispose();
    };
  }, [res]);

  const topSurfaceY = PLUG_BOX_DIMS.height;
  const blockTopY = topSurfaceY + PLUG_BOX_DIMS.blockHeight;

  useFrame(() => {
    const plugsIn = state.current.plugsIn;
    const refs = plugGroupRefs.current;
    for (let i = 0; i < xs.length; i++) {
      const grp = refs[i];
      if (!grp) continue;
      const x = xs[i] ?? 0;
      const isIn = plugsIn[i] ?? true;
      if (isIn) {
        grp.position.set(x, topSurfaceY + 0.002, -0.006);
        grp.rotation.set(0, 0, 0);
      } else {
        // Drawn lying on the bench in front of the resistance box
        grp.position.set(x, PLUG_BOX_DIMS.plugHeadRadius, PLUG_BOX_DIMS.depth / 2 + 0.022);
        grp.rotation.set(Math.PI / 2, 0, 0.2);
      }
    }
  });

  const handlePlugPointerDown = (index: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onPlugToggle?.(index);
  };

  const leftTermX = -PLUG_BOX_DIMS.width / 2 + 0.014;
  const rightTermX = PLUG_BOX_DIMS.width / 2 - 0.014;

  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* Polished mahogany box body */}
      <mesh
        geometry={res.woodBodyGeo}
        material={res.woodMat}
        position={[0, res.bodyHeight / 2, 0]}
        castShadow
        receiveShadow
      />

      {/* Black ebonite top plate */}
      <mesh
        geometry={res.eboniteTopGeo}
        material={res.eboniteMat}
        position={[0, res.bodyHeight + PLUG_BOX_DIMS.topThickness / 2, 0]}
        castShadow
        receiveShadow
      />

      {/* Segmented heavy brass blocks */}
      {blocksLayout.map((b) => (
        <mesh
          key={b.centerX}
          geometry={res.unitBlockGeo}
          material={res.brassMat}
          position={[b.centerX, topSurfaceY + PLUG_BOX_DIMS.blockHeight / 2, -0.006]}
          scale={[b.width, 1, 1]}
          castShadow
          receiveShadow
        />
      ))}

      {/* Engraved resistance value labels on the ebonite plate */}
      <mesh
        geometry={res.labelPlaneGeo}
        material={labelRes.mat}
        position={[0, topSurfaceY + 0.0005, 0.024]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* Left and right binding terminals */}
      <mesh
        geometry={res.terminalPostGeo}
        material={res.brassMat}
        position={[leftTermX, blockTopY + TERMINAL_SCREW.postHeight / 2, -0.006]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[
          leftTermX,
          blockTopY + TERMINAL_SCREW.postHeight + TERMINAL_SCREW.capHeight / 2,
          -0.006,
        ]}
        castShadow
      />
      <mesh
        geometry={res.terminalPostGeo}
        material={res.brassMat}
        position={[rightTermX, blockTopY + TERMINAL_SCREW.postHeight / 2, -0.006]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[
          rightTermX,
          blockTopY + TERMINAL_SCREW.postHeight + TERMINAL_SCREW.capHeight / 2,
          -0.006,
        ]}
        castShadow
      />

      {/* Tapered brass plugs with fluted ebonite heads + slot hit targets */}
      {xs.map((x, idx) => (
        <group key={x}>
          {/* Static hit target on the slot so clicking an empty slot also toggles the plug back in */}
          <mesh
            geometry={res.plugHitGeo}
            material={res.hitMat}
            position={[x, topSurfaceY + 0.016, -0.006]}
            onPointerDown={handlePlugPointerDown(idx)}
          />
          <group
            ref={(el) => {
              plugGroupRefs.current[idx] = el;
            }}
            position={[x, topSurfaceY + 0.002, -0.006]}
            onPointerDown={handlePlugPointerDown(idx)}
          >
            <mesh
              geometry={res.plugShaftGeo}
              material={res.brassMat}
              position={[0, PLUG_BOX_DIMS.plugShaftHeight / 2, 0]}
              castShadow
            />
            <mesh
              geometry={res.plugHeadGeo}
              material={res.eboniteMat}
              position={[0, PLUG_BOX_DIMS.plugShaftHeight + PLUG_BOX_DIMS.plugHeadHeight / 2, 0]}
              castShadow
            />
          </group>
        </group>
      ))}
    </group>
  );
}
