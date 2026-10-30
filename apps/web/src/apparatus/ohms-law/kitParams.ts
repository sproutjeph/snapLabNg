import { PART_TERMINALS, TERMINAL_IDS, type TerminalId } from "@snaplab/engine";
import * as THREE from "three";
import type { TerminalRegistry } from "../../learn/types";
import { parseOverride } from "../../quality/tier";
import { LOOK_ELEVATION_DEG, SHOT_DEPTH_RATIO, SHOT_HEIGHT_M } from "../../scene/look/LookCamera";
import type { Covered } from "../../scene/look/types";
import type { QualityTier } from "../meter-bridge/types";
import { BENCH_FOOTPRINTS } from "./LeadParts";
import { type BenchSlot, INK_IDS, OHMS_LAW_LAYOUT, TERMINAL_PART } from "./layout";

// The V–I kit preview's URL parameters and the view they ask for, as pure functions so a test
// can pin them without WebGL (docs/plans/asset-pass.md, "The seam"). KitPreview.tsx mounts what
// `planKit` says and frames it with `shotFor`.

/** The seven bench parts, in the layout's order. */
export const SLOT_SUBJECTS: readonly BenchSlot[] = [
  "cells",
  "key",
  "ammeter",
  "voltmeter",
  "box",
  "wire",
  "tray",
];

/** The ten things `?kit=ohms-law&part=<subject>` can frame. */
export const KIT_SUBJECTS = [...SLOT_SUBJECTS, "leads", "terminal", "desk"] as const;
export type KitSubject = (typeof KIT_SUBJECTS)[number];

/** The reference image of each subject (docs/design/asset-pass/<name>.webp), and the other way round. */
const ASSET_NAME: Readonly<Record<KitSubject, string>> = {
  ammeter: "ammeter",
  voltmeter: "voltmeter",
  box: "resistance-box",
  key: "plug-key",
  cells: "cell-holder",
  wire: "wire-board",
  tray: "tray",
  leads: "leads",
  terminal: "terminal",
  desk: "desk-props",
};

export function referenceFile(subject: KitSubject): string {
  return `${ASSET_NAME[subject]}.webp`;
}

/** `part=` takes a subject or its asset name (`resistance-box` for `box`, and so on). */
export function parseSubject(raw: string | null): KitSubject | null {
  if (!raw) return null;
  const name = raw.trim().toLowerCase();
  for (const s of KIT_SUBJECTS) if (s === name || ASSET_NAME[s] === name) return s;
  return null;
}

/**
 * A terminal id from a URL value. A typed `id=A+` reaches the page as "A " (a plus decodes to a
 * space), so a trailing space reads as "+"; the real minus sign and lower case are accepted too.
 */
export function parseTerminalId(raw: string | null): TerminalId | null {
  if (!raw) return null;
  const name = raw.replace(/−/g, "-").toUpperCase().replace(/ $/, "+");
  return TERMINAL_IDS.find((id) => id === name) ?? null;
}

export interface KitParams {
  /** null: the whole bench with the desk things, as the look shows it. */
  subject: KitSubject | null;
  /** The nut `part=terminal` looks at. */
  terminal: TerminalId;
  /** Camera azimuth in degrees (LookCamera's: 0 from the student's side, 45 the golden frame's). */
  azDeg: number;
  /** 1–4: how much tighter than the fitted view. */
  zoom: number;
  /** 1–3 pins the canvas pixel ratio and switches the ladder off; null leaves the ladder. */
  dpr: number | null;
  /** Sweeps the azimuth about `azDeg`. */
  turn: boolean;
  /** Logs the terminals' world positions as JSON once the bench is up. */
  dump: boolean;
  /** Shows the subject's reference image beside the canvas (dev server only). */
  ref: boolean;
  /** The seven diagram leads are drawn. */
  leads: boolean;
  /** How much of each lead is drawn, 0–1. */
  drawn: number;
  /** Both needles at this angle; null leaves them where the engine puts them. */
  deg: number | null;
  /** Puts the Watch pen nib on this terminal. */
  pen: TerminalId | null;
  quality: QualityTier;
}

