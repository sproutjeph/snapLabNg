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
  CELLS_NUTS,
  disposeKitBag,
  kitTexture,
  offsetUV,
  woodMaterial,
} from "../materials";
import { INK_IDS, type PartProps } from "./layout";
import {
  COLOURS,
  canvasTexture,
  jitterColour,
  makeCanvas,
  matte,
  mergeStatic,
  seeded,
} from "./MeterMaterials";
import { TerminalNut } from "./TerminalNut";

/**
 * Two 1.5 V dry cells in series in a holder (E), terminals E+ and E−. A mahogany tray with a pale
 * pine lining, a chunky block at each end carrying a brass terminal, and the two cells lying
 * end to end between brass springs: black bodies with a paper wrapper band, silver ends and a
 * brass cap at the + end of each, after docs/design/asset-pass/cell-holder.webp. It shows how
 * drained the cells are from `state.current.readout.cellDrain01`: the wrapper and the brass dull
 * a little, nothing glows. Props frozen.
 */

// ---- Sizes, in metres -----------------------------------------------------------------------
// The footprint is 0.142 x 0.046 x 0.046 (LeadParts' BENCH_FOOTPRINTS); the tray stays inside it.
const HOLDER_L = 0.142;
const HOLDER_D = 0.046;
const END_T = 0.01; // an end block's thickness, along x
const END_H = CELLS_NUTS["E+"][1]; // 0.046: the terminal nuts' foot
const END_X = HOLDER_L / 2 - END_T / 2;
const INNER_X = HOLDER_L / 2 - END_T; // the end blocks' inner faces
const FLOOR_T = 0.008;
const RAIL_T = 0.006;
// The front rail is low, so the cells' printed faces and the springs show over it; the back one
// is taller, so its pale lining shows behind the cells.
const RAIL_FRONT_H = 0.022;
const RAIL_BACK_H = 0.034;
const RAIL_Z = HOLDER_D / 2 - RAIL_T / 2;
const LINING_T = 0.001;
// Two cells and three springs fill the space between the end blocks. A cell's brass cap is at
// its left end, so the chain runs + ... −, and each cell's zinc end meets the next one's cap.
const CELL_R = 0.015;
const CELL_L = 0.043;
const CELL_Y = FLOOR_T + CELL_R + 0.0004;
const NUB_R = 0.005;
const NUB_L = 0.0012;
const RING_L = 0.0026; // the silver collar at each end of a cell
const RING_PROUD = 0.0008; // it stands proud of the wrapper, so the ink draws a clean line there
const CLIP_T = 0.0016;
const SPRING_R = 0.0072;
const SPRING_WIRE = 0.0014;
const CELL_A = -0.0484; // left end of the left-hand cell's body
const CELL_B = 0.0066; // left end of the right-hand cell's body
const SPRING_SPANS = [
  [-(INNER_X - CLIP_T), CELL_A - NUB_L],
  [CELL_A + CELL_L, CELL_B - NUB_L],
  [CELL_B + CELL_L, INNER_X - CLIP_T],
] as const;
const TAG_W = 0.0115;
const TAG_H = 0.0095;
// A paper label stands this far off the face it is stuck on (about a millimetre), so the ink pass draws a
// steady line at its edge instead of a dotted one.
const LABEL_LIFT = 0.001;

const FRESH = new THREE.Color();
const SPENT = new THREE.Color();
const BRASS_FRESH = new THREE.Color();
const BRASS_SPENT = new THREE.Color("#5e4a28");
const SPENT_TINT = new THREE.Color("#7b7466");

/**
 * The wrapper: a black body with pores and a cream paper band round its middle, lettered 1.5 V
 * in a ruled box. 512 px round the cell, 290 px along it (6 px a millimetre). The text runs
 * along the cell, as printed on a real one lying on its side.
 */
