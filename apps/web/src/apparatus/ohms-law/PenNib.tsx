import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTerminalRegistry } from "../../learn/terminals";
import type { TerminalId } from "../../learn/types";
import { InkGroup } from "../../scene/ink/ink";
import { INK_BLUE, paintMaterial } from "../materials";
import { INK_IDS } from "./layout";

/** Where the nib points (see PenNibProps.target). */
export type NibTarget = TerminalId | readonly [number, number, number] | null;

/** A value read every frame: a plain value, or a ref-like object whose `.current` is read. */
type Live<T> = T | { readonly current: T };

function read<T>(v: Live<T>): T {
  return typeof v === "object" && v !== null && "current" in v ? v.current : (v as T);
}

export interface PenNibProps {
  /**
   * Where the nib points: a terminal (followed through the terminal registry, so it moves with
   * the part), a world position, or null to put the pen away (it shrinks out of sight). A
   * ref-like `{ current }` is read every frame, so a scene can drive it without a React render.
   */
  target: Live<NibTarget>;
  /** A counter: each time it changes, the nib dips to the target and back (a tap). */
  tap?: Live<number>;
  /** How fast the nib's own motion runs (Watch's 1×, 1.5× or 2×); default 1. */
  rate?: Live<number>;
  quality: "low" | "mid" | "high";
}

/** How high the tip hovers above the target between taps, in metres. */
const HOVER_M = 0.045;
/** How long a tap takes, in seconds. */
const TAP_S = 0.28;
/** Follow rate: the cursor closes 1 - e^(-k dt) of the gap each frame. */
const FOLLOW_K = 11;

const _t = new THREE.Vector3();
const _arr = new THREE.Vector3();

/**
 * The Watch mode's cursor: a dip-pen nib that travels to each terminal and taps it, with the
 * blue-black ink the rest of the look uses. It reads the terminal's world position in useFrame,
 * allocates nothing there, and sits at the scene root (it works in world space). The tip is the
 * origin of the model, so what it points at is exactly where its tip is.
 */