export const DEFAULT_AZ_DEG = 45;
export const DEFAULT_TERMINAL: TerminalId = "A+";
export const ZOOM_RANGE = [1, 4] as const;
export const DPR_RANGE = [1, 3] as const;

/** A finite number from a URL value, or null (missing, empty or not a number). */
function numberParam(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Reads `location.search`. Unknown or unusable values fall back to the defaults. */
export function parseKitParams(search: string): KitParams {
  const q = new URLSearchParams(search);
  const subject = parseSubject(q.get("part"));
  const dpr = numberParam(q.get("dpr"));
  const zoom = numberParam(q.get("zoom"));
  return {
    subject,
    terminal: parseTerminalId(q.get("id")) ?? DEFAULT_TERMINAL,
    azDeg: numberParam(q.get("az")) ?? DEFAULT_AZ_DEG,
    zoom: clamp(zoom ?? 1, ZOOM_RANGE[0], ZOOM_RANGE[1]),
    dpr: dpr === null ? null : clamp(dpr, DPR_RANGE[0], DPR_RANGE[1]),
    turn: q.get("turn") === "1",
    dump: q.get("dump") === "1",
    ref: q.get("ref") === "1",
    leads: q.get("leads") === "1" || q.has("drawn") || subject === "leads",
    drawn: numberParam(q.get("drawn")) ?? 1,
    deg: numberParam(q.get("deg")),
    pen: parseTerminalId(q.get("pen")),
    quality: parseOverride(search) ?? "high",
  };
}

// ---- The camera: one view on every screen ----------------------------------------------------

/**
 * LookCamera looks steeper (64 degrees) and turns to 82 when the part of the canvas no panel
 * covers is taller than 1.15 times its width, which is every phone held upright. The kit keeps
 * one camera on every screen, the golden frame's 41 degrees, so on a tall canvas it "covers"
 * the same strip above and below, leaving a free area no taller than this times its width.
 */
export const KIT_MAX_FREE_ASPECT = 1.1;

export function kitCovered(width: number, height: number): Covered {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const pad = Math.max(0, (h - w * KIT_MAX_FREE_ASPECT) / 2);
  return { left: 0, right: 0, top: pad, bottom: pad };
}

/** `turn=1`: the azimuth swings ±30 degrees about the base, once round every 8 seconds. */
export const TURN_DEG = 30;
export const TURN_PERIOD_S = 8;

export function turnAzimuth(baseDeg: number, seconds: number): number {
  return baseDeg + TURN_DEG * Math.sin((2 * Math.PI * seconds) / TURN_PERIOD_S);
}

// ---- What is shown ---------------------------------------------------------------------------

/** A box on the desk, in metres: x and z in the bench's frame, `h` the height of its top. */
export interface Bounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
}

/** A nut's collar reaches this far past a part's footprint. */
const REACH_M = 0.006;
/**
 * Height above a part's top for what stands on it: a nut's top is 2.4 cm above its foot, and a
 * plug standing in it another 4 cm, where leads are drawn.
 */
const TOP_PAD_M = 0.025;
const LEADS_TOP_PAD_M = 0.07;
/**
 * Where the exam-desk props lay, [x, z] in metres, in front of the bench. The props were removed
 * in Wave 2 (docs/plans/wave-2-lean.md); `part=desk` still frames that patch of desk.
 */
const DESK_PROP_PLACES = {
  pencil: { x: -0.52, z: 0.34 },
  eraser: { x: -0.22, z: 0.38 },
  booklet: { x: 0.14, z: 0.44 },
  calculator: { x: 0.5, z: 0.38 },
} as const;
/** A pencil, an eraser, a booklet and a calculator, as circles round DESK_PROP_PLACES, in metres. */
const DESK_PROP_REACH_M = { pencil: 0.12, eraser: 0.03, booklet: 0.17, calculator: 0.09 } as const;
const DESK_TOP_M = 0.02;
/**
 * What `part=terminal` frames: a nut with its plug standing in it (about 6.5 cm) and the empty nut
 * beside it. Where it is comes from the registry once the nut mounts; this is only its size.
 */
