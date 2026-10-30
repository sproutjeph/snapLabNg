import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import {
  BENCH_TILE_M,
  BOX_NUTS,
  benchTexture,
  bevelBox,
  bevelSegments,
  boxCoilLabels,
  boxProjectUV,
  boxStripPlaces,
  brassSurface,
  disposeKitBag,
  latheOf,
  mergePieces,
  OHM,
  paintMaterial,
  paperMaterial,
  projectUVPerTriangle,
  seededRandom,
  withRelief,
  woodMaterial,
} from "../materials";
import { plugPositions } from "../meter-bridge/dimensions";
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
 * A mahogany box under a brushed-brass plate, a row of chunky brass blocks with a slot between
 * each pair, and a tapered brass plug with a speckled ebonite knob in every slot, drawn after
 * the golden frame and docs/design/asset-pass/resistance-box.webp. The coil values are printed
 * as the maker printed them: on the plate by each slot and on the paper strip on the front,
 * never a total. Taps, slot targets and the two terminals stand where they always did. Props
 * frozen.
 */

// ---- Sizes, in metres -----------------------------------------------------------------------
// The footprint is 0.30 x 0.10 x 0.06 (LeadParts' BENCH_FOOTPRINTS); the plate and the blocks
// stay inside it, the plugs and the nuts rise above, and the block tops stand at the nuts' foot.
const WIDTH = 0.3; // the slots are spaced across this (plugPositions), as always
const PLUG_MARGIN = 0.056; // the end slots sit well clear of the terminal nuts
const BODY_W = 0.296;
const BODY_D = 0.096;
const BODY_H = 0.046;
const PLATE_W = 0.286;
const PLATE_D = 0.086;
const PLATE_T = 0.004;
const PLATE_TOP = BODY_H + PLATE_T;
const BLOCK_H = 0.016; // block tops stand at 0.066, the nuts' foot
const BLOCK_D = 0.03;
const BLOCK_Z = BOX_NUTS.R1[2];
const END_X = 0.1415; // the end blocks reach as far as the terminal nuts' washers
const GAP = 0.009; // the slot between two blocks, which a plug fills
const SEAT_Y = PLATE_TOP + 0.001; // a plug's tip, when it is in
// A plug: tapered brass shank (a collar at its top), then a squat speckled knob.
const SHANK: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.0031, 0],
  [0.0033, 0.0014],
  [0.0047, 0.0225],
  [0.0063, 0.023],
  [0.0063, 0.0246],
  [0.0051, 0.0255],
  [0, 0.0256],
];
const SHANK_H = 0.0256;
const KNOB: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.0052, 0],
  [0.006, 0.0014],
  [0.009, 0.005],
  [0.0106, 0.0085],
  [0.0107, 0.011],
  [0.0096, 0.0138],
  [0.0066, 0.0158],
  [0.003, 0.0168],
  [0, 0.0172],
];
// Out: the plug lies on the bench in front of the box, its knob resting on the desk.
const OUT_Z = BODY_D / 2 + 0.014;
const OUT_Y = 0.0036;
const OUT_PITCH = 0.22; // the knob end is higher than the tip, as a plug lies on its belly
const SLOT_HIT_Y = 0.06 + 0.008; // the tap target over each slot (unchanged)

const STRIP_W = 0.22;
const STRIP_H = 0.025;
const STRIP_PITCH = 0.0225;
const STRIP_LIFT = 0.0005; // the strip lies this far off the front face
const INK = "rgba(34, 20, 8, 0.92)";
const FONT = "Arial, Helvetica, sans-serif";

/** The engraving on the plate: each slot's value in front of it, and the maker's name behind. */
function engravingTexture(coils: readonly number[], xs: readonly number[], w: number) {
  const h = Math.round((w * PLATE_D) / PLATE_W);
  const { canvas, ctx } = makeCanvas(w, h);
  if (ctx) {
    ctx.clearRect(0, 0, w, h);
    const sx = w / PLATE_W;
    const sz = h / PLATE_D;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    // Canvas top is the back of the plate, the bottom its front edge.
    ctx.font = `bold ${Math.round(0.0062 * sz)}px ${FONT}`;
    ctx.fillText("RESISTANCE BOX", w / 2, (PLATE_D / 2 - 0.0315) * sz);
    ctx.font = `bold ${Math.round(0.0112 * sz)}px ${FONT}`;
    const labels = boxCoilLabels(coils);
    labels.forEach((label, i) => {
      const x = ((xs[i] ?? 0) + PLATE_W / 2) * sx;
      ctx.fillText(`${label}${OHM}`, x, (PLATE_D / 2 + 0.0265) * sz);
    });
  }
  return canvasTexture(canvas, 8);
}

