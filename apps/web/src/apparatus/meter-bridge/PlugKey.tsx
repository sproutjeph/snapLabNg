import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PLUG_BOX_DIMS, PLUG_KEY_DIMS, TERMINAL_SCREW } from "./dimensions";
import type { MeterBridgeVisualState, QualityTier } from "./types";

export interface PlugKeyProps {
  state: { current: Pick<MeterBridgeVisualState, "keyClosed"> };
  quality: QualityTier;
  position?: readonly [number, number, number];
  onKeyToggle?: (() => void) | undefined;
}

export function PlugKey({ state, quality, position = [0, 0, 0], onKeyToggle }: PlugKeyProps) {
  const plugRef = useRef<THREE.Group>(null);

  const res = useMemo(() => {
    const radialSegments = quality === "low" ? 10 : 18;

    const baseGeo = new THREE.BoxGeometry(
      PLUG_KEY_DIMS.width,
      PLUG_KEY_DIMS.height,
      PLUG_KEY_DIMS.depth,
    );
    const blockGeo = new THREE.BoxGeometry(
      PLUG_KEY_DIMS.blockWidth,
      PLUG_KEY_DIMS.blockHeight,
      PLUG_KEY_DIMS.blockDepth,
    );
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
    const hitGeo = new THREE.BoxGeometry(
      PLUG_KEY_DIMS.width + 0.01,
      0.05,
      PLUG_KEY_DIMS.depth + 0.04,
    );

    const eboniteMat = new THREE.MeshStandardMaterial({
      color: "#18181b",
      roughness: 0.4,
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
      baseGeo,
      blockGeo,
      plugShaftGeo,
      plugHeadGeo,
      terminalPostGeo,
      terminalCapGeo,
      hitGeo,
      eboniteMat,
      brassMat,
      hitMat,
    };
  }, [quality]);

  useEffect(() => {
    return () => {
      res.baseGeo.dispose();
      res.blockGeo.dispose();
      res.plugShaftGeo.dispose();
      res.plugHeadGeo.dispose();
      res.terminalPostGeo.dispose();
      res.terminalCapGeo.dispose();
      res.hitGeo.dispose();
      res.eboniteMat.dispose();
      res.brassMat.dispose();
      res.hitMat.dispose();
    };
  }, [res]);

  const blockY = PLUG_KEY_DIMS.height + PLUG_KEY_DIMS.blockHeight / 2;
  const blockTopY = PLUG_KEY_DIMS.height + PLUG_KEY_DIMS.blockHeight;
  const blockOffsetX = PLUG_KEY_DIMS.gap / 2 + PLUG_KEY_DIMS.blockWidth / 2;
  const termOffsetX = blockOffsetX + 0.005;

  useFrame(() => {
    const grp = plugRef.current;
    if (!grp) return;
    if (state.current.keyClosed) {
      grp.position.set(0, PLUG_KEY_DIMS.height + 0.002, 0);
      grp.rotation.set(0, 0, 0);
    } else {
      grp.position.set(0, PLUG_BOX_DIMS.plugHeadRadius, PLUG_KEY_DIMS.depth / 2 + 0.018);
      grp.rotation.set(Math.PI / 2, 0, 0.28);
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onKeyToggle?.();
  };

  return (
    <group position={[position[0], position[1], position[2]]} onPointerDown={handlePointerDown}>
      {/* Ebonite base */}
      <mesh
        geometry={res.baseGeo}
        material={res.eboniteMat}
        position={[0, PLUG_KEY_DIMS.height / 2, 0]}
        castShadow
        receiveShadow
      />

      {/* Two brass blocks separated by tapered gap */}
      <mesh
        geometry={res.blockGeo}
        material={res.brassMat}
        position={[-blockOffsetX, blockY, 0]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={res.blockGeo}
        material={res.brassMat}
        position={[blockOffsetX, blockY, 0]}
        castShadow
        receiveShadow
      />

      {/* Two binding terminals */}
      <mesh
        geometry={res.terminalPostGeo}
        material={res.brassMat}
        position={[-termOffsetX, blockTopY + TERMINAL_SCREW.postHeight / 2, 0]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[
          -termOffsetX,
          blockTopY + TERMINAL_SCREW.postHeight + TERMINAL_SCREW.capHeight / 2,
          0,
        ]}
        castShadow
      />
      <mesh
        geometry={res.terminalPostGeo}
        material={res.brassMat}
        position={[termOffsetX, blockTopY + TERMINAL_SCREW.postHeight / 2, 0]}
        castShadow
      />
      <mesh
        geometry={res.terminalCapGeo}
        material={res.brassMat}
        position={[
          termOffsetX,
          blockTopY + TERMINAL_SCREW.postHeight + TERMINAL_SCREW.capHeight / 2,
          0,
        ]}
        castShadow
      />

      {/* Tapered brass plug with black ebonite handle */}
      <group ref={plugRef} position={[0, PLUG_KEY_DIMS.height + 0.002, 0]}>
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

      {/* Invisible hit volume for easy tapping */}
      <mesh geometry={res.hitGeo} material={res.hitMat} position={[0, 0.025, 0.008]} />
    </group>
  );
}