const MACRO_WIDTH_M = 0.09;
const MACRO_DEPTH_M = 0.05;
const MACRO_TOP_M = 0.07;
/** The macro looks at the nut's top, a little above where a plug seats. */
export const MACRO_LIFT_M = 0.01;

/**
 * Where a terminal's macro lead ends, as a heading from its nut. Three things decide it.
 *
 * The lead lies down. Its free end is on the paper (a carried plug is Lead's own 2.2 cm above it)
 * and its cable lies on whatever is under it, as it does on the bench; nothing holds it up.
 *
 * The free plug must land past the edge of the whole canvas, not only of the free area: a phone
 * still draws the strips above and below the free area (kitCovered), and a plug inside the canvas
 * hangs in the air. At 390 x 844 and 1440 x 900 every end here is out of the canvas from every
 * azimuth of the turn=1 sweep (15 to 75) and from 25 degrees of drag beyond it, with 30 px to
 * spare for a plug twice as thick, longer and carried higher than Lead's (kitParams.test.ts pins
 * that).
 *
 * And the cable must touch nothing the shot does not show. Lead rests its cable on every footprint
 * in BENCH_FOOTPRINTS (floorAt), but `part=terminal` hides every part except the nut's own and the
 * ones in MACRO_RESTS_ON, so a cable lifted onto a hidden one floats 1.4 to 2.3 cm over bare
 * paper. Lead also bulges the cable sideways by up to min(d, 0.5) x 0.22 of its span d, 7.7 cm at
 * 0.35 m, a hash-chosen side and amount, so every heading below keeps that whole band clear of the
 * hidden parts, of the taller body of its own part (a meter's case), and of the nuts in view.
 */
interface MacroLead {
  /**
   * Heading of the free end from the nut, in degrees: 0 her right (+x), 90 toward her (+z),
   * 180 her left, 270 away from her.
   */
  deg: number;
  /** Metres from the nut, along the paper. */
  reach: number;
}

/** A lead that lies on the paper out to a plug past the canvas. */
const LAID = { reach: 0.35 } as const;

/**
 * Each nut's lead. The front row (cells, key, ammeter, box) leaves toward her, splayed away from
 * its neighbours, which stand 6 to 10 cm to either side. The wire's X runs out over the back of the
 * board, as the ammeter and the box in front of it leave only 3 cm clear between their ramps, and
 * Y out to her right and a little toward her, off the board's front edge, with the tray behind it
 * and 9 cm between the key and the cells ahead.
 *
 * The voltmeter's nuts have no way across bare paper: the wire board's footprint and ramp start
 * 3 cm in front of them, their own case is 2 cm behind, and the tray is 6 cm to the right of V+, so
 * a cable on the paper is lifted onto one of them whichever way it leaves, and holding it up in the
 * air (as this table once did) is not a lead on a bench. So they lead where the real ones go, over
 * the wire board (DIAGRAM_LEADS runs V+ to X and V- to Y), which MACRO_RESTS_ON draws. V+ leaves
 * toward her and a little to the left, its cable passing 3 cm from V-'s axis and at least 5 cm
 * clear of the tray's and the key's ramps; V- fans out farther left, at least 7 cm clear of every
 * hidden part and 12 cm from X, to the paper in front of the board.
 */
const MACRO_LEADS: Readonly<Record<TerminalId, MacroLead>> = {
  "E+": { deg: 90, ...LAID },
  "E-": { deg: 60, ...LAID },
  K1: { deg: 60, ...LAID },
  K2: { deg: 120, ...LAID },
  "A+": { deg: 60, ...LAID },
  "A-": { deg: 120, ...LAID },
  "V+": { deg: 115, ...LAID },
  "V-": { deg: 140, ...LAID },
  R1: { deg: 120, ...LAID },
  R2: { deg: 150, ...LAID },
  X: { deg: 300, ...LAID },
  Y: { deg: 20, ...LAID },
};