function wrapperTexture(rnd: () => number) {
  const { canvas, ctx } = makeCanvas(512, 290);
  if (ctx) {
    ctx.fillStyle = "#2b2927";
    ctx.fillRect(0, 0, 512, 290);
    for (let i = 0; i < 520; i++) {
      ctx.fillStyle = `rgba(10, 9, 8, ${0.4 + rnd() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(rnd() * 512, rnd() * 290, 0.8 + rnd() * 1.9, 0.7 + rnd() * 1.4, 0, 0, 6.3);
      ctx.fill();
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(120, 114, 106, ${0.2 + rnd() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(rnd() * 512, rnd() * 290, 0.6 + rnd() * 1.2, 0.5 + rnd() * 0.9, 0, 0, 6.3);
      ctx.fill();
    }
    // The paper band, all the way round.
    const top = 62;
    const bottom = 228;
    const paper = ctx.createLinearGradient(0, top, 0, bottom);
    paper.addColorStop(0, "#fbf3dc");
    paper.addColorStop(1, "#f1e6c6");
    ctx.fillStyle = paper;
    ctx.fillRect(0, top, 512, bottom - top);
    ctx.strokeStyle = "rgba(120, 90, 40, 0.07)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 120; i++) {
      const x = rnd() * 512;
      const y = top + rnd() * (bottom - top);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10 + rnd() * 22, y + (rnd() - 0.5) * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#1d2430";
    ctx.fillRect(0, top, 512, 4);
    ctx.fillRect(0, bottom - 4, 512, 4);
    // 1.5 V in a ruled box, on the face that turns toward the student.
    ctx.save();
    ctx.translate(256, (top + bottom) / 2);
    ctx.rotate(Math.PI / 2);
    ctx.strokeStyle = "#1d2430";
    ctx.lineWidth = 3;
    ctx.strokeRect(-62, -23, 124, 46);
    ctx.fillStyle = "#1d2430";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 36px Arial, Helvetica, sans-serif";
    ctx.fillText("1.5 V", 0, 2);
    ctx.restore();
  }
  const tex = canvasTexture(canvas, 8);
  tex.wrapS = THREE.RepeatWrapping;
  tex.offset.x = 0.5; // the printed face sits at the front of the cylinder
  return tex;
}

/** A coil spring along +x from x = 0 to `len`, round the axis. */
function springGeometry(len: number, turns: number, low: boolean) {
  const per = low ? 6 : 12;
  const n = Math.round(turns * per);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(t * len, Math.cos(a) * SPRING_R, Math.sin(a) * SPRING_R));
  }
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts),
    n,
    SPRING_WIRE,
    low ? 4 : 6,
    false,
  );
}

export function CellHolder({ state, quality, position, rotationY = 0 }: PartProps) {
  const low = quality === "low";
  const cast = !low;
  const ids = INK_IDS.cells;
  const wrapperMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const capMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const lastDrain = useRef(-1);

  const res = useMemo(() => {
    const rnd = seeded(7);
    const seg = low ? 14 : 28;
    const bs = bevelSegments(quality);
    const bsSmall = Math.min(bs, 2);
    const tex = wrapperTexture(rnd);
    const woodTex = benchTexture("mahogany", quality);
    const pineTex = kitTexture("pine", quality);
    const brassTex = benchTexture("brass", quality);
    const plusTag = benchTag(
      { text: "+", width: TAG_W, height: TAG_H, seed: 31, glyph: 0.9 },
      quality,
    );
    const minusTag = benchTag(
      { text: "−", width: TAG_W, height: TAG_H, seed: 32, glyph: 0.9 },
      quality,
    );
    const wrapperMat = matte("#ffffff", rnd, { roughness: 0.85, amount: 0.01, map: tex });
    wrapperMat.color.copy(jitterColour("#ffffff", rnd, 0.012));
    const cellAx = CELL_A + CELL_L / 2;
    const cellBx = CELL_B + CELL_L / 2;
    // Each can is a bare cylinder side; the printed face turns toward the front and a little up.
    const can = (cx: number) => {
      const geo = new THREE.CylinderGeometry(CELL_R, CELL_R, CELL_L, seg, 1, true);
      geo.rotateZ(Math.PI / 2); // axis along x
      geo.rotateX(-0.6);
      return { geo, place: (g: THREE.BufferGeometry) => g.translate(cx, CELL_Y, 0) };
    };
    // The silver collars: a short closed cylinder at each end, so each end is a flat silver disc.
    const ring = (x: number) => {
      const geo = new THREE.CylinderGeometry(CELL_R + RING_PROUD, CELL_R + RING_PROUD, RING_L, seg);
      geo.rotateZ(Math.PI / 2);
      return { geo, place: (g: THREE.BufferGeometry) => g.translate(x, CELL_Y, 0) };
    };
    const clip = (side: -1 | 1) => ({
      geo: new THREE.BoxGeometry(CLIP_T, 0.024, 0.022),
      place: (g: THREE.BufferGeometry) =>
        g.translate(side * (INNER_X - CLIP_T / 2), CELL_Y + 0.001, 0),
    });
    const nub = (x: number) => {
      const geo = new THREE.CylinderGeometry(NUB_R, NUB_R, NUB_L, low ? 10 : 16);
      geo.rotateZ(Math.PI / 2);
      return { geo, place: (g: THREE.BufferGeometry) => g.translate(x, CELL_Y, 0) };
    };
    const spring = (from: number, to: number) => ({
      geo: springGeometry(to - from, 3.2, low),
      place: (g: THREE.BufferGeometry) => g.translate(from, CELL_Y, 0),
    });
    // The tray: two end blocks, two rails and a floor, all mahogany.
    const shellGeo = mergeStatic([
      ...[-1, 1].map((side) => ({
        geo: bevelBox(END_T, END_H, HOLDER_D, 0.003, bsSmall),
        place: (g: THREE.BufferGeometry) => g.translate(side * END_X, END_H / 2, 0),
      })),
      ...([-1, 1] as const).map((side) => {
        const railH = side < 0 ? RAIL_BACK_H : RAIL_FRONT_H;
        return {
          geo: bevelBox(HOLDER_L - 2 * END_T + 0.004, railH, RAIL_T, 0.002, 1),
          place: (g: THREE.BufferGeometry) => g.translate(0, railH / 2, side * RAIL_Z),
        };
      }),
      {
        geo: bevelBox(HOLDER_L - 2 * END_T + 0.004, FLOOR_T, HOLDER_D, 0.002, 1),
        place: (g: THREE.BufferGeometry) => g.translate(0, FLOOR_T / 2, 0),
      },
    ]);
    boxProjectUV(shellGeo, [BENCH_TILE_M.mahogany[0], 0.09]);
    offsetUV(shellGeo, 0.12, 0.4);
    // The pale lining the cells lie against: the floor and the back rail's inner face.
    const innerL = 2 * INNER_X;
    const liningGeo = mergeStatic([
      {
        geo: new THREE.BoxGeometry(innerL, LINING_T, HOLDER_D - 2 * RAIL_T),
        place: (g: THREE.BufferGeometry) => g.translate(0, FLOOR_T + LINING_T / 2, 0),
      },
      {
        geo: new THREE.BoxGeometry(innerL, RAIL_BACK_H - FLOOR_T, LINING_T),
        place: (g: THREE.BufferGeometry) =>
          g.translate(
            0,
            FLOOR_T + (RAIL_BACK_H - FLOOR_T) / 2,
            -(HOLDER_D / 2 - RAIL_T) + LINING_T / 2,
          ),
      },
    ]);
    boxProjectUV(liningGeo, [0.55, 0.14]);
    const tagGeo = new THREE.PlaneGeometry(TAG_W, TAG_H);
    return {
      tex,
      wrapperMat,
      steelMat: matte(COLOURS.zinc, rnd, { roughness: 0.6, metalness: 0.4 }),
      brassMat: brassSurface(8, { map: brassTex, metalness: 0.4, roughness: 0.6 }),
      woodTex,
      woodMat: woodMaterial(7, { map: woodTex }),
      pineTex,
      pineMat: woodMaterial(9, { map: pineTex }),
      plusTag,
      minusTag,
      plusMat: matte("#ffffff", rnd, { roughness: 0.92, amount: 0.004, map: plusTag }),
      minusMat: matte("#ffffff", rnd, { roughness: 0.92, amount: 0.004, map: minusTag }),
      brassTex,
      tagGeo,
      // Both cells and all four silver collars: one draw call each.
      cansGeo: mergeStatic([can(cellAx), can(cellBx)]),
      steelGeo: mergeStatic([
        ring(CELL_A + RING_L / 2),
        ring(CELL_A + CELL_L - RING_L / 2),
        ring(CELL_B + RING_L / 2),
        ring(CELL_B + CELL_L - RING_L / 2),
      ]),
      // The brass spring clips at both ends, the caps and the springs.
      brassGeo: mergeStatic([
        clip(-1),
        clip(1),
        nub(CELL_A - NUB_L / 2),
        nub(CELL_B - NUB_L / 2),
        ...SPRING_SPANS.map(([a, b]) => spring(a, b)),
      ]),
      shellGeo,
      liningGeo,
    };
  }, [low, quality]);

  useEffect(() => {
    wrapperMatRef.current = res.wrapperMat;
    capMatRef.current = res.brassMat;
    BRASS_FRESH.copy(res.brassMat.color);
    FRESH.copy(res.wrapperMat.color);
    SPENT.copy(FRESH).lerp(SPENT_TINT, 0.55);
    lastDrain.current = -1;
    return () => disposeKitBag(res);
  }, [res]);

  useFrame(() => {
    const drain = state.current.readout.cellDrain01;
    if (Math.abs(drain - lastDrain.current) < 0.003) return;
    lastDrain.current = drain;
    // The wrapper greys a little and the brass tarnishes; the label stays readable.
    wrapperMatRef.current?.color.copy(FRESH).lerp(SPENT, drain);
    capMatRef.current?.color.copy(BRASS_FRESH).lerp(BRASS_SPENT, drain * 0.7);
  });

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <InkGroup id={ids}>
        <mesh
          geometry={res.shellGeo}
          material={res.woodMat}
          castShadow={cast}
          receiveShadow={cast}
        />
      </InkGroup>
      <InkGroup id={ids + 4}>
        <mesh geometry={res.liningGeo} material={res.pineMat} receiveShadow={cast} />
      </InkGroup>
      <InkGroup id={ids + 1}>
        <mesh
          geometry={res.cansGeo}
          material={res.wrapperMat}
          castShadow={cast}
          receiveShadow={cast}
        />
      </InkGroup>
      <InkGroup id={ids + 2} thin>
        <mesh geometry={res.steelGeo} material={res.steelMat} castShadow={cast} />
      </InkGroup>
      {/* The brass clips at both ends, the caps (+) at the left end of each cell, and the springs. */}
      <InkGroup id={ids + 3} thin>
        <mesh geometry={res.brassGeo} material={res.brassMat} />
      </InkGroup>
      <InkGroup id={ids + 5} thin>
        <mesh
          geometry={res.tagGeo}
          material={res.plusMat}
          position={[-END_X, END_H * 0.62, HOLDER_D / 2 + LABEL_LIFT]}
        />
        <mesh
          geometry={res.tagGeo}
          material={res.minusMat}
          position={[END_X, END_H * 0.62, HOLDER_D / 2 + LABEL_LIFT]}
        />
      </InkGroup>
      <TerminalNut
        id="E+"
        part="cells"
        position={CELLS_NUTS["E+"]}
        state={state}
        quality={quality}
      />
      <TerminalNut
        id="E-"
        part="cells"
        position={CELLS_NUTS["E-"]}
        state={state}
        quality={quality}
      />
    </group>
  );
}
