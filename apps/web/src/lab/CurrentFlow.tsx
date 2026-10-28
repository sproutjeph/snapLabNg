import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BENCH_LAYOUT,
  BRIDGE_WIRE,
  COPPER_STRIP,
  cmToX,
  GALVANOMETER_DIMS,
} from "../apparatus/meter-bridge/dimensions";
import type { BranchCurrents, MeterBridgeVisualState } from "../apparatus/meter-bridge/types";
import { NO_INK } from "../scene/ink/inkPass";
import { flowRate } from "./flow";

/** A slightly bluer pen ink than --ink, so moving dots stand apart from the outlines. */
const DOT_INK_HEX = "#1f3566";
const DOT_USER_DATA = { [NO_INK]: true };

/** Height of the dots above the copper strips and the wire, so they read on top of them. */
const LIFT_M = 0.006;
const DOT_M = 0.0028;
/** At full rate a dot crosses a 1 m branch in about 4 s. */
const MAX_SPEED_M_S = 0.25;

type Branch = keyof Omit<BranchCurrents, "cell">;
type P = readonly [number, number, number];

const WIRE: { y: number; z: number } = { y: BRIDGE_WIRE.y + LIFT_M, z: BRIDGE_WIRE.z };
const STRIP_Y = 0.003 + LIFT_M;
const BACK_Z = COPPER_STRIP.backZ;
const GALVO_Y = GALVANOMETER_DIMS.height * 0.45;
const GALVO_Z = BENCH_LAYOUT.galvanometerPos[2] + GALVANOMETER_DIMS.radius + 0.008;

/**
 * The path of each branch in the direction of positive conventional current (circuit.ts):
 * the plug-box arm A → B along the back strip, the X arm B → C, the two parts of the wire
 * A → J and J → C, and the galvanometer branch B → G → J. J moves with the jockey.
 */
function branchPath(branch: Branch, jockeyCm: number): P[] {
  const jx = cmToX(jockeyCm);
  switch (branch) {
    case "rArm":
      return [
        [-0.5, STRIP_Y, COPPER_STRIP.frontZ],
        [-0.5, STRIP_Y, BACK_Z],
        [0, STRIP_Y, BACK_Z],
      ];
    case "xArm":
      return [
        [0, STRIP_Y, BACK_Z],
        [0.5, STRIP_Y, BACK_Z],
        [0.5, STRIP_Y, COPPER_STRIP.frontZ],
      ];
    case "wireAJ":
      return [
        [-0.5, WIRE.y, WIRE.z],
        [jx, WIRE.y, WIRE.z],
      ];
    case "wireJC":
      return [
        [jx, WIRE.y, WIRE.z],
        [0.5, WIRE.y, WIRE.z],
      ];
    case "galvo":
      return [
        [0, STRIP_Y, BACK_Z],
        [-0.036, GALVO_Y, GALVO_Z],
        [0.036, GALVO_Y, GALVO_Z],
        // Roughly along the lead's arc from the galvanometer up and over to the jockey.
        [(0.036 + jx) / 2, 0.11, (GALVO_Z + WIRE.z) / 2 - 0.04],
        [jx, 0.06, WIRE.z],
        [jx, WIRE.y, WIRE.z],
      ];
  }
}

/** Writes the point at fraction `u` (0–1) along a polyline into `out`. No allocation. */
function along(path: P[], u: number, out: THREE.Vector3): void {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i]);
  let left = u * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as P;
    const b = path[i] as P;
    const d = dist(a, b);
    if (left <= d || i === path.length - 1) {
      const t = d > 1e-9 ? Math.min(1, left / d) : 0;
      out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
      return;
    }
    left -= d;
  }
}

function dist(a: P | undefined, b: P | undefined): number {
  if (!a || !b) return 0;
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

const BRANCHES: Branch[] = ["rArm", "xArm", "wireAJ", "wireJC", "galvo"];

/**
 * Current-flow particles: dots move along each branch at a rate set by the engine's branch
 * current, in the direction of conventional current. At balance the galvanometer branch
 * carries no current, so its dots stop and fade. Nothing glows from heat (web-3d rules).
 */
export function CurrentFlow({
  state,
  maxDots,
}: {
  state: { current: MeterBridgeVisualState };
  maxDots: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const perBranch = Math.max(6, Math.floor(maxDots / BRANCHES.length));
  const count = perBranch * BRANCHES.length;

  const { geometry, material } = useMemo(
    () => ({
      geometry: new THREE.SphereGeometry(1, 8, 6),
      // Solid ink-blue, so the dots read on paper and copper without any glow.
      material: new THREE.MeshBasicMaterial({ color: new THREE.Color(DOT_INK_HEX) }),
    }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // Each dot's place along its branch, 0–1; spread evenly to start.
  const phase = useMemo(() => {
    const f = new Float32Array(count);
    for (let i = 0; i < count; i++) f[i] = (i % perBranch) / perBranch;
    return f;
  }, [count, perBranch]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), v: new THREE.Vector3() }), []);
  // Paths are rebuilt only when the jockey moves (J is one of their points).
  const paths = useRef<{ jockeyCm: number; byBranch: P[][] }>({
    jockeyCm: Number.NaN,
    byBranch: [],
  });

  useFrame((_, dtRaw) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const v = state.current;
    mesh.visible = v.keyClosed;
    if (!v.keyClosed) return;
    const dt = Math.min(dtRaw, 0.1);
    if (paths.current.jockeyCm !== v.jockeyCm) {
      paths.current.jockeyCm = v.jockeyCm;
      paths.current.byBranch = BRANCHES.map((b) => branchPath(b, v.jockeyCm));
    }
    for (let b = 0; b < BRANCHES.length; b++) {
      const branch = BRANCHES[b] as Branch;
      const path = paths.current.byBranch[b] ?? [];
      const current = branch === "galvo" && !v.jockeyDown ? 0 : v.currentsA[branch];
      const rate = flowRate(current);
      let length = 0;
      for (let i = 1; i < path.length; i++) length += dist(path[i - 1], path[i]);
      const du = length > 1e-6 ? (Math.sign(current) * rate * MAX_SPEED_M_S * dt) / length : 0;
      const size = rate > 0 ? DOT_M * (0.45 + 0.55 * rate) : 0;
      for (let k = 0; k < perBranch; k++) {
        const i = b * perBranch + k;
        let u = (phase[i] ?? 0) + du;
        u -= Math.floor(u);
        phase[i] = u;
        along(path, u, tmp.v);
        tmp.m.makeScale(size, size, size);
        tmp.m.setPosition(tmp.v);
        mesh.setMatrixAt(i, tmp.m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      visible={false}
      // Dots are too small for pen outlines: the ink pass and the low-tier hulls skip them.
      userData={DOT_USER_DATA}
    />
  );
}
