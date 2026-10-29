import { type ThreeEvent, useFrame } from "@react-three/fiber";
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
import { PLUG_BOX_DIMS, plugPositions } from "../meter-bridge/dimensions";
import { INK_IDS, type PartProps, tapOnly } from "./layout";
import { canvasTexture, hitMaterial, makeCanvas } from "./MeterMaterials";
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

function topTexture(coils: readonly number[], xs: readonly number[], w: number) {
  const h = Math.round((w * D.depth) / WIDTH);
  const { canvas, ctx } = makeCanvas(w, h);
  if (ctx) {
    ctx.clearRect(0, 0, w, h);
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
    const bs = bevelSegments(quality);
    const seg = low ? 10 : 20;
    const coils = coilsKey ? coilsKey.split(",").map(Number) : [];
    const woodTex = kitTexture("mahogany", quality);
    const brassTex = kitTexture("brass", quality);
    const topTex = topTexture(coils, xs, low ? 512 : 1024);
    // The strip of paper on the front, with the coil values as the maker printed them.
    const frontTex = kitLabel(
      {
        lines: ["RESISTANCE BOX", `${coils.join("   ")}   \u03a9`],
        width: 0.19,
        height: 0.034,
        seed: 57,
      },
      quality,
    );
    // The engraving is a plate lying on the ebonite top, drawn on a transparent ground.
    const labelMat = new THREE.MeshStandardMaterial({
      map: topTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.9,
    });
    const labelGeo = new THREE.PlaneGeometry(WIDTH - 0.004, D.depth - 0.004);
    labelGeo.rotateX(-Math.PI / 2);
    const frontGeo = new THREE.PlaneGeometry(0.19, 0.034);
    // Blocks run between slots; the first and last carry the terminals.
    const halfW = WIDTH / 2 - 0.008;
    const blocks: Array<{ x: number; w: number }> = [];
    for (let i = 0; i <= xs.length; i++) {
      const left = i === 0 ? -halfW : (xs[i - 1] ?? 0) + GAP / 2;
      const right = i === xs.length ? halfW : (xs[i] ?? 0) - GAP / 2;
      blocks.push({ x: (left + right) / 2, w: Math.max(0.006, right - left) });
    }
    const blocksGeo = mergePieces(
      blocks.map((b) =>
        bevelBox(b.w, D.blockHeight, D.blockDepth, 0.0015, bs).translate(
          b.x,
          TOP_Y + D.blockHeight / 2,
          BLOCK_Z,
        ),
      ),
    );
    boxProjectUV(blocksGeo, [0.2, 0.2]);
    const bodyGeo = bevelBox(WIDTH - 0.004, BODY_H, D.depth - 0.004, 0.004, bs);
    boxProjectUV(bodyGeo, [0.3, 0.15]);
    const topGeo = bevelBox(WIDTH, D.topThickness, D.depth, 0.0016, bs);
    boxProjectUV(topGeo, [0.12, 0.12]);
    // Plugs are drawn as two instanced meshes (brass shafts, black bakelite knobs), one matrix each.
    const shaftGeo = new THREE.CylinderGeometry(SHAFT_R_TOP, SHAFT_R_BOT, SHAFT_H, seg);
    shaftGeo.translate(0, SHAFT_H / 2, 0);
    const k = HEAD_H / 0.0165;
    const knob = [
      [0, 0],
      [0.0072, 0],
      [0.0076, 0.0018],
      [0.0062, 0.0055],
      [0.0051, 0.0105],
      [0.0063, 0.0138],
      [0.006, 0.0161],
      [0.0035, 0.0165],
      [0, 0.0165],
    ].map(([r, y]) => new THREE.Vector2((r ?? 0) * (HEAD_R / 0.007), (y ?? 0) * k));
    const headGeo = new THREE.LatheGeometry(knob, seg);
    headGeo.translate(0, SHAFT_H, 0);
    const hitGeo = new THREE.SphereGeometry(0.0125, 8, 6);
    return {
      woodTex,
      brassTex,
      topTex,
      frontTex,
      woodMat: woodMaterial(53, { map: woodTex }),
      eboniteMat: paintMaterial("#1c1a19", 56, { amount: 0.02 }),
      labelMat,
      labelGeo,
      frontGeo,
      frontMat: paperMaterial(57, { map: frontTex }),
      brassMat: brassSurface(58, { map: brassTex }),
      headMat: paintMaterial("#151312", 59),
      hitMat: hitMaterial(),
      bodyGeo,
      topGeo,
      blocksGeo,
      shaftGeo,
      headGeo,
      hitGeo,
      dummy: new THREE.Object3D(),
      // Plug positions, 0 = out, 1 = in, eased; -1 until the first frame sets it.
      ease: new Float32Array(n).fill(-1),
    };
  }, [low, quality, xs, coilsKey, n]);

  useEffect(() => () => disposeKitBag({ ...res, dummy: null, ease: null }), [res]);

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
        <mesh
          geometry={res.labelGeo}
          material={res.labelMat}
          position={[0, TOP_Y + 0.0003, 0]}
          renderOrder={2}
        />
      </InkGroup>
      <InkGroup id={ids + 4} thin>
        <mesh
          geometry={res.frontGeo}
          material={res.frontMat}
          position={[0, BODY_H * 0.5, (D.depth - 0.004) / 2 + 0.0003]}
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
