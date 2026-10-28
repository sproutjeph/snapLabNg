import {
  compareWithDiagram,
  createOhmsLaw,
  type DiagramComparison,
  DT_S,
  MAX_LEADS_PER_TERMINAL,
  type OhmsLawInputs,
  type OhmsLawState,
  paramsFromSeed,
  stepOhmsLaw,
} from "@snaplab/engine";
import * as THREE from "three";
import type {
  BenchLead,
  LeadColour,
  LessonMode,
  OhmsLawBench,
  OhmsLawVisualState,
  ProcedureNote,
  TerminalId,
} from "../types";

// The V–I bench controller (docs/plans/ohms-law-vi.md, "Wave 2 → Wiring"). Renderer-free, like
// the metre bridge's createBenchController: it owns the engine state, steps it at a fixed 120 Hz
// inside advance(), and writes the visual state in place. It never computes science itself:
// every current and needle angle comes from @snaplab/engine, and nothing here is ever printed.

/** At most this many physics steps per advance(), so a long stall cannot freeze the page. */
export const MAX_STEPS_PER_ADVANCE = 12;
/** Colours of new leads, in turn. */
export const LEAD_COLOURS: readonly LeadColour[] = ["red", "black", "yellow"];
/**
 * A key closed longer than this earns the "key left closed" note. No WAEC figure: a reading
 * takes a few seconds, so half a minute is clearly "left on" (docs/plans/ohms-law-vi.md).
 */
export const KEY_LEFT_CLOSED_S = 30;

/** The procedure notes, worded about what to do, never a value. Practice mode only. */
export const NOTE_TEXT: Readonly<Record<ProcedureNote["kind"], string>> = {
  key_left_closed:
    "Key K has stayed closed a long time. Open the key between readings, so the cells do not run down and the wire does not warm up.",
  eye_off_mirror:
    "Your eye was off the mirror line. Move until the needle hides its own image, then read.",
  loose_joint: "A joint is loose. Tighten the terminal nut on that lead.",
  dirty_joint: "A lead end is dirty. Clean it with sandpaper before you connect it.",
  over_range:
    "A needle hit the end stop. Open the key at once, then check how that meter is connected before you close it again.",
  reversed_meter:
    "A needle moved below zero: a meter is connected the wrong way round. Open the key and swap its two leads, so its + side leads back to the + of the cells.",
  short_circuit:
    "The cells are short-circuited. Open the key at once and check the circuit against the diagram.",
};

type Op = { kind: "add"; lead: BenchLead } | { kind: "remove"; lead: BenchLead; index: number };

export interface OhmsLawBenchController extends OhmsLawBench {
  /** The colour the next lead will be (for the rubber band). */
  readonly nextColour: LeadColour;
}

export interface OhmsLawBenchOptions {
  mode?: LessonMode;
}

const goodJoint = () => ({ tightened: true, clean: true });

