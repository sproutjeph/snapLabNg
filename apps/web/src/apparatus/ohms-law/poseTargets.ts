import { BENCH_FOOTPRINTS } from "./LeadParts";
import { OHMS_LAW_LAYOUT } from "./layout";

// Where each lesson camera pose looks, worked out from the bench layout so a moved part can never
// leave a pose aiming at empty desk. learn/lessons/ohms-law/lesson.ts reads these.

export interface Bounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The desk area the bench's parts cover (their footprints, ledges included). */
export function benchBounds(): Bounds {
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let z0 = Number.POSITIVE_INFINITY;
  let z1 = Number.NEGATIVE_INFINITY;
  for (const f of BENCH_FOOTPRINTS) {
    x0 = Math.min(x0, f.cx - f.hx);
    x1 = Math.max(x1, f.cx + f.hx);
    z0 = Math.min(z0, f.cz - f.hz);
    z1 = Math.max(z1, f.cz + f.hz);
  }
  return { x0, x1, z0, z1 };
}

type Target = [number, number, number];

const at = (slot: keyof typeof OHMS_LAW_LAYOUT): Target => {
  const [x, , z] = OHMS_LAW_LAYOUT[slot].position;
  return [x, 0, z];
};

const centre = (): Target => {
  const b = benchBounds();
  return [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2];
};

/** The two meters' midpoint: the readings step looks at both. */
const midMeters = (): Target => {
  const a = at("ammeter");
  const v = at("voltmeter");
  return [(a[0] + v[0]) / 2, 0, (a[2] + v[2]) / 2];
};

/** Pose targets by lesson pose name. */
export const POSE_TARGETS = {
  bench: centre(),
  connect: centre(),
  wire: at("wire"),
  readings: midMeters(),
  box: at("box"),
} as const satisfies Record<string, Target>;
