import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InkGroup } from "../../scene/ink/ink";
import { INK_IDS, type PartProps } from "./layout";
import {
  brassMaterial,
  COLOURS,
  canvasTexture,
  disposeAll,
  jitterColour,
  makeCanvas,
  matte,
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
  const ids = INK_IDS.cells;
  const wrapperMatRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  const capMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const lastDrain = useRef(-1);

  const res = useMemo(() => {
    const rnd = seeded(7);
    const seg = low ? 14 : 32;
    const tex = wrapperTexture();
    const makeWrapper = () => {
      const m = matte("#ffffff", rnd, { roughness: 0.85, amount: 0.01, map: tex });
      // Each cell's printed wrapper is a little different in tone.
      m.color.copy(jitterColour("#a9c2d1", rnd, 0.06));
      return m;
    };
    const wrapperA = makeWrapper();
    const wrapperB = makeWrapper();
    // Cylinder sides use the wrapper; the two ends are bare metal.
    const zincMat = matte(COLOURS.zinc, rnd, { roughness: 0.7, metalness: 0.3 });
    const brassMat = brassMaterial(rnd);
    const can = () => {
      const g = new THREE.CylinderGeometry(CELL_R, CELL_R, CELL_L, seg);
      g.rotateZ(Math.PI / 2); // axis along x
      g.rotateX(-0.6); // printed face toward the front and a little up
      return g;
    };
    const capGeo = new THREE.CylinderGeometry(CAP_R, CAP_R, CAP_L, 14);
    capGeo.rotateZ(Math.PI / 2);
    return {
      tex,
      wrapperA,
      wrapperB,
      zincMat,
      brassMat,
      canA: can(),
      canB: can(),
      capGeo,
      spring: springGeometry(low),
      baseGeo: new THREE.BoxGeometry(BASE_L, BASE_T, BASE_D),
      wallGeo: new THREE.BoxGeometry(WALL, WALL_H, BASE_D),
      woodMat: matte("#4a2f20", rnd, { roughness: 0.78 }),
    };
  }, [low]);

  useEffect(() => {
    wrapperMatRefs.current = [res.wrapperA, res.wrapperB];
    capMatRef.current = res.brassMat;
    BRASS_FRESH.copy(res.brassMat.color);
    FRESH.copy(res.wrapperA.color);
    SPENT.copy(FRESH).lerp(SPENT_TINT, 0.55);
    lastDrain.current = -1;
    return () => disposeAll(res);
  }, [res]);

  useFrame(() => {
    const drain = state.current.readout.cellDrain01;
    if (Math.abs(drain - lastDrain.current) < 0.003) return;
    lastDrain.current = drain;
    const mats = wrapperMatRefs.current;
    // The wrapper greys a little and the cap tarnishes; the label stays readable.
    for (const m of mats) m.color.copy(FRESH).lerp(SPENT, drain);
    capMatRef.current?.color.copy(BRASS_FRESH).lerp(BRASS_SPENT, drain * 0.7);
  });

  const cellAx = -INNER_X + CAP_L + CELL_L / 2; // centre of the left-hand can
  const cellBx = CAP_L + CELL_L / 2;

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <InkGroup id={ids}>
        <mesh
          geometry={res.baseGeo}
          material={res.woodMat}
          position={[0, BASE_T / 2, 0]}
          castShadow
          receiveShadow
        />
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            geometry={res.wallGeo}
            material={res.woodMat}
            position={[side * WALL_X, WALL_H / 2, 0]}
            castShadow
            receiveShadow
          />
        ))}
      </InkGroup>
      <InkGroup id={ids + 1}>
        <mesh
          geometry={res.canA}
          material={[res.wrapperA, res.zincMat, res.zincMat]}
          position={[cellAx, CELL_Y, 0]}
          castShadow
          receiveShadow
        />
      </InkGroup>
      <InkGroup id={ids + 2}>
        <mesh
          geometry={res.canB}
          material={[res.wrapperB, res.zincMat, res.zincMat]}
          position={[cellBx, CELL_Y, 0]}
          castShadow
          receiveShadow
        />
      </InkGroup>
      {/* Brass caps (+) at the left end of each cell, and the coil spring on the − end. */}
      <InkGroup id={ids + 3} thin>
        <mesh
          geometry={res.capGeo}
          material={res.brassMat}
          position={[-INNER_X + CAP_L / 2, CELL_Y, 0]}
        />
        <mesh geometry={res.capGeo} material={res.brassMat} position={[CAP_L / 2, CELL_Y, 0]} />
        <mesh geometry={res.spring} material={res.brassMat} position={[INNER_X, CELL_Y, 0]} />
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
