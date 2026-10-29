import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import {
  bevelBox,
  bevelSegments,
  boxProjectUV,
  brassSurface,
  disposeKitBag,
  kitLabel,
  kitTexture,
  mergePieces,
  paintMaterial,
  paperMaterial,
  woodMaterial,
} from "../materials";
import { PLUG_KEY_DIMS } from "../meter-bridge/dimensions";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import { hitMaterial } from "./MeterMaterials";
import { TerminalNut } from "./TerminalNut";

export interface KeyKProps extends PartProps {
  /** Tap the plug to put it in (key closed) or take it out. */
  onToggle?: () => void;
}

/**
 * The plug key K, terminals K1 and K2; open or closed from `state.current.keyClosed`. Built
 * like the metre bridge's PlugKey (same height, depth and plug) but matte and tagged for the
 * ink pass. Only the plug and a narrow box around it toggle the key; the nuts on the blocks
 * keep their own taps. Props frozen.
 */

const D = PLUG_KEY_DIMS;
const BASE_W = 0.092;
const BLOCK_W = 0.036;
const GAP = 0.0062; // the slot between the blocks, a little wider than the plug at its tip
const SHAFT_H = 0.012;
const SHAFT_R_TOP = 0.0034;
const SHAFT_R_BOT = 0.0026;
const HEAD_R = 0.0075;
const HEAD_H = 0.017;
const BLOCK_X = GAP / 2 + BLOCK_W / 2;
const NUT_X = 0.031;
const BLOCK_TOP = D.height + D.blockHeight;
const SEAT_Y = D.height + 0.001; // plug base, when it sits in the slot
const OUT_Z = D.depth / 2 + 0.016; // where the plug lies when it is out
const OUT_Y = HEAD_R;
// The tap box: the plug's own footprint, long enough in z to cover the plug lying out in front.
const HIT_HALF_X = 0.009;
const HIT_Z0 = -D.blockDepth / 2;
const HIT_Z1 = OUT_Z + SHAFT_H + HEAD_H + 0.004;

export function KeyK({ state, quality, position, rotationY = 0, onToggle }: KeyKProps) {
  const low = quality === "low";
  const cast = !low;
  const ids = INK_IDS.key;
  const plugRef = useRef<THREE.Group>(null);
  const t = useRef(-1); // 0 = plug out, 1 = plug in; eased toward the state

  const res = useMemo(() => {
    const bs = bevelSegments(quality);
    const seg = low ? 10 : 20;
    const woodTex = kitTexture("mahogany", quality);
    const brassTex = kitTexture("brass", quality);
    const tex = kitLabel({ lines: ["K"], width: 0.016, height: 0.01, seed: 23 }, quality);
    const labelGeo = new THREE.PlaneGeometry(0.016, 0.01);
    labelGeo.rotateX(-Math.PI / 2);
    const hitDepth = HIT_Z1 - HIT_Z0;
    const hitGeo = new THREE.BoxGeometry(HIT_HALF_X * 2, 0.04, hitDepth);
    hitGeo.translate(0, 0.02, HIT_Z0 + hitDepth / 2);
    const baseGeo = bevelBox(BASE_W, D.height, D.depth, 0.003, bs);
    boxProjectUV(baseGeo, [0.3, 0.15]);
    // Both brass blocks in one geometry: one draw call.
    const blocksGeo = mergePieces(
      [-1, 1].map((side) =>
        bevelBox(BLOCK_W, D.blockHeight, D.blockDepth, 0.0016, bs).translate(
          side * BLOCK_X,
          D.height + D.blockHeight / 2,
          0,
        ),
      ),
    );
    boxProjectUV(blocksGeo, [0.2, 0.2]);
    // The plug's black knob: a tapered bakelite handle.
    const k = HEAD_H / 0.0165;
    const profile = [
      [0, 0],
      [0.0072, 0],
      [0.0078, 0.002],
      [0.0063, 0.0058],
      [0.0052, 0.0108],
      [0.0066, 0.0142],
      [0.0062, 0.0162],
      [0.0035, 0.0166],
      [0, 0.0166],
    ].map(([r, y]) => new THREE.Vector2((r ?? 0) * (HEAD_R / 0.0075), (y ?? 0) * k));
    return {
      woodTex,
      brassTex,
      tex,
      woodMat: woodMaterial(21, { map: woodTex }),
      labelMat: paperMaterial(23, { map: tex }),
      labelGeo,
      hitGeo,
      brassMat: brassSurface(22, { map: brassTex }),
      headMat: paintMaterial("#151312", 24),
      hitMat: hitMaterial(),
      baseGeo,
      blocksGeo,
      shaftGeo: new THREE.CylinderGeometry(SHAFT_R_TOP, SHAFT_R_BOT, SHAFT_H, seg),
      headGeo: new THREE.LatheGeometry(profile, seg),
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
    g.position.z = OUT_Z * (1 - k);
    g.rotation.x = (Math.PI / 2) * (1 - k);
    g.rotation.z = 0.28 * (1 - k);
  });

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <InkGroup id={ids}>
        <mesh
          geometry={res.baseGeo}
          material={res.woodMat}
          position={[0, D.height / 2, 0]}
          castShadow={cast}
          receiveShadow={cast}
        />
        <mesh
          geometry={res.labelGeo}
          material={res.labelMat}
          position={[0, D.height + 0.0003, 0.0185]}
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
      <InkGroup id={ids + 1} thin>
        <group ref={plugRef} position={[0, SEAT_Y, 0]} onPointerDown={tapOnly(onToggle)}>
          <mesh
            geometry={res.shaftGeo}
            material={res.brassMat}
            position={[0, SHAFT_H / 2, 0]}
            castShadow={cast}
          />
          <mesh
            geometry={res.headGeo}
            material={res.headMat}
            position={[0, SHAFT_H, 0]}
            castShadow={cast}
          />
        </group>
      </InkGroup>
      <mesh geometry={res.hitGeo} material={res.hitMat} onPointerDown={tapOnly(onToggle)} />
      <TerminalNut
        id="K1"
        part="key"
        position={[NUT_X, BLOCK_TOP, 0]}
        state={state}
        quality={quality}
      />
      <TerminalNut
        id="K2"
        part="key"
        position={[-NUT_X, BLOCK_TOP, 0]}
        state={state}
        quality={quality}
      />
    </group>
  );
}