/** The paper strip on the front: the coil values in plug order, then the ohm sign. */
function stripTexture(coils: readonly number[], w: number) {
  const h = Math.round((w * STRIP_H) / STRIP_W);
  const { canvas, ctx } = makeCanvas(w, h);
  if (ctx) {
    const paper = ctx.createLinearGradient(0, 0, 0, h);
    paper.addColorStop(0, "#fdf6e3");
    paper.addColorStop(1, "#f6ecd0");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);
    // Fibre, as on the kit's labels.
    const px = w / STRIP_W;
    ctx.strokeStyle = "rgba(120, 90, 40, 0.07)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const y = ((i * 37) % 100) * 0.01 * h;
      const x = (((i * 61) % 100) * 0.01 * w) | 0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18 + (i % 7) * 6, y + ((i % 3) - 1) * 0.8);
      ctx.stroke();
    }
    // The printed border, 0.7 mm thick: thick enough to stay steady when the strip is seen slanted.
    const rule = Math.max(2.5, 0.0007 * px);
    ctx.strokeStyle = INK;
    ctx.lineWidth = rule;
    ctx.strokeRect(rule * 1.5, rule * 1.5, w - rule * 3, h - rule * 3);
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(0.0148 * px)}px ${FONT}`;
    const labels = [...boxCoilLabels(coils), OHM];
    boxStripPlaces(coils.length, STRIP_PITCH).forEach((x, i) => {
      ctx.fillText(labels[i] ?? "", w / 2 + x * px, h * 0.54);
    });
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
    const seg = low ? 8 : quality === "mid" ? 32 : 48;
    const coils = coilsKey ? coilsKey.split(",").map(Number) : [];
    const woodTex = benchTexture("mahogany", quality);
    const brassTex = benchTexture("brass", quality);
    const eboniteTex = benchTexture("ebonite", quality);
    const engraving = engravingTexture(coils, xs, low ? 512 : 1024);
    const strip = stripTexture(coils, low ? 512 : 1024);
    // The engraving is a transparent sheet lying on the brass.
    const engravingMat = new THREE.MeshStandardMaterial({
      map: engraving,
      transparent: true,
      depthWrite: false,
      roughness: 0.9,
    });
    const engravingGeo = new THREE.PlaneGeometry(PLATE_W, PLATE_D);
    engravingGeo.rotateX(-Math.PI / 2);
    const stripGeo = new THREE.PlaneGeometry(STRIP_W, STRIP_H);
    // The box: mahogany, rounded all round; the brass plate sits on it with a margin of wood.
    const bodyGeo = bevelBox(BODY_W, BODY_H, BODY_D, 0.009, bs);
    boxProjectUV(bodyGeo, [BENCH_TILE_M.mahogany[0], 0.09]);
    const plateGeo = bevelBox(PLATE_W, PLATE_T, PLATE_D, 0.0015, Math.min(bs, 2));
    boxProjectUV(plateGeo, BENCH_TILE_M.brass);
    // Blocks run between the slots; the first and last carry the terminals.
    const blocks: Array<{ x: number; w: number }> = [];
    for (let i = 0; i <= xs.length; i++) {
      const left = i === 0 ? -END_X : (xs[i - 1] ?? 0) + GAP / 2;
      const right = i === xs.length ? END_X : (xs[i] ?? 0) - GAP / 2;
      blocks.push({ x: (left + right) / 2, w: Math.max(0.006, right - left) });
    }
    const blocksGeo = mergePieces(
      blocks.map((b) =>
        bevelBox(b.w, BLOCK_H, BLOCK_D, 0.0035, Math.min(bs, 2)).translate(
          b.x,
          PLATE_TOP + BLOCK_H / 2,
          BLOCK_Z,
        ),
      ),
    );
    boxProjectUV(blocksGeo, BENCH_TILE_M.brass);
    // The ebonite showing at the bottom of each slot.
    const slotsGeo = mergePieces(
      xs.map((x) =>
        new THREE.BoxGeometry(GAP + 0.002, 0.0006, BLOCK_D + 0.004).translate(
          x,
          PLATE_TOP + 0.0003,
          BLOCK_Z,
        ),
      ),
    );
    // Plugs are two instanced meshes (brass shanks, speckled knobs), one matrix each.
    const shaftGeo = latheOf(SHANK, seg);
    const headBase = latheOf(KNOB, seg);
    headBase.translate(0, SHANK_H, 0);
    const headGeo = projectUVPerTriangle(headBase, BENCH_TILE_M.ebonite[0]);
    const hitGeo = new THREE.SphereGeometry(0.0125, 8, 6);
    const rnd = seededRandom(61);
    const dummy = new THREE.Object3D();
    dummy.rotation.order = "YXZ";
    const brass = { metalness: 0.4, roughness: 0.6 };
    return {
      woodTex,
      brassTex,
      eboniteTex,
      engraving,
      strip,
      woodMat: withRelief(woodMaterial(53, { map: woodTex }), "wood", quality),
      brassMat: withRelief(brassSurface(58, { map: brassTex, ...brass }), "brass", quality),
      slotMat: paintMaterial("#17130f", 56, { amount: 0.02 }),
      engravingMat,
      stripMat: paperMaterial(57, { map: strip }),
      knobMat: withRelief(
        paintMaterial("#ffffff", 59, { map: eboniteTex, amount: 0.012 }),
        "ebonite",
        quality,
      ),
      hitMat: hitMaterial(),
      engravingGeo,
      stripGeo,
      bodyGeo,
      plateGeo,
      blocksGeo,
      slotsGeo,
      shaftGeo,
      headGeo,
      hitGeo,
      dummy,
      // Each plug's own turn about its axis, so the eight knobs do not show one speckle.
      spin: Float32Array.from({ length: n }, () => rnd() * Math.PI * 2),
      // Plug positions, 0 = out, 1 = in, eased; -1 until the first frame sets it.
      ease: new Float32Array(n).fill(-1),
    };
  }, [low, quality, xs, coilsKey, n]);

  useEffect(() => () => disposeKitBag({ ...res, dummy: null, ease: null, spin: null }), [res]);

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
        OUT_Y + (SEAT_Y - OUT_Y) * v,
        BLOCK_Z + (OUT_Z - BLOCK_Z) * (1 - v),
      );
      dummy.rotation.set(
        (Math.PI / 2 - OUT_PITCH) * (1 - v),
        (res.spin[i] ?? 0) * v,
        0.2 * (1 - v),
      );
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
        {/* The paper strip is a decal on the front face, so it shares the body's ink id: the ink pass
            draws no line along a one-millimetre step on a slanted face, only its printed border. */}
        <mesh
          geometry={res.stripGeo}
          material={res.stripMat}
          position={[0, BODY_H * 0.5, BODY_D / 2 + STRIP_LIFT]}
        />
      </InkGroup>
      <InkGroup id={ids + 1}>
        <mesh
          geometry={res.plateGeo}
          material={res.brassMat}
          position={[0, BODY_H + PLATE_T / 2, 0]}
          castShadow={cast}
          receiveShadow={cast}
        />
        <mesh
          geometry={res.slotsGeo}
          material={res.slotMat}
          castShadow={false}
          receiveShadow={cast}
        />
        <mesh
          geometry={res.engravingGeo}
          material={res.engravingMat}
          position={[0, PLATE_TOP + 0.0009, 0]}
          renderOrder={2}
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
      </InkGroup>
      <InkGroup id={ids + 5} thin>
        <instancedMesh
          ref={headsRef}
          args={[res.headGeo, res.knobMat, n]}
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
          position={[x, SLOT_HIT_Y, BLOCK_Z]}
          onPointerDown={tapOnly(() => onPlugToggle?.(i))}
        />
      ))}
      <TerminalNut id="R1" part="box" position={BOX_NUTS.R1} state={state} quality={quality} />
      <TerminalNut id="R2" part="box" position={BOX_NUTS.R2} state={state} quality={quality} />
    </group>
  );
}