/**
 * The parts besides its own that a macro's cable lies on, so the shot draws them (faded, as the
 * leads shot draws the parts it joins) instead of hiding them and leaving the cable floating over
 * bare paper. Only the voltmeter's nuts need one (see MACRO_LEADS); kitParams.test.ts checks that
 * no hidden part lifts any of the twelve cables.
 */
const MACRO_RESTS_ON: Readonly<Partial<Record<TerminalId, readonly BenchSlot[]>>> = {
  "V+": ["wire"],
  "V-": ["wire"],
};

/**
 * Writes into `out` where terminal `id`'s macro lead has its free plug: MACRO_LEADS' heading and
 * reach from the nut at `nut`, on the paper. Allocates nothing.
 */
export function macroFreeEnd(
  id: TerminalId,
  nut: { x: number; z: number },
  out: THREE.Vector3,
): THREE.Vector3 {
  const { deg, reach } = MACRO_LEADS[id];
  const a = (deg * Math.PI) / 180;
  return out.set(nut.x + reach * Math.cos(a), 0, nut.z + reach * Math.sin(a));
}

function union(boxes: readonly Bounds[]): Bounds {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    z0: Math.min(...boxes.map((b) => b.z0)),
    z1: Math.max(...boxes.map((b) => b.z1)),
    h: Math.max(...boxes.map((b) => b.h)),
  };
}

/** One part's footprint (a meter's case and ledge together) with room for nuts and plugs. */
export function slotBounds(slot: BenchSlot, topPad = TOP_PAD_M): Bounds {
  const feet = BENCH_FOOTPRINTS.filter((f) => f.slot === slot);
  return union(
    feet.map((f) => ({
      x0: f.cx - f.hx - REACH_M,
      x1: f.cx + f.hx + REACH_M,
      z0: f.cz - f.hz - REACH_M,
      z1: f.cz + f.hz + REACH_M,
      h: f.top + topPad,
    })),
  );
}

export function deskBounds(): Bounds {
  const boxes = (Object.keys(DESK_PROP_PLACES) as (keyof typeof DESK_PROP_PLACES)[]).map((k) => {
    const { x, z } = DESK_PROP_PLACES[k];
    const r = DESK_PROP_REACH_M[k];
    return { x0: x - r, x1: x + r, z0: z - r, z1: z + r, h: DESK_TOP_M };
  });
  return union(boxes);
}

/** Which ink ids belong to a part: its block of ten, and its nuts. */
export function partInkIds(slot: BenchSlot): number[] {
  const ids: number[] = [];
  for (let i = 0; i < 10; i++) ids.push(INK_IDS[slot] + i);
  if (slot in PART_TERMINALS) {
    for (const t of PART_TERMINALS[slot as keyof typeof PART_TERMINALS]) {
      ids.push(INK_IDS.nutBase + TERMINAL_IDS.indexOf(t));
    }
  }
  return ids;
}

/** The ink ids of the leads (twenty, wrapping). */
export function leadInkIds(): number[] {
  return Array.from({ length: 20 }, (_, i) => INK_IDS.leadBase + i);
}

export interface KitPlan {
  /** Which parts are drawn. The rest stay mounted, hidden, so every terminal is still registered. */
  parts: Readonly<Record<BenchSlot, boolean>>;
  /** The exam desk's things (booklet, pencil, eraser, calculator). */
  desk: boolean;
  /** The seven diagram leads. */
  leads: boolean;
  /** A lead plug seated in this nut, its cable leaving sideways (`part=terminal`). */
  macro: TerminalId | null;
  /** Ink ids kept in full ink while the rest fade back; null keeps everything in focus. */
  focusIds: ReadonlySet<number> | null;
  /** What the shot has to fit. */
  bounds: Bounds;
}

function only(slots: readonly BenchSlot[]): Record<BenchSlot, boolean> {
  const parts = {} as Record<BenchSlot, boolean>;
  for (const s of SLOT_SUBJECTS) parts[s] = slots.includes(s);
  return parts;
}

/** The parts that carry terminals: what the leads join. */
const WIRED_SLOTS = Object.keys(PART_TERMINALS) as BenchSlot[];

