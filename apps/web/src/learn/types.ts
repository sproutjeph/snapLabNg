import type { OhmsLawRecord } from "@snaplab/contracts";
import type {
  PartId as CircuitPartId,
  DiagramComparison,
  Lead,
  OhmsLawParams,
  OhmsLawReadout,
  TerminalId,
} from "@snaplab/engine";
import type * as THREE from "three";
import type { Timeline } from "./timeline";

// Shared shapes for the hands-on lessons (docs/plans/ohms-law-vi.md).
// FROZEN for Waves 1–3: slices code against these and never change them; ask the lead.

export type { TerminalId };

/** Every item on the bench and the tray: Identify cards, callouts, rings and the diagram link. */
export type PartId =
  | CircuitPartId
  | "leads"
  | "nuts"
  | "sandpaper"
  | "paper"
  | "micrometer"
  | "rheostat";

export type LeadColour = "red" | "black" | "yellow";

/** A lead on the bench: the engine's lead plus how it is drawn. */
export interface BenchLead extends Lead {
  colour: LeadColour;
}

/**
 * Written by the bench controller every step and read inside useFrame. A ref, mutated in
 * place, never React state. `plugsIn` and `keyClosed` match the metre-bridge fields, so the
 * shared PlugBox and PlugKey read it as is.
 */
export interface OhmsLawVisualState {
  /** From the engine: needle angles and currents for the dots. Never printed as numbers. */
  readout: OhmsLawReadout;
  keyClosed: boolean;
  /** Same order as the box's coils; true = plug in (coil shorted). */
  plugsIn: boolean[];
  leads: BenchLead[];
  /** The terminal a new lead starts from while she picks its other end; null otherwise. */
  pendingFrom: TerminalId | null;
  /** World point on the bench under the pointer while a lead is pending (the rubber band). */
  pointer: THREE.Vector3;
  /** The one target with the pulsing dashed ink ring (guided mode only). */
  ring: PartId | TerminalId | null;
  /** Lit from the diagram, Identify mode or a callout. */
  highlight: PartId | null;
  /** Guided hint: diagram leads still missing, drawn as pencil-grey ghosts. Empty in exam mode. */
  hintMissing: ReadonlyArray<readonly [TerminalId, TerminalId]>;
  /** Guided hint: ids of her leads that are not in the diagram. Empty in exam mode. */
  hintExtra: readonly string[];
}

/** One terminal nut that lead ends attach to. */
export interface Terminal {
  id: TerminalId;
  part: PartId;
  /** For callouts and screen readers, e.g. "Ammeter +". */
  label: string;
  /** The nut's attach point. Its world position is read every frame. */
  object: THREE.Object3D;
}

export interface TerminalRegistry {
  /** Adds a terminal; returns the function that removes it. */
  register(t: Terminal): () => void;
  get(id: TerminalId): Terminal | undefined;
  /** Writes the terminal's world position into `out`; false if it is not mounted. */
  worldPosition(id: TerminalId, out: THREE.Vector3): boolean;
  all(): Iterable<Terminal>;
  /** A nut was tapped (or chosen from the keyboard). Wiring decides what that means. */
  tap(id: TerminalId): void;
  setTapHandler(fn: ((id: TerminalId) => void) | null): void;
}

export interface CameraPose {
  azimuthDeg: number;
  elevationDeg: number;
  target: [number, number, number];
  distanceM: number;
}

export interface Callout {
  part: PartId;
  label: string;
  sub?: string;
}

export interface IdentifyCard {
  part: PartId;
  name: string;
  /** How the item appears in the circuit diagram, in words. */
  symbol: string;
  whatItDoes: string;
  howToUse: string;
  /** The usual WAEC mistake with this item. */
  commonMistake: string;
}

/** Practice-mode feedback about procedure and technique. Never a value. */
export interface ProcedureNote {
  id: string;
  atS: number;
  kind:
    | "key_left_closed"
    | "eye_off_mirror"
    | "loose_joint"
    | "dirty_joint"
    | "over_range"
    | "reversed_meter"
    | "short_circuit";
  text: string;
}

/** What a step's `done` check may read. Bench state only; it never computes science. */
export interface BenchState {
  comparison: DiagramComparison;
  keyClosed: boolean;
  /** The box setting as a real box shows it: the sum of the coils whose plugs are out. */
  boxSettingOhm: number;
  /** What she has typed and drawn so far. */
  record: OhmsLawRecord;
  identified: ReadonlySet<PartId>;
}

export interface Step {
  key: string;
  title: string;
  /** The question's own words. */
  instruction: string;
  /** One plain line on what to tap or do next. */
  plain: string;
  /** The target that gets the ring in guided mode. */
  ring?: PartId | TerminalId;
  callouts?: Callout[];
  whyItWorks?: string[];
  precautions?: string[];
  reveal?: (tl: Timeline) => void;
  pose: string;
  done?: (s: BenchState) => boolean;
}

export interface Lesson {
  id: "meter_bridge" | "titration" | "ohms_law_vi";
  title: string;
  /** The circuit for this practical, as inline SVG with data-part and data-lead attributes. */
  diagram: { svg: string; caption: string };
  steps: Step[];
  poses: Record<string, CameraPose>;
  thumbnails: Record<string, { parts: PartId[]; size: [number, number] }>;
  identify: IdentifyCard[];
}

export type LessonMode = "practice" | "exam";

/**
 * The V–I bench controller (Wave 2 wiring slice builds it; readings, shell and the lesson page
 * use it). Renderer-free, like the metre bridge's createBenchController: it owns the engine state,
 * steps it at a fixed 120 Hz inside advance(), and writes `visual` in place. Discrete changes
 * (leads, key, plugs, mode, notes) notify subscribers so React UI can re-render; per-frame values
 * are read from `visual` inside useFrame only.
 */
export interface OhmsLawBench {
  readonly params: OhmsLawParams;
  readonly visual: { current: OhmsLawVisualState };
  /** Real time since the last call; the controller runs whole 120 Hz steps and keeps the rest. */
  advance(dtS: number): void;
  /** A nut was tapped: start a lead there, finish the pending one, or cancel it. */
  tapTerminal(id: TerminalId): void;
  /** A lead was tapped: remove it. */
  removeLead(leadId: string): void;
  /** Takes back the last lead change (add or remove). */
  undo(): void;
  /** Clears every lead, opens the key and puts every plug back in. */
  reset(): void;
  toggleKey(): void;
  togglePlug(index: number): void;
  /** World point on the bench under the pointer, for the rubber band. */
  setPointer(x: number, y: number, z: number): void;
  /** Exam mode clears the ring and the guided hints and stops procedure notes. */
  setMode(mode: LessonMode): void;
  readonly mode: LessonMode;
  /** The diagram comparison for the current leads (topology only). */
  readonly comparison: DiagramComparison;
  /** The box setting as a real box shows it (sum of unplugged coils). Never an engine value. */
  readonly boxSettingOhm: number;
  /** Seconds the key has been closed without a break (0 while open), for procedure notes. */
  readonly keyClosedForS: number;
  /** Practice-mode notes about procedure, newest last. Never a value. */
  readonly notes: readonly ProcedureNote[];
  addNote(note: Omit<ProcedureNote, "id" | "atS">): void;
  /** Called after every discrete change; returns the unsubscribe function. */
  subscribe(fn: () => void): () => void;
}
