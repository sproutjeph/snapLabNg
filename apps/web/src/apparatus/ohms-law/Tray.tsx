import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import { jitterColour, LEAD_BASE_COLOURS, seeded } from "./LeadParts";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import { buildTray, type TrayItemKey, type TrayMat } from "./TrayParts";
import { makeGritTexture } from "./WireBoardTextures";

export type TrayItem = "leads" | "sandpaper" | "rheostat" | "micrometer";

export interface TrayProps extends PartProps {
  onItemTap?: (item: TrayItem) => void;
}

const ITEMS: TrayItemKey[] = ["leads", "sandpaper", "rheostat", "micrometer"];

/**
 * The side tray: spare leads (two with crocodile clips), a sandpaper strip, and the rheostat
 * and micrometer screw gauge (Identify only). Tapping an item calls `onItemTap`.
 */
export function Tray({ quality, position, rotationY = 0, onItemTap }: TrayProps) {
  const res = useMemo(() => {
    const rng = seeded(0x7a4);
    const build = buildTray(quality, rng);
    const grit = makeGritTexture(rng);
    const mk = (hex: string, rough: number, metal = 0) =>
      new THREE.MeshStandardMaterial({
        color: jitterColour(hex, rng),
        roughness: rough,
        metalness: metal,
      });
    const mats: Record<TrayMat, THREE.MeshStandardMaterial> = {
      tray: mk("#b4bfb9", 0.8),
      red: mk(LEAD_BASE_COLOURS.red, 0.78),
      black: mk(LEAD_BASE_COLOURS.black, 0.78),
      yellow: mk(LEAD_BASE_COLOURS.yellow, 0.78),
      brass: mk("#b08d3c", 0.6, 0.2),
      steel: mk("#8d9094", 0.62, 0.3),
      jaw: mk("#9a9da1", 0.6, 0.3),
      boot: mk("#2b2b2e", 0.8),
      grit: new THREE.MeshStandardMaterial({ map: grit, roughness: 0.95 }),
      ceramic: mk("#c58a5d", 0.8),
      ebonite: mk("#1d1c1e", 0.7),
      microSteel: mk("#a3a6aa", 0.6, 0.3),
      microDark: mk("#55595e", 0.65, 0.2),
    };
    const coilMat = mk("#4d4b48", 0.7, 0.3);
    const coil = new THREE.InstancedMesh(build.coilGeo, coilMat, build.coilMatrices.length);
    build.coilMatrices.forEach((m, i) => {
      coil.setMatrixAt(i, m);
    });
    coil.instanceMatrix.needsUpdate = true;
    coil.castShadow = true;
    coil.frustumCulled = false;
    const hitGeos = build.hits.map((h) => ({ ...h, geo: new THREE.BoxGeometry(...h.size) }));
    return { build, grit, mats, coilMat, coil, hitGeos, hitMat: new THREE.MeshBasicMaterial() };
  }, [quality]);
  useEffect(
    () => () => {
      for (const p of res.build.parts) p.geo.dispose();
      res.build.coilGeo.dispose();
      for (const m of Object.values(res.mats)) m.dispose();
      res.grit.dispose();
      res.coilMat.dispose();
      res.coil.dispose();
      for (const g of res.hitGeos) g.geo.dispose();
      res.hitMat.dispose();
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
