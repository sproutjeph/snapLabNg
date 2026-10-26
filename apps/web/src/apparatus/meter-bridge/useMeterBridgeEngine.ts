import { useFrame } from "@react-three/fiber";
import {
  addScrape,
  createMeterBridge,
  DT_S,
  type MeterBridgeInputs,
  type MeterBridgeState,
  stepMeterBridge,
} from "@snaplab/engine";
import { useMemo, useRef } from "react";
import type { MeterBridgeVisualState } from "./types";

/** How long a tap keeps the knife-edge on the wire, in seconds. */
const TAP_HOLD_S = 0.6;
/** After the last drag event the jockey lifts this much later. */
const DRAG_RELEASE_S = 0.25;
/** At most this many physics steps per frame, so a long stall cannot freeze the page. */
const MAX_STEPS_PER_FRAME = 12;

export interface BenchSetup {
  /** Coil values of the plug box, in plug order (Ω). */
  boxValuesOhm: number[];
  /** Which plugs start in. */
  plugsIn: boolean[];
  /** The unknown resistance. It is never shown to the student. */
  xOhm: number;
}

/**
 * Drives the metre bridge kit from @snaplab/engine: steps the engine at a fixed
 * 120 Hz inside the render loop and writes what the kit draws into `visual`.
 * The kit's callbacks change only the engine's inputs; every number on screen
 * comes from the engine.
 */
export function useMeterBridgeEngine(setup: BenchSetup) {
  // The plug states, kept mutable here; the engine sees them through `inputs.plugsIn`.
  const plugsIn = useRef<boolean[]>([...setup.plugsIn]).current;
  const inputs = useRef<MeterBridgeInputs>({
    plugsIn,
    boxValuesOhm: [...setup.boxValuesOhm],
    xOhm: setup.xOhm,
    keyClosed: false,
    jockeyCm: null,
  }).current;
  const engine = useRef<MeterBridgeState>(createMeterBridge());
  const visual = useRef<MeterBridgeVisualState>({
    jockeyCm: 50,
    jockeyDown: false,
    needleDeg: 0,
    plugsIn: [...setup.plugsIn],
    keyClosed: false,
    scrapesCm: [],
  });
  const timers = useRef({ accumulatorS: 0, liftAtS: 0, nowS: 0 });
  // One drag becomes one scrape over the whole span it covered, recorded when the jockey
  // lifts, so the engine's scrape list stays short however many pointer moves a drag has.
  const drag = useRef({ active: false, minCm: 0, maxCm: 0 }).current;

  useFrame((_, deltaS) => {
    const t = timers.current;
    t.accumulatorS = Math.min(t.accumulatorS + deltaS, MAX_STEPS_PER_FRAME * DT_S);
    while (t.accumulatorS >= DT_S) {
      t.accumulatorS -= DT_S;
      t.nowS += DT_S;
      if (inputs.jockeyCm !== null && t.nowS >= t.liftAtS) {
        inputs.jockeyCm = null;
        if (drag.active) {
          drag.active = false;
          engine.current = addScrape(engine.current, drag.minCm, drag.maxCm);
        }
      }
      engine.current = stepMeterBridge(engine.current, inputs);
    }

    const v = visual.current;
    const e = engine.current;
    v.needleDeg = e.needle.thetaDeg;
    v.keyClosed = inputs.keyClosed;
    v.jockeyDown = inputs.jockeyCm !== null;
    if (inputs.jockeyCm !== null) v.jockeyCm = inputs.jockeyCm;
    for (let i = 0; i < inputs.plugsIn.length; i++) v.plugsIn[i] = inputs.plugsIn[i] ?? true;
    for (let i = v.scrapesCm.length; i < e.scrapesCm.length; i++) {
      const s = e.scrapesCm[i];
      if (s) v.scrapesCm.push([s[0], s[1]]);
    }
  });

  const handlers = useMemo(
    () => ({
      onWireTap(cm: number) {
        inputs.jockeyCm = cm;
        timers.current.liftAtS = timers.current.nowS + TAP_HOLD_S;
      },
      onWireDrag(fromCm: number, toCm: number) {
        // Sliding the jockey is the mistake WAEC marks: it scrapes the wire (docs/15 §2).
        if (!drag.active) {
          drag.active = true;
          drag.minCm = Math.min(fromCm, toCm);
          drag.maxCm = Math.max(fromCm, toCm);
        } else {
          drag.minCm = Math.min(drag.minCm, fromCm, toCm);
          drag.maxCm = Math.max(drag.maxCm, fromCm, toCm);
        }
        inputs.jockeyCm = toCm;
        timers.current.liftAtS = timers.current.nowS + DRAG_RELEASE_S;
      },
      onPlugToggle(index: number) {
        if (index >= 0 && index < plugsIn.length) plugsIn[index] = !plugsIn[index];
      },
      onKeyToggle() {
        inputs.keyClosed = !inputs.keyClosed;
      },
    }),
    [inputs, plugsIn, drag],
  );

  return { visual, handlers };
}