/** The V–I bench for one seed. Same seed and same calls, same bench. */
export function createOhmsLawBench(
  seed: number,
  options: OhmsLawBenchOptions = {},
): OhmsLawBenchController {
  const params = paramsFromSeed(seed);
  let engine: OhmsLawState = createOhmsLaw(params);
  const leads: BenchLead[] = [];
  const plugsIn = params.boxCoilsOhm.map(() => true);
  const inputs: OhmsLawInputs = {
    leads,
    keyClosed: false,
    plugsIn,
    zeroTrimDeg: { ammeter: 0, voltmeter: 0 },
  };
  const visual: { current: OhmsLawVisualState } = {
    current: {
      readout: engine.readout,
      keyClosed: false,
      plugsIn,
      leads,
      pendingFrom: null,
      pointer: new THREE.Vector3(),
      ring: null,
      highlight: null,
      hintMissing: [],
      hintExtra: [],
    },
  };

  let mode: LessonMode = options.mode ?? "practice";
  let comparison: DiagramComparison = compareWithDiagram(leads);
  let notes: readonly ProcedureNote[] = [];
  const undoStack: Op[] = [];
  const listeners = new Set<() => void>();
  const t = {
    accumulatorS: 0,
    steps: 0,
    keyClosedSteps: 0,
    nextLeadId: 1,
    nextColour: 0,
    nextNote: 1,
  };
  /** Edge trackers: a bench note can fire only when its condition rises. */
  const seen = {
    keyLeftClosed: false,
    slams: 0,
    reversed: false,
    short: false,
  };
  /**
   * The circuit she has set up (leads by their ends, the key, the plugs), and the circuit each
   * bench note kind was last written for. A kind is not written again for the same circuit, so
   * opening and closing K on a shorted circuit does not repeat the note.
   */
  let circuit = "";
  const notedFor: Partial<Record<ProcedureNote["kind"], string>> = {};

  const nowS = () => t.steps * DT_S;
  const notify = () => {
    for (const fn of listeners) fn();
  };

  function applyHints(): void {
    const v = visual.current;
    if (mode === "practice") {
      v.hintMissing = comparison.missing;
      v.hintExtra = comparison.extra;
    } else {
      v.hintMissing = [];
      v.hintExtra = [];
    }
  }

  function circuitKey(): string {
    const ends = leads.map((l) => (l.a < l.b ? `${l.a}|${l.b}` : `${l.b}|${l.a}`)).sort();
    return `${ends.join(",")};K${inputs.keyClosed ? 1 : 0};${plugsIn.map((p) => (p ? 1 : 0)).join("")}`;
  }

  /** After any change to what she controls: note the circuit, refresh the hints. */
  function inputsChanged(leadsChanged: boolean): void {
    circuit = circuitKey();
    if (leadsChanged) {
      comparison = compareWithDiagram(leads);
      applyHints();
    }
  }

  const endsAt = (id: TerminalId) => {
    let n = 0;
    for (const l of leads) {
      if (l.a === id) n++;
      if (l.b === id) n++;
    }
    return n;
  };
  const full = (id: TerminalId) => endsAt(id) >= MAX_LEADS_PER_TERMINAL;

  function pushNote(kind: ProcedureNote["kind"], text: string): void {
    if (mode !== "practice") return;
    notes = [...notes, { id: `note-${t.nextNote++}`, atS: nowS(), kind, text }];
    notify();
  }

  /** A note the bench detected: written once per circuit (see `notedFor`), practice mode only. */
  function benchNote(kind: ProcedureNote["kind"]): void {
    if (mode !== "practice" || notedFor[kind] === circuit) return;
    notedFor[kind] = circuit;
    pushNote(kind, NOTE_TEXT[kind]);
  }

  const hasReversedMeter = () =>
    comparison.issues.includes("ammeter_reversed") ||
    comparison.issues.includes("voltmeter_reversed");

  /** Checks the note conditions after one engine step. Each fires on its rising edge only. */
  function watch(): void {
    const r = engine.readout;
    const longClosed = t.keyClosedSteps * DT_S > KEY_LEFT_CLOSED_S;
    if (longClosed && !seen.keyLeftClosed) benchNote("key_left_closed");
    seen.keyLeftClosed = longClosed;

    const slams = r.ammeterSlams + r.voltmeterSlams;
    if (slams > seen.slams) benchNote("over_range");
    seen.slams = slams;

    const reversed = inputs.keyClosed && hasReversedMeter();
    if (reversed && !seen.reversed) benchNote("reversed_meter");
    seen.reversed = reversed;

    if (r.shortCircuit && !seen.short) benchNote("short_circuit");
    seen.short = r.shortCircuit;
  }

  function addLead(lead: BenchLead, index = leads.length): void {
    leads.splice(index, 0, lead);
  }

  function dropLead(id: string): { lead: BenchLead; index: number } | null {
    const index = leads.findIndex((l) => l.id === id);
    const lead = leads[index];
    if (index < 0 || !lead) return null;
    leads.splice(index, 1);
    return { lead, index };
  }

  const bench: OhmsLawBenchController = {
    params,
    visual,

    advance(dtS) {
      if (!(dtS > 0)) return;
      t.accumulatorS += dtS;
      // Whole steps only; a hair of float slack so 2 × (1/240) s is exactly one step.
      let n = Math.floor(t.accumulatorS / DT_S + 1e-9);
      if (n > MAX_STEPS_PER_ADVANCE) {
        n = MAX_STEPS_PER_ADVANCE;
        t.accumulatorS = 0;
      } else t.accumulatorS = Math.max(0, t.accumulatorS - n * DT_S);
      for (let i = 0; i < n; i++) {
        engine = stepOhmsLaw(engine, inputs);
        t.steps++;
        t.keyClosedSteps = inputs.keyClosed ? t.keyClosedSteps + 1 : 0;
        watch();
      }
      visual.current.readout = engine.readout;
    },

    tapTerminal(id) {
      const v = visual.current;
      const from = v.pendingFrom;
      if (from === null) {
        if (full(id)) return;
        v.pendingFrom = id;
      } else if (from === id) {
        v.pendingFrom = null;
      } else {
        if (full(id)) return;
        const lead: BenchLead = {
          id: `L${t.nextLeadId++}`,
          a: from,
          b: id,
          jointA: goodJoint(),
          jointB: goodJoint(),
          colour: LEAD_COLOURS[t.nextColour % LEAD_COLOURS.length] ?? "red",
        };
        t.nextColour++;
        addLead(lead);
        undoStack.push({ kind: "add", lead });
        v.pendingFrom = null;
        inputsChanged(true);
      }
      notify();
    },

    removeLead(leadId) {
      const gone = dropLead(leadId);
      if (!gone) return;
      undoStack.push({ kind: "remove", lead: gone.lead, index: gone.index });
      inputsChanged(true);
      notify();
    },

    undo() {
      const op = undoStack.pop();
      if (!op) return;
      if (op.kind === "add") dropLead(op.lead.id);
      else addLead(op.lead, Math.min(op.index, leads.length));
      visual.current.pendingFrom = null;
      inputsChanged(true);
      notify();
    },

    reset() {
      leads.length = 0;
      undoStack.length = 0;
      for (let i = 0; i < plugsIn.length; i++) plugsIn[i] = true;
      inputs.keyClosed = false;
      t.keyClosedSteps = 0;
      visual.current.keyClosed = false;
      visual.current.pendingFrom = null;
      t.nextColour = 0;
      inputsChanged(true);
      notify();
    },

    toggleKey() {
      inputs.keyClosed = !inputs.keyClosed;
      visual.current.keyClosed = inputs.keyClosed;
      if (!inputs.keyClosed) t.keyClosedSteps = 0;
      inputsChanged(false);
      notify();
    },

    togglePlug(index) {
      if (!Number.isInteger(index) || index < 0 || index >= plugsIn.length) return;
      plugsIn[index] = !plugsIn[index];
      inputsChanged(false);
      notify();
    },

    setPointer(x, y, z) {
      visual.current.pointer.set(x, y, z);
    },

    setMode(next) {
      if (next === mode) return;
      mode = next;
      if (mode === "exam") visual.current.ring = null;
      applyHints();
      notify();
    },

    get mode() {
      return mode;
    },
    get comparison() {
      return comparison;
    },
    get boxSettingOhm() {
      let sum = 0;
      for (let i = 0; i < plugsIn.length; i++) if (!plugsIn[i]) sum += params.boxCoilsOhm[i] ?? 0;
      return sum;
    },
    get keyClosedForS() {
      return t.keyClosedSteps * DT_S;
    },
    get notes() {
      return notes;
    },
    get nextColour() {
      return LEAD_COLOURS[t.nextColour % LEAD_COLOURS.length] ?? "red";
    },

    addNote(note) {
      pushNote(note.kind, note.text);
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };

  circuit = circuitKey();
  applyHints();
  return bench;
}
