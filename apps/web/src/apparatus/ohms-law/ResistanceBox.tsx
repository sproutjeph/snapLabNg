import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import { PLUG_BOX_DIMS, plugPositions } from "../meter-bridge/dimensions";
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

export interface ResistanceBoxProps extends PartProps {
  /** Coils in plug order, from the engine's params; painted on the box. */
  coilsOhm: readonly number[];
  /** Tap a plug to pull it out (adds that coil) or push it in. */
  onPlugToggle?: (index: number) => void;
}

/**
 * The plug-type resistance box R, terminals R1 and R2; plugs from `state.current.plugsIn`.
 * Laid out like the metre bridge's PlugBox (same dimensions and plug spacing, widened for the
 * 8 coils) but matte and tagged for the ink pass, with the terminals on the end blocks. It
 * shows which plugs are out and the printed coil values, never a total resistance.
 * Props frozen.
 */

const D = PLUG_BOX_DIMS;
const WIDTH = 0.3;
const PLUG_MARGIN = 0.056; // end slots sit well clear of the terminal nuts, so their taps never overlap
const TOP_Y = D.height; // top of the ebonite plate
const BODY_H = D.height - D.topThickness;
const GAP = 0.006; // the slot between two brass blocks, which the plug closes
const BLOCK_Z = -0.006;
const SHAFT_H = 0.012;
const SHAFT_R_TOP = 0.0034;
const SHAFT_R_BOT = 0.0026;
const HEAD_R = D.plugHeadRadius;
const HEAD_H = D.plugHeadHeight;
const SEAT_Y = TOP_Y + 0.001;
const OUT_Z = D.depth / 2 + 0.012;
const NUT_X = WIDTH / 2 - 0.02; // on the end blocks; 0.036 m from the nearest slot

