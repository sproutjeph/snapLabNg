import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import {
  bakeliteMaterial,
  brassSurface,
  disposeKitBag,
  kitTexture,
  paintMaterial,
  paperMaterial,
  woodMaterial,
} from "../materials";
import { LEAD_BASE_COLOURS, seeded } from "./LeadParts";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import { buildTray, type TrayItemKey, type TrayMat } from "./TrayParts";
import { makeBrassTexture, makeCeramicTexture, makeGritTexture } from "./WireBoardTextures";

export type TrayItem = "leads" | "sandpaper" | "rheostat" | "micrometer";

export interface TrayProps extends PartProps {
  onItemTap?: (item: TrayItem) => void;
}

const ITEMS: TrayItemKey[] = ["leads", "sandpaper", "rheostat", "micrometer"];

/**
 * The side tray: a mahogany tray holding spare leads (two with crocodile clips), a sandpaper
 * strip, and the rheostat and micrometer screw gauge (Identify only). Tapping an item calls
 * `onItemTap`. Nothing on it carries a name or a rating: the student identifies it by sight.
 */
export function Tray({ quality, position, rotationY = 0, onItemTap }: TrayProps) {
  const res = useMemo(() => {
    const rng = seeded(0x7a4);
    const build = buildTray(quality, rng);
    const woodTex = kitTexture("mahogany", quality);
    const bakeTex = kitTexture("bakelite", quality);
    const brassTex = makeBrassTexture(quality, 0x7a49);
    const ceramicTex = makeCeramicTexture(quality);
    const grit = makeGritTexture(rng);
    const mats: Record<TrayMat, THREE.MeshStandardMaterial> = {
      wood: woodMaterial(0x7a41, { map: woodTex }),
      red: paintMaterial(LEAD_BASE_COLOURS.red, 0x7a42),
      black: paintMaterial(LEAD_BASE_COLOURS.black, 0x7a43),
      yellow: paintMaterial(LEAD_BASE_COLOURS.yellow, 0x7a44),
      bootRed: paintMaterial("#8c2119", 0x7a45),
      bootBlack: paintMaterial("#1e1e22", 0x7a46),
      brass: brassSurface(0x7a47, { map: brassTex }),
      steel: brassSurface(0x7a48, { tint: "#a3a7ac" }),
      grit: paperMaterial(0x7a4a, { map: grit }),
      ceramic: paintMaterial("#ffffff", 0x7a4b, { map: ceramicTex }),
      ebonite: bakeliteMaterial(0x7a4c, { map: bakeTex }),
      frame: bakeliteMaterial(0x7a4d, { map: bakeTex }),
    };
    const coilMat = brassSurface(0x7a4e, { tint: "#b8693b" });
    const coil = new THREE.InstancedMesh(build.coilGeo, coilMat, build.coilMatrices.length);
    build.coilMatrices.forEach((m, i) => {
      coil.setMatrixAt(i, m);
    });
    coil.instanceMatrix.needsUpdate = true;
    coil.castShadow = true;
    coil.frustumCulled = false;
    const hitGeos = build.hits.map((h) => ({ ...h, geo: new THREE.BoxGeometry(...h.size) }));
    return {
      build,
      woodTex,
      bakeTex,
      brassTex,
      ceramicTex,
      grit,
      mats,
      matList: Object.values(mats),
      coilMat,
      coil,
      partGeos: build.parts.map((p) => p.geo),
      coilGeo: build.coilGeo,
      hitGeos,
      hitGeoList: hitGeos.map((h) => h.geo),
      hitMat: new THREE.MeshBasicMaterial(),
    };
  }, [quality]);
  useEffect(
    () => () => {
      // The instanced coil owns no geometry or material of its own beyond these two.
      res.coil.dispose();
      disposeKitBag({
        textures: [res.woodTex, res.bakeTex, res.brassTex, res.ceramicTex, res.grit],
        materials: res.matList,
        geometries: res.partGeos,
        coilMat: res.coilMat,
        coilGeo: res.coilGeo,
        hits: res.hitGeoList,
        hitMat: res.hitMat,
      });
    },
    [res],
  );

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      {res.build.parts
        .filter((p) => p.item === null)
        .map((p) => (
          <InkGroup key={`tray-${p.mat}`} id={INK_IDS.tray + p.ink} thin={p.thin}>
            <mesh geometry={p.geo} material={res.mats[p.mat]} castShadow receiveShadow />
          </InkGroup>
        ))}
      {ITEMS.map((item) => (
        <group key={item} onPointerDown={tapOnly(() => onItemTap?.(item))}>
          {res.build.parts
            .filter((p) => p.item === item)
            .map((p) => (
              <InkGroup key={`${p.ink}-${p.mat}-${p.thin}`} id={INK_IDS.tray + p.ink} thin={p.thin}>
                <mesh geometry={p.geo} material={res.mats[p.mat]} castShadow receiveShadow />
              </InkGroup>
            ))}
          {item === "rheostat" ? (
            <InkGroup id={INK_IDS.tray + 6}>
              <primitive object={res.coil} />
            </InkGroup>
          ) : null}
          {res.hitGeos.map((h) =>
            h.item === item ? (
              <mesh
                key={`hit-${h.item}`}
                geometry={h.geo}
                material={res.hitMat}
                position={h.centre}
                visible={false}
              />
            ) : null,
          )}
        </group>
      ))}
    </group>
  );
}
