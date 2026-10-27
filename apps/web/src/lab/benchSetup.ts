import type { BenchSetup } from "../apparatus/meter-bridge/useMeterBridgeEngine";

/** A standard school plug box: every whole value from 1 to 40 Ω can be pulled out. */
export const PLUG_BOX_COILS = [1, 2, 2, 5, 10, 20] as const;

/** X when neither a teacher's value nor her own mean is usable. Never shown. */
const DEFAULT_X_OHM = 4;

/**
 * Which plugs to pull (false = out, so that coil is in the circuit) to make `rOhm`, or null
 * when the box cannot make it. Largest coils first; for these coils that always finds a set.
 */
export function plugsInFor(rOhm: number): boolean[] | null {
  if (!Number.isInteger(rOhm) || rOhm < 1) return null;
  const plugsIn: boolean[] = PLUG_BOX_COILS.map(() => true);
  let left = rOhm;
  for (let i = PLUG_BOX_COILS.length - 1; i >= 0; i--) {
    const coil = PLUG_BOX_COILS[i] ?? 0;
    if (coil <= left) {
      plugsIn[i] = false;
      left -= coil;
    }
  }
  return left === 0 ? plugsIn : null;
}

export interface BenchInputs {
  /** The R values she wrote (blueprint values), in order; nulls are skipped. */
  resistancesOhm: Array<number | null>;
  /** The teacher's measured X, when teacher mode is on. */
  teacherXOhm: number | null;
  /** Her own mean X as written, when the page has one. */
  herMeanXOhm: number | null;
}

/**
 * The bench she gets: the plug box with her first R pulled out, and an X for the engine.
 * X is the teacher's value, else her own mean (so the bench behaves like her experiment),
 * else a default. It is only ever an engine input: nothing on screen shows it.
 */
export function benchSetupFrom(i: BenchInputs): { setup: BenchSetup; plugLabels: string[] } {
  const usable = (x: number | null): x is number => x !== null && x >= 0.5 && x <= 50;
  const xOhm = usable(i.teacherXOhm)
    ? i.teacherXOhm
    : usable(i.herMeanXOhm)
      ? i.herMeanXOhm
      : DEFAULT_X_OHM;
  const firstR = i.resistancesOhm.find((r): r is number => r !== null && r > 0) ?? 1;
  const plugsIn = plugsInFor(Math.round(firstR)) ?? plugsInFor(1) ?? [];
  return {
    setup: { boxValuesOhm: [...PLUG_BOX_COILS], plugsIn, xOhm },
    plugLabels: PLUG_BOX_COILS.map(String),
  };
}