function woodTexture(rnd: () => number, w: number, h: number) {
  const { canvas, ctx } = makeCanvas(w, h);
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const lines = Math.round(h * 0.7);
    for (let i = 0; i < lines; i++) {
      const y0 = rnd() * h;
      const dark = rnd() < 0.65;
      ctx.strokeStyle = dark
        ? `rgba(60,30,12,${0.05 + rnd() * 0.16})`
        : `rgba(255,235,210,${0.04 + rnd() * 0.1})`;
      ctx.lineWidth = 0.6 + rnd() * 2.4;
      const amp = 1 + rnd() * 5;
      const freq = 0.004 + rnd() * 0.01;
      const phase = rnd() * 6.28;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = y0 + Math.sin(x * freq + phase) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  return canvasTexture(canvas, 4);
}

function topTexture(coils: readonly number[], xs: readonly number[], w: number, bg: string) {
  const h = Math.round((w * D.depth) / WIDTH);
  const { canvas, ctx } = makeCanvas(w, h);
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const sx = w / WIDTH;
    const sz = h / D.depth;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e9dfc6";
    // Canvas top is the back of the plate, the bottom its front edge.
    ctx.font = `bold ${Math.round(0.0048 * sz)}px Georgia, serif`;
    ctx.fillText("RESISTANCE BOX", w / 2, (0.043 + D.depth / 2) * sz);
    ctx.font = `bold ${Math.round(0.0075 * sz)}px Georgia, serif`;
    coils.forEach((ohm, i) => {
      const x = ((xs[i] ?? 0) + WIDTH / 2) * sx;
      ctx.fillText(`${ohm} Ω`, x, (0.03 + D.depth / 2) * sz);
    });
    // A thin ring engraved round each slot.
    ctx.strokeStyle = "#e9dfc6";
    ctx.lineWidth = Math.max(1, 0.0003 * sz);
    for (const x of xs) {
      ctx.beginPath();
      ctx.ellipse(
        (x + WIDTH / 2) * sx,
        (BLOCK_Z + D.depth / 2) * sz,
        0.0105 * sx,
        0.0105 * sz,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  }
  return canvasTexture(canvas, 8);
}

export function ResistanceBox({
  coilsOhm,
  state,
  quality,
  position,
  rotationY = 0,
  onPlugToggle,
}: ResistanceBoxProps) {
  const low = quality === "low";
  const cast = !low;
  const ids = INK_IDS.box;
  const shaftsRef = useRef<THREE.InstancedMesh>(null);
  const headsRef = useRef<THREE.InstancedMesh>(null);
  const n = coilsOhm.length;
  const xs = useMemo(() => plugPositions(n, WIDTH, PLUG_MARGIN), [n]);
  const coilsKey = coilsOhm.join(",");

  const res = useMemo(() => {
    const rnd = seeded(53);
    const seg = low ? 10 : 20;
    const woodTex = woodTexture(rnd, low ? 256 : 512, low ? 128 : 256);
    const ebonite = jitterColour(COLOURS.ebonite, rnd);
    const topTex = topTexture(
      coilsKey ? coilsKey.split(",").map(Number) : [],
      xs,
      low ? 512 : 1024,
      `#${ebonite.getHexString()}`,
    );
    const eboniteMat = matte(COLOURS.ebonite, rnd, { roughness: 0.7 });
    eboniteMat.color.copy(ebonite);
    // The engraving is a plate lying on the ebonite top, painted the same dark colour.
    const labelMat = matte("#ffffff", rnd, { roughness: 0.7, map: topTex, amount: 0.002 });
    const labelGeo = new THREE.PlaneGeometry(WIDTH - 0.004, D.depth - 0.004);
    labelGeo.rotateX(-Math.PI / 2);
    // Blocks run between slots; the first and last carry the terminals.
    const halfW = WIDTH / 2 - 0.008;
    const blocks: Array<{ x: number; w: number }> = [];
    for (let i = 0; i <= xs.length; i++) {
      const left = i === 0 ? -halfW : (xs[i - 1] ?? 0) + GAP / 2;
      const right = i === xs.length ? halfW : (xs[i] ?? 0) - GAP / 2;
      blocks.push({ x: (left + right) / 2, w: Math.max(0.006, right - left) });
    }
    // Plugs are drawn as two instanced meshes (brass shafts, ebonite heads), one matrix each.
    const shaftGeo = new THREE.CylinderGeometry(SHAFT_R_TOP, SHAFT_R_BOT, SHAFT_H, seg);
    shaftGeo.translate(0, SHAFT_H / 2, 0);
    const headGeo = new THREE.CylinderGeometry(HEAD_R, HEAD_R * 0.9, HEAD_H, seg);
    headGeo.translate(0, SHAFT_H + HEAD_H / 2, 0);
    const hitGeo = new THREE.SphereGeometry(0.0125, 8, 6);
    return {
      woodTex,
      topTex,
      woodMat: matte("#7a4326", rnd, { roughness: 0.7, map: woodTex, amount: 0.04 }),
      eboniteMat,
      labelMat,
      labelGeo,
      brassMat: brassMaterial(rnd),
      headMat: matte("#111111", rnd, { roughness: 0.7 }),
      hitMat: hitMaterial(),
      bodyGeo: new THREE.BoxGeometry(WIDTH - 0.004, BODY_H, D.depth - 0.004),
      topGeo: new THREE.BoxGeometry(WIDTH, D.topThickness, D.depth),
      blocksGeo: mergeStatic(
        blocks.map((b) => ({
          geo: new THREE.BoxGeometry(b.w, D.blockHeight, D.blockDepth),
          place: (g: THREE.BufferGeometry) => g.translate(b.x, TOP_Y + D.blockHeight / 2, BLOCK_Z),
        })),
      ),
      shaftGeo,
      headGeo,
      hitGeo,
      dummy: new THREE.Object3D(),
      // Plug positions, 0 = out, 1 = in, eased; -1 until the first frame sets it.
      ease: new Float32Array(n).fill(-1),
    };
  }, [low, xs, coilsKey, n]);

  useEffect(() => () => disposeAll({ ...res, dummy: null, ease: null }), [res]);

  useFrame((_, dt) => {
    const shafts = shaftsRef.current;
    const heads = headsRef.current;
    if (!shafts || !heads) return;
    const plugsIn = state.current.plugsIn;
    const k = Math.min(1, dt * 16);
    const dummy = res.dummy;
    let changed = false;
    for (let i = 0; i < xs.length; i++) {
      const target = plugsIn[i] === false ? 0 : 1;
      const cur = res.ease[i] ?? -1;
      let v = target;
      if (cur >= 0) {
        if (cur === target) continue;
        v = Math.abs(target - cur) < 0.001 ? target : cur + (target - cur) * k;
      }
      res.ease[i] = v;
      // In the slot: upright. Out: lying on the bench in front of the box.
      dummy.position.set(
        xs[i] ?? 0,
        HEAD_R + (SEAT_Y - HEAD_R) * v,
        BLOCK_Z + (OUT_Z - BLOCK_Z) * (1 - v),
      );
      dummy.rotation.set((Math.PI / 2) * (1 - v), 0, 0.2 * (1 - v));
      dummy.updateMatrix();
      shafts.setMatrixAt(i, dummy.matrix);
      heads.setMatrixAt(i, dummy.matrix);
      changed = true;
    }
    if (changed) {
      shafts.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      // Taps use the bounding sphere, so keep it on the plugs where they are now.
      shafts.computeBoundingSphere();
      heads.computeBoundingSphere();
    }
  });

  const tapPlug = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) onPlugToggle?.(e.instanceId);
  };

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <InkGroup id={ids}>
        <mesh
          geometry={res.bodyGeo}
          material={res.woodMat}
          position={[0, BODY_H / 2, 0]}
          castShadow={cast}
          receiveShadow={cast}
        />
      </InkGroup>
      <InkGroup id={ids + 1}>
        <mesh
          geometry={res.topGeo}
          material={res.eboniteMat}
          position={[0, BODY_H + D.topThickness / 2, 0]}
          castShadow={cast}
          receiveShadow={cast}
        />
        <mesh geometry={res.labelGeo} material={res.labelMat} position={[0, TOP_Y + 0.0003, 0]} />
      </InkGroup>
      <InkGroup id={ids + 2}>
        <mesh
          geometry={res.blocksGeo}
          material={res.brassMat}
          castShadow={cast}
          receiveShadow={cast}
        />
      </InkGroup>
      <InkGroup id={ids + 3} thin>
        <instancedMesh
          ref={shaftsRef}
          args={[res.shaftGeo, res.brassMat, n]}
          castShadow={cast}
          frustumCulled={false}
          onPointerDown={tapPlug}
        />
        <instancedMesh
          ref={headsRef}
          args={[res.headGeo, res.headMat, n]}
          castShadow={cast}
          frustumCulled={false}
          onPointerDown={tapPlug}
        />
      </InkGroup>
      {/* The empty slot is a tap target too, so a plug can be pushed back in. */}
      {xs.map((x, i) => (
        <mesh
          key={x}
          geometry={res.hitGeo}
          material={res.hitMat}
          position={[x, TOP_Y + 0.008, BLOCK_Z]}
          onPointerDown={tapOnly(() => onPlugToggle?.(i))}
        />
      ))}
      <TerminalNut
        id="R1"
        part="box"
        position={[NUT_X, TOP_Y + D.blockHeight, BLOCK_Z]}
        state={state}
        quality={quality}
      />
      <TerminalNut
        id="R2"
        part="box"
        position={[-NUT_X, TOP_Y + D.blockHeight, BLOCK_Z]}
        state={state}
        quality={quality}
      />
    </group>
  );
}
