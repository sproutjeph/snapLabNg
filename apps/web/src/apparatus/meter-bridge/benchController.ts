import {
  addScrape,
  createMeterBridge,
  DT_S,
  type MeterBridgeInputs,
  type MeterBridgeState,
  stepMeterBridge,
} from "@snaplab/engine";
import type { MeterBridgeVisualState } from "./types";

/** How long a tap keeps the knife-edge on the wire, in seconds. */
const TAP_HOLD_S = 0.6;
/** After the last drag event the jockey lifts this much later. */
const DRAG_RELEASE_S = 0.25;
/** At most this many physics steps per call, so a long stall cannot freeze the page. */
const MAX_STEPS_PER_FRAME = 12;

export interface BenchSetup {
  /** Coil values of the plug box, in plug order (Ω). */
  boxValuesOhm: number[];
  /** Which plugs start in. */
  plugsIn: boolean[];
  /** The unknown resistance. It is never shown to the student. */
  xOhm: number;
}

export interface BenchHandlers {
  onWireTap(cm: number): void;
  onWireDrag(fromCm: number, toCm: number): void;
  onPlugToggle(index: number): void;
  onKeyToggle(): void;
}

export interface BenchController {
  /** What a view draws. Mutated in place by `advance`; never React state. */
  visual: MeterBridgeVisualState;
  handlers: BenchHandlers;
  /** Advances the engine by `deltaS` of real time, at a fixed 120 Hz. */
  advance(deltaS: number): void;
}

/**
 * The metre bridge bench without any renderer: steps @snaplab/engine at a fixed 120 Hz and
 * writes what a view draws into `visual`. The 3D kit (useMeterBridgeEngine) and the 2D Lite
 * view both drive it. The handlers change only the engine's inputs; every number a view
 * shows comes from the engine.
 */
export function createBenchController(setup: BenchSetup): BenchController {
  const plugsIn = [...setup.plugsIn];
  const inputs: MeterBridgeInputs = {
    plugsIn,
    boxValuesOhm: [...setup.boxValuesOhm],
    xOhm: setup.xOhm,
    keyClosed: false,
    jockeyCm: null,
  };
  let engine: MeterBridgeState = createMeterBridge();
  const visual: MeterBridgeVisualState = {
    jockeyCm: 50,
    jockeyDown: false,
    needleDeg: 0,
    plugsIn: [...setup.plugsIn],
    keyClosed: false,
    scrapesCm: [],
    currentsA: { cell: 0, rArm: 0, xArm: 0, wireAJ: 0, wireJC: 0, galvo: 0 },
  };
  const t = { accumulatorS: 0, liftAtS: 0, nowS: 0 };
  // One drag becomes one scrape over the whole span it covered, recorded when the jockey
  // lifts, so the engine's scrape list stays short however many pointer moves a drag has.
  const drag = { active: false, minCm: 0, maxCm: 0 };

  function advance(deltaS: number): void {
    t.accumulatorS = Math.min(t.accumulatorS + deltaS, MAX_STEPS_PER_FRAME * DT_S);
    while (t.accumulatorS >= DT_S) {
      t.accumulatorS -= DT_S;
      t.nowS += DT_S;
      if (inputs.jockeyCm !== null && t.nowS >= t.liftAtS) {
        inputs.jockeyCm = null;
        if (drag.active) {
          drag.active = false;
          engine = addScrape(engine, drag.minCm, drag.maxCm);
        }
      }
      engine = stepMeterBridge(engine, inputs);
    }

    visual.needleDeg = engine.needle.thetaDeg;
    const i = engine.solution.branchCurrentsA;
    const c = visual.currentsA;
    c.cell = i.cell;
    c.rArm = i.rArm;
    c.xArm = i.xArm;
    c.wireAJ = i.wireAJ;
    c.wireJC = i.wireJC;
    c.galvo = i.galvo;
    visual.keyClosed = inputs.keyClosed;
    visual.jockeyDown = inputs.jockeyCm !== null;
    if (inputs.jockeyCm !== null) visual.jockeyCm = inputs.jockeyCm;
    for (let i = 0; i < inputs.plugsIn.length; i++) visual.plugsIn[i] = inputs.plugsIn[i] ?? true;
    for (let i = visual.scrapesCm.length; i < engine.scrapesCm.length; i++) {
      const s = engine.scrapesCm[i];
      if (s) visual.scrapesCm.push([s[0], s[1]]);
    }
  }

  const handlers: BenchHandlers = {
    onWireTap(cm) {
      inputs.jockeyCm = cm;
      t.liftAtS = t.nowS + TAP_HOLD_S;
    },
    onWireDrag(fromCm, toCm) {
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
      t.liftAtS = t.nowS + DRAG_RELEASE_S;
    },
    onPlugToggle(index) {
      if (index >= 0 && index < plugsIn.length) plugsIn[index] = !plugsIn[index];
    },
    onKeyToggle() {
      inputs.keyClosed = !inputs.keyClosed;
    },
  };

  return { visual, handlers, advance };
}
