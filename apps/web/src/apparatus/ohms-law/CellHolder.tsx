import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import {
  bevelBox,
  bevelSegments,
  boxProjectUV,
  disposeKitBag,
  kitTexture,
  woodMaterial,
} from "../materials";
import { INK_IDS, type PartProps } from "./layout";
import {
  brassMaterial,
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
 * Two 1.5 V dry cells in series in a holder (E), terminals E+ and E−. Shows how drained the
 * cells are from `state.current.readout.cellDrain01`: the wrapper and the brass caps dull a
 * little, nothing glows. Props frozen.
 */

// Two D cells end to end, both with the brass cap on the left, so the chain runs + … − and the
// left-hand cell's zinc base touches the right-hand cell's cap. Real D-cell size: 34 x 61 mm.
const CELL_R = 0.017;
const CELL_L = 0.0605;
const CAP_L = 0.0012;
const CAP_R = 0.0055;
const WALL = 0.006;
const WALL_H = 0.046;
const BASE_T = 0.006;
const BASE_D = 0.046;
const INNER_X = CELL_L + CAP_L; // half the cell chain length
const WALL_X = INNER_X + 0.0035 + WALL / 2; // a little room for the spring on the − end
const BASE_L = WALL_X * 2 + WALL;
const CELL_Y = BASE_T + CELL_R;

const FRESH = new THREE.Color();
const SPENT = new THREE.Color();
const BRASS_FRESH = new THREE.Color();
const BRASS_SPENT = new THREE.Color("#5e4a28");
const SPENT_TINT = new THREE.Color("#7b7466");

function wrapperTexture() {
  // 512 px around the 107 mm circumference, 290 px along the 60.5 mm length (4.8 px/mm).
  // The text runs along the cell, as printed on a real one lying on its side.
  const { canvas, ctx } = makeCanvas(512, 290);
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 290);
    ctx.fillStyle = "#1f1d1c";
    ctx.fillRect(0, 0, 512, 12);
    ctx.fillRect(0, 278, 512, 12);
    ctx.translate(256, 145);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 58px Georgia, serif";
    ctx.fillText("1.5 V", 0, -14);
    ctx.font = "bold 24px Georgia, serif";
    ctx.fillText("DRY CELL", 0, 36);
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillStyle = "#c63a2d";
    ctx.fillText("+", -112, 0);
    ctx.fillStyle = "#1f1d1c";
    ctx.fillText("\u2212", 112, 0);
  }
  const tex = canvasTexture(canvas, 4);
  tex.wrapS = THREE.RepeatWrapping;
  tex.offset.x = 0.5; // the printed face sits at the front of the cylinder
  return tex;
}

function springGeometry(low: boolean) {
  const turns = 5;
  const pts: THREE.Vector3[] = [];
  const n = turns * (low ? 8 : 14);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(t * 0.0075, Math.cos(a) * 0.0065, Math.sin(a) * 0.0065));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, 0.0007, low ? 4 : 6, false);
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
    const seg = low ? 14 : 32;
    const tex = wrapperTexture();
    const woodTex = kitTexture("mahogany", quality);
    const bs = bevelSegments(quality);
    const wrapperMat = matte("#ffffff", rnd, { roughness: 0.85, amount: 0.01, map: tex });
    wrapperMat.color.copy(jitterColour("#a9c2d1", rnd, 0.06));
    const cellAx = -INNER_X + CAP_L + CELL_L / 2; // centre of the left-hand can
    const cellBx = CAP_L + CELL_L / 2;
    // Each can is a bare cylinder side; the printed face turns toward the front and a little up.
    const can = (cx: number) => {
      const geo = new THREE.CylinderGeometry(CELL_R, CELL_R, CELL_L, seg, 1, true);
      geo.rotateZ(Math.PI / 2); // axis along x
      geo.rotateX(-0.6);
      return { geo, place: (g: THREE.BufferGeometry) => g.translate(cx, CELL_Y, 0) };
    };
    // The zinc ends: one disc at each end of each can.
    const disc = (x: number, facing: 1 | -1) => {
      const geo = new THREE.CircleGeometry(CELL_R * 0.985, seg);
      geo.rotateY((facing * Math.PI) / 2);
      return { geo, place: (g: THREE.BufferGeometry) => g.translate(x, CELL_Y, 0) };
    };
    const cap = (x: number) => {
      const geo = new THREE.CylinderGeometry(CAP_R, CAP_R, CAP_L, 14);
      geo.rotateZ(Math.PI / 2);
      return { geo, place: (g: THREE.BufferGeometry) => g.translate(x, CELL_Y, 0) };
    };
    const spring = springGeometry(low);
    return {
      tex,
      wrapperMat,
      zincMat: matte(COLOURS.zinc, rnd, { roughness: 0.7, metalness: 0.3 }),
      brassMat: brassMaterial(rnd),
      woodTex,
      woodMat: woodMaterial(7, { map: woodTex }),
      // Both cells, both sets of ends, both caps and the spring: one draw call each.
      cansGeo: mergeStatic([can(cellAx), can(cellBx)]),
      discsGeo: mergeStatic([
        disc(-INNER_X + CAP_L, -1),
        disc(0, 1),
        disc(CAP_L, -1),
        disc(CAP_L + CELL_L, 1),
      ]),
      brassGeo: mergeStatic([
        cap(-INNER_X + CAP_L / 2),
        cap(CAP_L / 2),
        { geo: spring, place: (g: THREE.BufferGeometry) => g.translate(INNER_X, CELL_Y, 0) },
      ]),
      // The base and both end walls: one bevelled geometry.
      holderGeo: (() => {
        const g = mergeStatic([
          {
            geo: bevelBox(BASE_L, BASE_T, BASE_D, 0.0022, bs),
            place: (g) => g.translate(0, BASE_T / 2, 0),
          },
          ...[-1, 1].map((side) => ({
            geo: bevelBox(WALL, WALL_H, BASE_D, 0.0022, bs),
            place: (g: THREE.BufferGeometry) => g.translate(side * WALL_X, WALL_H / 2, 0),
          })),
        ]);
        boxProjectUV(g, [0.3, 0.15]);
        return g;
      })(),
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
    // The wrapper greys a little and the cap tarnishes; the label stays readable.
    wrapperMatRef.current?.color.copy(FRESH).lerp(SPENT, drain);
    capMatRef.current?.color.copy(BRASS_FRESH).lerp(BRASS_SPENT, drain * 0.7);
  });

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <InkGroup id={ids}>
        <mesh
          geometry={res.holderGeo}
          material={res.woodMat}
          castShadow={cast}
          receiveShadow={cast}
        />
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
        <mesh geometry={res.discsGeo} material={res.zincMat} />
      </InkGroup>
      {/* Brass caps (+) at the left end of each cell, and the coil spring on the − end. */}
      <InkGroup id={ids + 3} thin>
        <mesh geometry={res.brassGeo} material={res.brassMat} />
      </InkGroup>
      <TerminalNut
        id="E+"
        part="cells"
        position={[-WALL_X, WALL_H, 0]}
        state={state}
        quality={quality}
      />
      <TerminalNut
        id="E-"
        part="cells"
        position={[WALL_X, WALL_H, 0]}
        state={state}
        quality={quality}
      />
    </group>
  );
}