export function PenNib({
  target: targetIn,
  tap: tapIn = 0,
  rate: rateIn = 1,
  quality,
}: PenNibProps) {
  const registry = useTerminalRegistry();
  const root = useRef<THREE.Group>(null);
  const cur = useRef(new THREE.Vector3());
  const seen = useRef(false);
  const grow = useRef(0);
  const tapT = useRef(TAP_S);
  const lastTap = useRef(read(tapIn));

  const res = useMemo(() => {
    const seg = quality === "low" ? 8 : 16;
    // The nib: a pointed shield, thin, with a slit. The tip is at the origin, pointing down.
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.0012, 0.004, 0.0046, 0.009, 0.0048, 0.017);
    shape.lineTo(0.0038, 0.0215);
    shape.lineTo(-0.0038, 0.0215);
    shape.lineTo(-0.0048, 0.017);
    shape.bezierCurveTo(-0.0046, 0.009, -0.0012, 0.004, 0, 0);
    const nib = new THREE.ExtrudeGeometry(shape, {
      depth: 0.0006,
      bevelEnabled: true,
      bevelSize: 0.0002,
      bevelThickness: 0.0002,
      bevelSegments: 1,
    });
    nib.translate(0, 0, -0.0003);
    const slit = new THREE.BoxGeometry(0.00028, 0.0125, 0.0012);
    slit.translate(0, 0.0068, 0);
    const hole = new THREE.CylinderGeometry(0.0007, 0.0007, 0.0012, 8);
    hole.rotateX(Math.PI / 2);
    hole.translate(0, 0.0135, 0);
    // The grip and barrel: a lacquered handle with a brass collar.
    const barrelProfile = [
      [0.0, 0.0215],
      [0.0034, 0.0215],
      [0.0042, 0.025],
      [0.0047, 0.034],
      [0.0054, 0.06],
      [0.0058, 0.09],
      [0.0048, 0.1],
      [0.0, 0.1],
    ].map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0));
    const barrel = new THREE.LatheGeometry(barrelProfile, seg);
    const collarProfile = [
      [0.0036, 0.0212],
      [0.0044, 0.0212],
      [0.0044, 0.0262],
      [0.0036, 0.0262],
    ].map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0));
    const collar = new THREE.LatheGeometry(collarProfile, seg);
    // A drop of ink on the tip while it taps.
    const drop = new THREE.SphereGeometry(0.0018, 8, 6);
    return {
      nib,
      slit,
      hole,
      barrel,
      collar,
      drop,
      goldMat: paintMaterial("#d6b160", 71, { roughness: 0.6, metalness: 0.25, amount: 0.02 }),
      slitMat: paintMaterial("#2a2118", 72),
      barrelMat: paintMaterial(INK_BLUE, 73, { amount: 0.02 }),
      collarMat: paintMaterial("#c29a3e", 74, { roughness: 0.62, metalness: 0.3 }),
      dropMat: new THREE.MeshBasicMaterial({ color: INK_BLUE }),
    };
  }, [quality]);
  useEffect(
    () => () => {
      for (const v of Object.values(res)) v.dispose();
    },
    [res],
  );

  useFrame((_, dtRaw) => {
    const g = root.current;
    if (!g) return;
    const target = read(targetIn);
    const tap = read(tapIn);
    const rate = read(rateIn);
    const dt = Math.min(dtRaw, 0.05) * (Number.isFinite(rate) && rate > 0 ? rate : 1);
    let ok = target !== null;
    if (target !== null) {
      if (typeof target === "string") ok = registry.worldPosition(target, _t);
      else _t.set(target[0] ?? 0, target[1] ?? 0, target[2] ?? 0);
    }
    if (tap !== lastTap.current) {
      lastTap.current = tap;
      tapT.current = 0;
    }
    tapT.current = Math.min(TAP_S, tapT.current + dt);
    const tt = tapT.current / TAP_S;
    // A tap: down to the target and back up.
    const dip = tt < 1 ? Math.sin(Math.PI * tt) : 0;
    const want = ok ? 1 : 0;
    grow.current += (want - grow.current) * (1 - Math.exp(-12 * dt));
    if (ok) {
      _arr.copy(_t);
      const k = seen.current ? 1 - Math.exp(-FOLLOW_K * dt) : 1;
      seen.current = true;
      cur.current.x += (_arr.x - cur.current.x) * k;
      cur.current.y += (_arr.y - cur.current.y) * k;
      cur.current.z += (_arr.z - cur.current.z) * k;
    } else if (grow.current < 0.01) {
      seen.current = false;
    }
    const s = grow.current;
    g.visible = s > 0.02;
    g.scale.setScalar(Math.max(0.001, s));
    g.position.set(
      cur.current.x,
      cur.current.y + HOVER_M * (1 - dip) * (0.25 + 0.75 * Math.min(1, s)),
      cur.current.z,
    );
    const drop = g.children[1];
    if (drop) drop.visible = dip > 0.35;
  });

  return (
    <group ref={root} visible={false}>
      {/* Lean back and to the right, so the nib reads from the camera. */}
      <group rotation={[-0.35, 0, -0.5]}>
        <InkGroup id={INK_IDS.pen} thin>
          <mesh geometry={res.nib} material={res.goldMat} castShadow />
          <mesh geometry={res.slit} material={res.slitMat} />
          <mesh geometry={res.hole} material={res.slitMat} />
          <mesh geometry={res.collar} material={res.collarMat} castShadow />
          <mesh geometry={res.barrel} material={res.barrelMat} castShadow />
        </InkGroup>
      </group>
      <mesh geometry={res.drop} material={res.dropMat} position={[0, 0.0012, 0]} visible={false} />
    </group>
  );
}
