import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import {
  BENCH_TILE_M,
  benchTag,
  benchTexture,
  bevelBox,
  bevelSegments,
  boxProjectUV,
  brassSurface,
  disposeKitBag,
  KEY_NUTS,
  latheOf,
  mergePieces,
  offsetUV,
  paintMaterial,
  paperMaterial,
  projectUVPerTriangle,
  woodMaterial,
} from "../materials";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import { hitMaterial } from "./MeterMaterials";
import { TerminalNut } from "./TerminalNut";

export interface KeyKProps extends PartProps {
  /** Tap the plug to put it in (key closed) or take it out. */
  onToggle?: () => void;
}

/**
 * The plug key K, terminals K1 and K2; open or closed from `state.current.keyClosed`. A mahogany
 * base under two chunky brass blocks, a tapered brass plug with a speckled ebonite knob seated
 * between them, and a small paper tag lettered K, after the golden frame and
 * docs/design/asset-pass/plug-key.webp. Only the plug and a narrow box around it toggle the key;
 * the nuts on the blocks keep their own taps and stand where they always did. Props frozen.
 */

// ---- Sizes, in metres -----------------------------------------------------------------------
// The footprint is 0.092 x 0.05 (LeadParts' BENCH_FOOTPRINTS, 0.024 high at the blocks).
const BASE_W = 0.092;
const BASE_D = 0.05;
const BASE_H = 0.01;
const BLOCK_W = 0.034;
const BLOCK_D = 0.028;
const BLOCK_Z = -0.003; // a little back, which leaves a front strip for the tag
const BLOCK_TOP = KEY_NUTS.K1[1]; // 0.024: the nuts' foot
const BLOCK_H = BLOCK_TOP - BASE_H;
const GAP = 0.012; // the slot between the blocks, which the plug fills
const BLOCK_X = GAP / 2 + BLOCK_W / 2;
const SEAT_Y = BASE_H + 0.001; // the plug's tip, when it is in
// The plug: a tapered brass shank with a collar, then a tall pin-shaped ebonite knob.
const SHANK: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.004, 0],
  [0.0043, 0.0014],
  [0.0056, 0.0245],
  [0.007, 0.025],
  [0.007, 0.0268],
  [0.0054, 0.0278],
  [0, 0.0278],
];
const SHANK_H = 0.0278;
const KNOB: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.005, 0],
  [0.0056, 0.0012],
  [0.0066, 0.006],
  [0.0086, 0.012],
  [0.0101, 0.0166],
  [0.01, 0.0196],
  [0.0086, 0.0226],
  [0.0052, 0.0246],
  [0.0023, 0.0254],
  [0, 0.0256],
];
// Out: the plug lies on the bench in front of the key, its knob resting on the desk.
const OUT_Z = BASE_D / 2 + 0.004;
const OUT_Y = 0.0036;
const OUT_PITCH = 0.2;
// The tap box: the plug's own footprint, long enough in z to cover the plug lying out in front
// (unchanged from the metre bridge's plug key, whose size it was).
const HIT_HALF_X = 0.009;
const HIT_Z0 = -0.012;
const HIT_Z1 = 0.074;
const TAG_W = 0.019;
const TAG_H = 0.0115;