/**
 * What a set of parameters mounts, hides and fades:
 *  - a part alone: only that part is drawn (the rest hidden, still registered); with `leads` or
 *    `pen` the whole bench is drawn, the part and the leads in full ink, the rest faded;
 *  - `leads`: the six parts the leads join, faded, and the leads in full ink;
 *  - `terminal`: the part owning the nut, and a plug in the nut; with the parts its cable lies on,
 *    faded, where it cannot lie on the paper (MACRO_RESTS_ON);
 *  - `desk`: the desk things alone;
 *  - none: the whole bench and the desk things.
 */
export function planKit(p: KitParams): KitPlan {
  const { subject } = p;
  if (subject === "desk") {
    return {
      parts: only([]),
      desk: true,
      leads: false,
      macro: null,
      focusIds: null,
      bounds: deskBounds(),
    };
  }
  if (subject === "terminal") {
    const owner = TERMINAL_PART[p.terminal];
    const rests = MACRO_RESTS_ON[p.terminal] ?? [];
    const [x, , z] = OHMS_LAW_LAYOUT[owner].position;
    return {
      parts: only([owner, ...rests]),
      desk: false,
      leads: false,
      macro: p.terminal,
      // The parts the cable lies on fade back, so the nut and its lead stay the picture.
      focusIds: rests.length > 0 ? new Set([...partInkIds(owner), ...leadInkIds()]) : null,
      bounds: {
        x0: x - MACRO_WIDTH_M / 2,
        x1: x + MACRO_WIDTH_M / 2,
        z0: z - MACRO_DEPTH_M / 2,
        z1: z + MACRO_DEPTH_M / 2,
        h: MACRO_TOP_M,
      },
    };
  }
  const pen = p.pen === null ? [] : [INK_IDS.pen];
  if (subject === "leads") {
    return {
      parts: only(WIRED_SLOTS),
      desk: false,
      leads: true,
      macro: null,
      focusIds: new Set([...leadInkIds(), ...WIRED_SLOTS.flatMap(nutIds), ...pen]),
      bounds: union(WIRED_SLOTS.map((s) => slotBounds(s, LEADS_TOP_PAD_M))),
    };
  }
  if (subject === null) {
    return {
      parts: only(SLOT_SUBJECTS),
      desk: true,
      leads: p.leads,
      macro: null,
      focusIds: null,
      bounds: union([
        ...SLOT_SUBJECTS.map((s) => slotBounds(s, p.leads ? LEADS_TOP_PAD_M : TOP_PAD_M)),
        deskBounds(),
      ]),
    };
  }
  // One part of the bench.
  const needsBench = p.leads || p.pen !== null;
  return {
    parts: only(needsBench ? SLOT_SUBJECTS : [subject]),
    desk: false,
    leads: p.leads,
    macro: null,
    focusIds: needsBench
      ? new Set([...partInkIds(subject), ...(p.leads ? leadInkIds() : []), ...pen])
      : null,
    bounds: slotBounds(subject, p.leads ? LEADS_TOP_PAD_M : TOP_PAD_M),
  };
}

function nutIds(slot: BenchSlot): number[] {
  return partInkIds(slot).filter((id) => id >= INK_IDS.nutBase);
}

// ---- The shot --------------------------------------------------------------------------------

/**
 * What the subject's box fills of the part of the canvas that is free, along its tighter side.
 * The plan's references fill about 70% of their frame; the box has a little room round the real
 * outline (nuts, plugs), so this is a little more.
 */
export const KIT_FILL = 0.74;

/** The half extents of a box's outline on the screen, in metres, about the middle of the box. */
export interface Extents {
  right: number;
  up: number;
}

/**
 * Writes into `out` how far a box reaches along the camera's right and up vectors from its
 * middle (a box's outline is its corners', so this is exact), seen from `azDeg` at the look's
 * elevation. Allocates nothing; KitCamera calls it every frame while the azimuth turns.
 */
