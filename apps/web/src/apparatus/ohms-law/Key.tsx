import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import { PLUG_KEY_DIMS } from "../meter-bridge/dimensions";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import {
  brassMaterial,
  COLOURS,
  canvasTexture,
  disposeAll,
  hitMaterial,
  jitterColour,
  makeCanvas,
  matte,
  mergeStatic,
  seeded,
} from "./MeterMaterials";
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

function labelTexture(bg: string) {
  const { canvas, ctx } = makeCanvas(128, 64);
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = "#e9dfc6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 52px Georgia, serif";
    ctx.fillText("K", 64, 34);
  }
  return canvasTexture(canvas, 2);
}

export function KeyK({ state, quality, position, rotationY = 0, onToggle }: KeyKProps) {
  const low = quality === "low";
  const cast = !low;
  const ids = INK_IDS.key;
  const plugRef = useRef<THREE.Group>(null);
  const t = useRef(-1); // 0 = plug out, 1 = plug in; eased toward the state

  const res = useMemo(() => {
    const rnd = seeded(21);
    const seg = low ? 10 : 20;
    const ebonite = jitterColour(COLOURS.ebonite, rnd);
    const tex = labelTexture(`#${ebonite.getHexString()}`);
    const eboniteMat = matte(COLOURS.ebonite, rnd, { roughness: 0.7 });
    eboniteMat.color.copy(ebonite);
    // The "K" is a small plate lying on the base, painted the same ebonite colour.
    const labelMat = matte("#ffffff", rnd, { roughness: 0.7, map: tex, amount: 0.002 });
    const labelGeo = new THREE.PlaneGeometry(0.016, 0.008);
    labelGeo.rotateX(-Math.PI / 2);
    const hitDepth = HIT_Z1 - HIT_Z0;
    const hitGeo = new THREE.BoxGeometry(HIT_HALF_X * 2, 0.04, hitDepth);
    hitGeo.translate(0, 0.02, HIT_Z0 + hitDepth / 2);
    return {
      tex,
      eboniteMat,
      labelMat,
      labelGeo,
      hitGeo,
      brassMat: brassMaterial(rnd),
      headMat: matte("#111111", rnd, { roughness: 0.7 }),
      hitMat: hitMaterial(),
      baseGeo: new THREE.BoxGeometry(BASE_W, D.height, D.depth),
      // Both brass blocks in one geometry: one draw call.
      blocksGeo: mergeStatic(
        [-1, 1].map((side) => ({
          geo: new THREE.BoxGeometry(BLOCK_W, D.blockHeight, D.blockDepth),
          place: (g: THREE.BufferGeometry) =>
            g.translate(side * BLOCK_X, D.height + D.blockHeight / 2, 0),
        })),
      ),
      shaftGeo: new THREE.CylinderGeometry(SHAFT_R_TOP, SHAFT_R_BOT, SHAFT_H, seg),
      headGeo: new THREE.CylinderGeometry(HEAD_R, HEAD_R * 0.92, HEAD_H, seg),
    };
  }, [low]);

  useEffect(() => () => disposeAll(res), [res]);

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
          material={res.eboniteMat}
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
            position={[0, SHAFT_H + HEAD_H / 2, 0]}
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
