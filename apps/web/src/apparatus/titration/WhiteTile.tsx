import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { WHITE_TILE_DIMS } from "./dimensions";

export interface WhiteTileProps {
  position?: readonly [number, number, number];
}

export function WhiteTile({ position = [0, 0, 0] }: WhiteTileProps) {
  const res = useMemo(() => {
    const baseGeo = new THREE.BoxGeometry(
      WHITE_TILE_DIMS.size,
      WHITE_TILE_DIMS.thickness * 0.75,
      WHITE_TILE_DIMS.size,
    );
    const glazeGeo = new THREE.BoxGeometry(
      WHITE_TILE_DIMS.size - 0.003,
      WHITE_TILE_DIMS.thickness * 0.25,
      WHITE_TILE_DIMS.size - 0.003,
    );

    const ceramicBaseMat = new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.55,
      metalness: 0.02,
    });
    const glazeMat = new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.14,
      metalness: 0.04,
    });

    return { baseGeo, glazeGeo, ceramicBaseMat, glazeMat };
  }, []);

  useEffect(() => {
    return () => {
      res.baseGeo.dispose();
      res.glazeGeo.dispose();
      res.ceramicBaseMat.dispose();
      res.glazeMat.dispose();
    };
  }, [res]);

  const baseH = WHITE_TILE_DIMS.thickness * 0.75;
  const glazeH = WHITE_TILE_DIMS.thickness * 0.25;

  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh
        geometry={res.baseGeo}
        material={res.ceramicBaseMat}
        position={[0, baseH / 2, 0]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={res.glazeGeo}
        material={res.glazeMat}
        position={[0, baseH + glazeH / 2, 0]}
        receiveShadow
      />
    </group>
  );
}