export function KeyK({ state, quality, position, rotationY = 0, onToggle }: KeyKProps) {
  const low = quality === "low";
  const cast = !low;
  const ids = INK_IDS.key;
  const plugRef = useRef<THREE.Group>(null);
  const t = useRef(-1); // 0 = plug out, 1 = plug in; eased toward the state

  const res = useMemo(() => {
    const bs = bevelSegments(quality);
    const seg = low ? 12 : 18;
    const woodTex = benchTexture("mahogany", quality);
    const brassTex = benchTexture("brass", quality);
    const eboniteTex = benchTexture("ebonite", quality);
    const tagTex = benchTag({ text: "K", width: TAG_W, height: TAG_H, seed: 23 }, quality);
    const tagGeo = new THREE.PlaneGeometry(TAG_W, TAG_H);
    tagGeo.rotateX(-Math.PI / 2);
    const hitDepth = HIT_Z1 - HIT_Z0;
    const hitGeo = new THREE.BoxGeometry(HIT_HALF_X * 2, 0.04, hitDepth);
    hitGeo.translate(0, 0.02, HIT_Z0 + hitDepth / 2);
    const baseGeo = bevelBox(BASE_W, BASE_H, BASE_D, 0.003, bs);
    boxProjectUV(baseGeo, [BENCH_TILE_M.mahogany[0], 0.09]);
    offsetUV(baseGeo, 0.31, 0.3);
    // Both brass blocks in one geometry: one draw call.
    const blocksGeo = mergePieces(
      [-1, 1].map((side) =>
        bevelBox(BLOCK_W, BLOCK_H, BLOCK_D, 0.002, Math.min(bs, 2)).translate(
          side * BLOCK_X,
          BASE_H + BLOCK_H / 2,
          BLOCK_Z,
        ),
      ),
    );
    boxProjectUV(blocksGeo, BENCH_TILE_M.brass);
    const knobBase = latheOf(KNOB, seg);
    return {
      woodTex,
      brassTex,
      eboniteTex,
      tagTex,
      woodMat: woodMaterial(21, { map: woodTex }),
      tagMat: paperMaterial(23, { map: tagTex }),
      tagGeo,
      hitGeo,
      brassMat: brassSurface(22, { map: brassTex, metalness: 0.4, roughness: 0.6 }),
      knobMat: paintMaterial("#ffffff", 24, { map: eboniteTex, amount: 0.012 }),
      hitMat: hitMaterial(),
      baseGeo,
      blocksGeo,
      shaftGeo: latheOf(SHANK, seg),
      headGeo: projectUVPerTriangle(knobBase, BENCH_TILE_M.ebonite[0]),
    };
  }, [low, quality]);

  useEffect(() => () => disposeKitBag(res), [res]);

  useFrame((_, dt) => {
    const g = plugRef.current;
    if (!g) return;
    const target = state.current.keyClosed ? 1 : 0;
    if (t.current < 0) t.current = target;
    else t.current += (target - t.current) * Math.min(1, dt * 16);
    const k = t.current;
    // In the slot: upright. Out: lying on the bench in front of the key.
    g.position.y = OUT_Y + (SEAT_Y - OUT_Y) * k;
    g.position.z = BLOCK_Z + (OUT_Z - BLOCK_Z) * (1 - k);
    g.rotation.x = (Math.PI / 2 - OUT_PITCH) * (1 - k);
    g.rotation.z = 0.28 * (1 - k);
  });

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <InkGroup id={ids}>
        <mesh
          geometry={res.baseGeo}
          material={res.woodMat}
          position={[0, BASE_H / 2, 0]}
          castShadow={cast}
          receiveShadow={cast}
        />
      </InkGroup>
      <InkGroup id={ids + 4} thin>
        <mesh
          geometry={res.tagGeo}
          material={res.tagMat}
          position={[0, BASE_H + 0.0004, (BASE_D / 2 + BLOCK_Z + BLOCK_D / 2) / 2]}
        />
      </InkGroup>
      <InkGroup id={ids + 2}>
        <mesh
          geometry={res.blocksGeo}
          material={res.brassMat}
          castShadow={cast}
          receiveShadow={cast}
        />
      </InkGroup>
      <group ref={plugRef} position={[0, SEAT_Y, BLOCK_Z]} onPointerDown={tapOnly(onToggle)}>
        <InkGroup id={ids + 1} thin>
          <mesh geometry={res.shaftGeo} material={res.brassMat} castShadow={cast} />
        </InkGroup>
        <InkGroup id={ids + 3} thin>
          <mesh
            geometry={res.headGeo}
            material={res.knobMat}
            position={[0, SHANK_H, 0]}
            castShadow={cast}
          />
        </InkGroup>
      </group>
      <mesh geometry={res.hitGeo} material={res.hitMat} onPointerDown={tapOnly(onToggle)} />
      <TerminalNut id="K1" part="key" position={KEY_NUTS.K1} state={state} quality={quality} />
      <TerminalNut id="K2" part="key" position={KEY_NUTS.K2} state={state} quality={quality} />
    </group>
  );
}
