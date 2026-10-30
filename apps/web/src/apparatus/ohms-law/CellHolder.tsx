import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import {
  BENCH_TILE_M,
  benchCellSteel,
  benchCellWrapper,
  benchTag,
  benchTexture,
  bevelBox,
  bevelSegments,
  boxProjectUV,
  brassSurface,
  CELL_SPRING,
  CELLS_NUTS,
  disposeKitBag,
  helixTube,
  offsetUV,
  scaleUV,
  woodMaterial,
} from "../materials";
import { INK_IDS, type PartProps } from "./layout";
import { jitterColour, matte, mergeStatic, seeded } from "./MeterMaterials";
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
// is tall (a little under the end blocks), so a good width of its pale lining shows over the cells.
const RAIL_FRONT_H = 0.022;
const RAIL_BACK_H = 0.042;
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
// The springs' wire is 8-sided on every tier (round under the ink pass); the lower tiers take fewer
// steps round the coil, and the lowest one a turn less, to stay within the triangle budget
// (CELL_SPRING in materials/benchSpec.ts).
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
    const tex = benchCellWrapper(quality);
    tex.offset.x = 0.5; // the printed face sits at the front of the cylinder
    const steelTex = benchCellSteel(quality);
    const woodTex = benchTexture("mahogany", quality);
    const pineTex = benchTexture("pine", quality);
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
    // The silver collars: a short open cylinder at each end of a can, and the flat silver disc on
    // its outer face (the face inside the can is never seen, so it is not built).
    const ring = (from: number, outward: 1 | -1) => {
      const r = CELL_R + RING_PROUD;
      const side = new THREE.CylinderGeometry(r, r, RING_L, seg, 1, true);
      side.rotateZ(Math.PI / 2);
      const disc = new THREE.CircleGeometry(r, seg);
      disc.rotateY((outward * Math.PI) / 2);
      // The steel texture is two squares: the flat end on its left half, the collar's rim on its right.
      scaleUV(disc, 0.5, 1);
      scaleUV(side, 0.5, 1);
      offsetUV(side, 0.5, 0);
      const discX = outward < 0 ? from : from + RING_L;
      return [
        {
          geo: side,
          place: (g: THREE.BufferGeometry) => g.translate(from + RING_L / 2, CELL_Y, 0),
        },
        { geo: disc, place: (g: THREE.BufferGeometry) => g.translate(discX, CELL_Y, 0) },
      ];
    };
    const clip = (side: -1 | 1) => ({
      geo: new THREE.BoxGeometry(CLIP_T, 0.024, 0.022),
      place: (g: THREE.BufferGeometry) =>
        g.translate(side * (INNER_X - CLIP_T / 2), CELL_Y + 0.001, 0),
    });
    // The brass cap of a cell (+ end): an open short cylinder and the disc on its outer face,
    // the face against the cell's silver end being hidden.
    const nub = (cellX: number) => {
      const sides = low ? 10 : 16;
      const side = new THREE.CylinderGeometry(NUB_R, NUB_R, NUB_L, sides, 1, true);
      side.rotateZ(Math.PI / 2);
      const disc = new THREE.CircleGeometry(NUB_R, sides);
      disc.rotateY(-Math.PI / 2);
      return [
        {
          geo: side,
          place: (g: THREE.BufferGeometry) => g.translate(cellX - NUB_L / 2, CELL_Y, 0),
        },
        { geo: disc, place: (g: THREE.BufferGeometry) => g.translate(cellX - NUB_L, CELL_Y, 0) },
      ];
    };
    const spring = (from: number, to: number) => ({
      geo: helixTube(
        to - from,
        CELL_SPRING.turns[quality],
        CELL_SPRING.coilR,
        CELL_SPRING.wireR,
        CELL_SPRING.perTurn[quality],
        CELL_SPRING.sides,
      ),
      place: (g: THREE.BufferGeometry) => g.translate(from, CELL_Y, 0),
    });
    // The tray: two end blocks, two rails and a floor, all mahogany. On the low tier the floor and
    // the back rail (only their top edges are seen) are plain boxes, to stay within the budget.
    const slab = (w: number, h: number, d: number, plain: boolean) =>
      plain ? new THREE.BoxGeometry(w, h, d) : bevelBox(w, h, d, 0.002, 1);
    const shellGeo = mergeStatic([
      ...[-1, 1].map((side) => ({
        geo: bevelBox(END_T, END_H, HOLDER_D, 0.003, bsSmall),
        place: (g: THREE.BufferGeometry) => g.translate(side * END_X, END_H / 2, 0),
      })),
      ...([-1, 1] as const).map((side) => {
        const railH = side < 0 ? RAIL_BACK_H : RAIL_FRONT_H;
        return {
          geo: slab(HOLDER_L - 2 * END_T + 0.004, railH, RAIL_T, low && side < 0),
          place: (g: THREE.BufferGeometry) => g.translate(0, railH / 2, side * RAIL_Z),
        };
      }),
      {
        geo: slab(HOLDER_L - 2 * END_T + 0.004, FLOOR_T, HOLDER_D, low),
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
    boxProjectUV(liningGeo, BENCH_TILE_M.pine);
    offsetUV(liningGeo, 0.738, -0.057); // the knot lands high on the back wall, at its left end
    const tagGeo = new THREE.PlaneGeometry(TAG_W, TAG_H);
    return {
      tex,
      wrapperMat,
      steelTex,
      steelMat: matte("#ffffff", rnd, {
        roughness: 0.62,
        metalness: 0.25,
        amount: 0.01,
        map: steelTex,
      }),
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
        ...ring(CELL_A, -1),
        ...ring(CELL_A + CELL_L - RING_L, 1),
        ...ring(CELL_B, -1),
        ...ring(CELL_B + CELL_L - RING_L, 1),
      ]),
      // The brass spring clips at both ends, the caps and the springs.
      brassGeo: mergeStatic([
        clip(-1),
        clip(1),
        ...nub(CELL_A),
        ...nub(CELL_B),
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