export function screenExtents(b: Bounds, azDeg: number, out: Extents): Extents {
  const az = (azDeg * Math.PI) / 180;
  const el = (LOOK_ELEVATION_DEG * Math.PI) / 180;
  const s = Math.abs(Math.sin(az));
  const c = Math.abs(Math.cos(az));
  const hx = (b.x1 - b.x0) / 2;
  const hz = (b.z1 - b.z0) / 2;
  out.right = c * hx + s * hz;
  out.up = Math.sin(el) * (s * hx + c * hz) + Math.cos(el) * (b.h / 2);
  return out;
}

/**
 * The orthographic zoom that makes a subject fill `fill` of the free area, along its tighter
 * side. `halfW` and `halfH` are the half width and height in metres of the whole canvas's view
 * at zoom 1, which is what LookCamera's frustum holds after it has fitted its shot. Pure, and
 * allocation-free.
 */
export function fillZoom(
  ext: Extents,
  halfW: number,
  halfH: number,
  covered: Covered,
  width: number,
  height: number,
  fill = KIT_FILL,
): number {
  const freeW = Math.max(1, width - Math.max(0, covered.left) - Math.max(0, covered.right));
  const freeH = Math.max(1, height - Math.max(0, covered.top) - Math.max(0, covered.bottom));
  // Half the free area, in metres, at zoom 1.
  const viewW = halfW * (freeW / Math.max(1, width));
  const viewH = halfH * (freeH / Math.max(1, height));
  return Math.min(
    (viewW * fill) / Math.max(ext.right, 1e-6),
    (viewH * fill) / Math.max(ext.up, 1e-6),
  );
}

/** The patch LookCamera fits is at least this small a half span, metres. */
const MIN_HALF_SPAN_M = 0.03;

export interface KitShot {
  id: string;
  focus: [number, number, number];
  spanM: number;
  azimuthDeg: number;
}

/**
 * The LookCamera shot for `b` from `azDeg`: the focus is the middle of the box, and `spanM` the
 * smallest patch (spanM wide, SHOT_DEPTH_RATIO of that deep, SHOT_HEIGHT_M tall: LookCamera's
 * fitShot) that holds the box's outline on the screen. LookCamera fits that patch to the free
 * area; KitCamera then zooms in until the subject itself, not the patch, fills KIT_FILL of it,
 * so a long thin board, a small key and a macro are all framed alike.
 */
export function shotFor(b: Bounds, azDeg: number, id: string): KitShot {
  const az = (azDeg * Math.PI) / 180;
  const el = (LOOK_ELEVATION_DEG * Math.PI) / 180;
  const s = Math.abs(Math.sin(az));
  const c = Math.abs(Math.cos(az));
  const { right, up } = screenExtents(b, azDeg, { right: 0, up: 0 });
  // fitShot's patch has half extents a·(c + k·s) and sin(el)·a·(s + k·c) + cos(el)·SHOT_HEIGHT_M.
  const aWide = right / (c + SHOT_DEPTH_RATIO * s);
  const aTall = Math.max(
    0,
    (up - Math.cos(el) * SHOT_HEIGHT_M) / (Math.sin(el) * (s + SHOT_DEPTH_RATIO * c)),
  );
  const a = Math.max(aWide, aTall, MIN_HALF_SPAN_M);
  return {
    id,
    focus: [(b.x0 + b.x1) / 2, b.h / 2, (b.z0 + b.z1) / 2],
    spanM: 2 * a,
    azimuthDeg: azDeg,
  };
}

// ---- The terminal dump -----------------------------------------------------------------------

export type TerminalDump = Record<TerminalId, [number, number, number] | null>;

/** Metres rounded to 0.1 mm, without a negative zero. */
const round4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;

/**
 * Every terminal's world position, in TERMINAL_IDS order, rounded to 0.1 mm; null for a terminal
 * that is not mounted. The regression baseline for hit targets (a part's restyle may not move a
 * nut by more than 2 mm).
 */
export function terminalPositions(registry: Pick<TerminalRegistry, "worldPosition">): TerminalDump {
  const v = new THREE.Vector3();
  const out = {} as TerminalDump;
  for (const id of TERMINAL_IDS) {
    out[id] = registry.worldPosition(id, v) ? [round4(v.x), round4(v.y), round4(v.z)] : null;
  }
  return out;
}
