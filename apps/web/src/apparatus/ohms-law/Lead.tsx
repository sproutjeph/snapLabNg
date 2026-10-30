import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { DIAGRAM_LEADS } from "@snaplab/engine";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTerminalRegistry } from "../../learn/terminals";
import type { LeadColour, OhmsLawVisualState, TerminalId } from "../../learn/types";
import { inkTag } from "../../scene/ink/ink";
import { acquireTexture, brassSurface, releaseTexture } from "../materials";
import type { QualityTier } from "../meter-bridge/types";
import {
  BENCH_FOOTPRINTS,
  type BenchFootprint,
  CABLE_SEAT_M,
  floorAt,
  hashString,
  jitterColour,
  LEAD_RADIUS_M,
  leadBulge,
  leadTexture,
  makePlugGeometries,
  PLUG_HEIGHT_M,
  PLUG_RADIUS_M,
  seeded,
} from "./LeadParts";
import { INK_IDS, LEAD_LANES, LEAD_REST, LEAD_REST_COUNT } from "./layout";

export interface LeadProps {
  from: TerminalId;
  /** The other terminal, or "pointer" for the rubber band while she picks the other end. */
  to: TerminalId | "pointer";
  colour: LeadColour;
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  /** Tap the lead to remove it. */
  onTap?: (pointerType?: string) => void;
  /** The pointer entered (true) or left (false) the lead's tap target. */
  onHover?: (on: boolean) => void;
  /** Read every frame: draw the whole lead highlighted (it is picked for removal). */
  highlight?: { readonly current: boolean };
  /**
   * How much of the lead is drawn, 0..1 (default 1). Pass a ref-like object and change its
   * `.current` in useFrame to animate without a React render per frame. On a bench with rest
   * places (a RestLeads layer is mounted, learn/stage/RestLeads.tsx) a lead that lay in one is
   * lifted from it to its terminals over this draw; otherwise the cable grows from the `from` plug
   * along its curve, and the far plug pops in as it arrives (Watch's draw-on).
   */
  drawn?: number | { current: number };
}

/**
 * A lead's sampled cable centreline, published so the current-flow dots can follow it. Points
 * run from the `from` plug to the `to` plug, xyz packed, in the Lead's parent space (the same
 * space as its siblings). `version` rises each time the points are rewritten. The cable is a tube
 * of LEAD_RADIUS_M round this line, so whatever rides on it (the dots) must stand out past that
 * radius, or the cable hides it.
 */
export interface LeadCurve {
  readonly points: Float32Array;
  /** Number of points (xyz triples) in `points`. */
  readonly count: number;
  version: number;
}

// ---- The bench's book of leads ------------------------------------------------------------------

/**
 * The rest places (layout.ts LEAD_REST) on one bench: which lead has been picked up from each, the
 * one in her hand, and when each was last put back. Lead writes it as leads come and go;
 * RestingLead reads it to hide a picked-up lead and fly a removed one home.
 */
export interface RestBook {
  /** RestLeads layers mounted on this bench. With none, leads draw on and nothing is lifted. */
  on: number;
  /** The lead id lifted from each slot, or null while it lies there. */
  taken: (string | null)[];
  /** A lifted lead's slot, and whether it flies from there (false: it came from her hand). */
  slotOf: Map<string, { slot: number; flies: boolean }>;
  /** The slot of the lead in her hand (the rubber band), or -1. */
  held: number;
  /** When each slot's lead was last let go (performance.now, seconds), and its two ends then. */
  backAtS: Float64Array;
  backA: (TerminalId | null)[];
  backB: (TerminalId | null)[];
  /** The last lead let go from her hand: a lead made from its nut soon after came from her hand. */
  hand: { slot: number; from: TerminalId | null; atS: number };
}

/**
 * Per visual-state ref (one bench): which mounted Lead draws which bench lead (by lead id), the
 * curve each publishes, and the rest places. A Lead's props carry only its two ends, so each
 * mounted Lead claims one unclaimed lead in `state.current.leads` with its ends (and colour, when
 * one matches); two parallel leads between the same nuts therefore publish under their own ids.
 */
interface LeadBook {
  owner: Map<string, object>;
  curve: Map<string, LeadCurve>;
  rest: RestBook;
}
const LEAD_BOOKS = new WeakMap<object, LeadBook>();

function newRestBook(): RestBook {
  return {
    on: 0,
    taken: Array.from({ length: LEAD_REST_COUNT }, () => null),
    slotOf: new Map(),
    held: -1,
    backAtS: new Float64Array(LEAD_REST_COUNT).fill(Number.NEGATIVE_INFINITY),
    backA: Array.from({ length: LEAD_REST_COUNT }, () => null),
    backB: Array.from({ length: LEAD_REST_COUNT }, () => null),
    hand: { slot: -1, from: null, atS: Number.NEGATIVE_INFINITY },
  };
}

function bookOf(state: object): LeadBook {
  let b = LEAD_BOOKS.get(state);
  if (!b) {
    b = { owner: new Map(), curve: new Map(), rest: newRestBook() };
    LEAD_BOOKS.set(state, b);
  }
  return b;
}

/** The rest places' book for this bench (learn/stage/RestLeads.tsx mounts and reads it). */
export function restBookOf(state: { current: OhmsLawVisualState }): RestBook {
  return bookOf(state).rest;
}

/** The cable of bench lead `leadId` (from lead.a to lead.b), or undefined while it is not drawn. */
export function getLeadCurve(
  state: { current: OhmsLawVisualState },
  leadId: string,
): LeadCurve | undefined {
  return LEAD_BOOKS.get(state)?.curve.get(leadId);
}

/** Seconds after her hand lets a lead go during which a lead made from its nut is that lead. */
const HAND_S = 1;
/**
 * How long a place her hand let go of stays empty, waiting for the lead she made from it. Short,
 * so a lead she drops still flies home (FLY_BACK_S) from her nut.
 */
const HAND_HOLD_S = 0.15;
const nowS = () => performance.now() / 1000;

/** A slot free for a new lead: nobody lifted it and it is not in her hand. */
function freeSlot(rest: RestBook, colour: LeadColour): number {
  let any = -1;
  for (let i = 0; i < LEAD_REST_COUNT; i++) {
    if (rest.taken[i] !== null || rest.held === i) continue;
    if (LEAD_REST[i]?.colour === colour) return i;
    if (any < 0) any = i;
  }
  return any;
}

/**
 * Lifts lead `l` from a rest place, once, as it appears: the place her hand just let go of if she
 * made it from that nut (it does not fly, she carried it), or else the first free place of its
 * colour, or any free place. With no rest places, or all of them lifted, it stays a drawn-on lead.
 */
export function takeRest(
  rest: RestBook,
  l: { id: string; a: TerminalId; b: TerminalId; colour: LeadColour },
  atS: number,
): void {
  if (rest.on <= 0 || rest.slotOf.has(l.id)) return;
  const h = rest.hand;
  let slot = -1;
  let flies = true;
  if (
    h.slot >= 0 &&
    atS - h.atS < HAND_S &&
    rest.taken[h.slot] === null &&
    (l.a === h.from || l.b === h.from)
  ) {
    slot = h.slot;
    flies = false;
    h.slot = -1;
  } else slot = freeSlot(rest, l.colour);
  if (slot < 0) return;
  rest.taken[slot] = l.id;
  rest.slotOf.set(l.id, { slot, flies });
}

/** Scratch for a lead that asks again for a rest place, so the per-frame retry allocates nothing. */
const _retry: { id: string; a: TerminalId; b: TerminalId; colour: LeadColour } = {
  id: "",
  a: "E+",
  b: "E-",
  colour: "red",
};

/** Puts lead `id` back in its rest place (it flies home from `a` and `b`, RestingLead). */
export function returnRest(
  rest: RestBook,
  id: string,
  a: TerminalId | null,
  b: TerminalId | null,
  atS: number,
): void {
  const info = rest.slotOf.get(id);
  if (!info) return;
  rest.slotOf.delete(id);
  if (rest.taken[info.slot] !== id) return;
  rest.taken[info.slot] = null;
  rest.backAtS[info.slot] = atS;
  rest.backA[info.slot] = a;
  rest.backB[info.slot] = b;
}

interface Claim {
  id: string | null;
  a: TerminalId | null;
  b: TerminalId | null;
}

/** Keeps `claim.id` on one bench lead with these ends (claimed by no other Lead). No allocation. */
function claimLead(
  book: LeadBook,
  leads: OhmsLawVisualState["leads"],
  claim: Claim,
  from: TerminalId,
  to: TerminalId,
  colour: LeadColour,
): void {
  if (claim.id !== null) {
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      if (l && l.id === claim.id && l.a === from && l.b === to) return;
    }
    releaseLead(book, claim);
  }
  for (let pass = 0; pass < 2 && claim.id === null; pass++) {
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      if (!l || l.a !== from || l.b !== to || book.owner.has(l.id)) continue;
      if (pass === 0 && l.colour !== colour) continue;
      claim.id = l.id;
      claim.a = l.a;
      claim.b = l.b;
      book.owner.set(l.id, claim);
      takeRest(book.rest, l, nowS());
      break;
    }
  }
}

function releaseLead(book: LeadBook, claim: Claim): void {
  if (claim.id === null) return;
  if (book.owner.get(claim.id) === claim) {
    book.owner.delete(claim.id);
    book.curve.delete(claim.id);
    returnRest(book.rest, claim.id, claim.a, claim.b, nowS());
  }
  claim.id = null;
}

/** The cable's ink weight: BC101 draws its rope at .55 (docs/plans/wave-2-lean.md, 2b additions). */
export const LEAD_INK_STRENGTH = 0.55;

/** Where along the lead the control points sit (0 = first plug, 1 = second). */
const CTRL_T = [0, 0.04, 0.12, 0.25, 0.4, 0.5, 0.6, 0.75, 0.88, 0.96, 1] as const;
/** The lowest the cable's centre goes: it lies on the desk. */
const FLOOR_Y = LEAD_RADIUS_M + 0.0004;
/** How far the pointer's plug floats above the bench point while she carries it. */
const CARRY_LIFT_M = 0.022;
const HIT_RADIUS_M = 0.007;
/** The tap target is at least this many CSS px across, so a thin cable is easy to hit on a phone. */
export const LEAD_HIT_PX = 32;
/** …but never fatter than this, metres, so it does not reach over the nuts beside it. */
export const LEAD_HIT_MAX_M = 0.02;
/** The highlight of a lead picked for removal: the look's warm accent, as an emissive glow. */
const LEAD_LIT = new THREE.Color("#e0662a");
const LEAD_UNLIT = new THREE.Color(0, 0, 0);
/** The ink dot where the cable leaves each plug's boot: the page's ink (--ink, styles/tokens.css). */
const INK_DOT_COLOUR = "#1d2430";
/** The dot is a bead a little fatter than the cable, at the neck of the boot. */
export const INK_DOT_RADIUS_M = LEAD_RADIUS_M * 1.25;
export const INK_DOT_Y_M = PLUG_HEIGHT_M - 0.0018;
/** How high a lead is lifted at the middle of its way between the rest place and the nuts. */
export const LIFT_ARC_M = 0.07;
/** How far from its nut her pointer must carry the rubber band before it counts as in her hand. */
const BAND_CARRIED_M = 0.09;
/** A removed lead's way home to its rest place, seconds. */
export const FLY_BACK_S = 0.45;

/** The tap tube's radius at `metresPerPx` (rounded to half a millimetre, so it rebuilds rarely). */
export function leadHitRadius(metresPerPx: number): number {
  const r = Math.min(LEAD_HIT_MAX_M, Math.max(HIT_RADIUS_M, (LEAD_HIT_PX / 2) * metresPerPx));
  return Math.round(r * 2000) / 2000;
}

/**
 * The share of a lead (curve parameter, 0 at `from`) its tap tube covers: the middle, leaving
 * each end to its nut, which takes its own taps.
 */
export function leadHitRange(spanM: number): readonly [number, number] {
  const t0 = Math.min(0.4, Math.max(0.14, 0.05 / Math.max(spanM, 0.05)));
  return [t0, 1 - t0];
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _la = new THREE.Vector3();
const _lb = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _cam = new THREE.Vector3();
/** Marks a lead's tap tube, so the nuts' big targets let a tap through to it. */
export const LEAD_HIT_DATA = { leadHit: true } as const;

/** Lifts a sampled world point onto whatever it would sink into (a part's top, or the desk). */
function restOnBench(p: THREE.Vector3, ramp?: number): void {
  const y = floorAt(p.x, p.z, ramp) + LEAD_RADIUS_M;
  if (p.y < y) p.y = y;
}
const _tan = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _nrm = new THREE.Vector3();
const _bin = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _upY = new THREE.Vector3(0, 1, 0);
const _upX = new THREE.Vector3(1, 0, 0);

/** One tile of the cable's speckle skin along its length, in metres. */
const SKIN_TILE_M = 0.05;

/**
 * Writes a tube of `radius` around the polyline `c` (n + 1 points, xyz packed) into a
 * TubeGeometry's own buffers, with a parallel-transported frame (the same idea as the metre
 * bridge's TubeWire). The uv runs along the cable in metres (SKIN_TILE_M a tile) and once round,
 * so the speckle keeps its size whatever the cable's length. Allocation-free, so it runs on the
 * frame the ends move.
 */
function writeTube(
  geo: THREE.TubeGeometry,
  c: Float32Array,
  n: number,
  radial: number,
  radius: number,
): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const stride = radial + 1;
  let along = 0;
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      along += Math.hypot(
        (c[i * 3] ?? 0) - (c[i * 3 - 3] ?? 0),
        (c[i * 3 + 1] ?? 0) - (c[i * 3 - 2] ?? 0),
        (c[i * 3 + 2] ?? 0) - (c[i * 3 - 1] ?? 0),
      );
    }
    const i0 = Math.max(0, i - 1) * 3;
    const i1 = Math.min(n, i + 1) * 3;
    _tan
      .set(
        (c[i1] ?? 0) - (c[i0] ?? 0),
        (c[i1 + 1] ?? 0) - (c[i0 + 1] ?? 0),
        (c[i1 + 2] ?? 0) - (c[i0 + 2] ?? 0),
      )
      .normalize();
    if (i === 0) {
      const ref = Math.abs(_tan.y) < 0.9 ? _upY : _upX;
      _bin.crossVectors(_tan, ref).normalize();
      _nrm.crossVectors(_bin, _tan).normalize();
    } else {
      _axis.crossVectors(_prev, _tan);
      if (_axis.lengthSq() > 1e-10) {
        _axis.normalize();
        _nrm.applyAxisAngle(_axis, Math.acos(Math.max(-1, Math.min(1, _prev.dot(_tan)))));
      }
      _nrm.addScaledVector(_tan, -_nrm.dot(_tan)).normalize();
      _bin.crossVectors(_tan, _nrm).normalize();
    }
    _prev.copy(_tan);
    const cx = c[i * 3] ?? 0;
    const cy = c[i * 3 + 1] ?? 0;
    const cz = c[i * 3 + 2] ?? 0;
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const u = -Math.cos(ang);
      const v = Math.sin(ang);
      const nx = u * _nrm.x + v * _bin.x;
      const ny = u * _nrm.y + v * _bin.y;
      const nz = u * _nrm.z + v * _bin.z;
      const k = i * stride + j;
      pos.setXYZ(k, cx + radius * nx, cy + radius * ny, cz + radius * nz);
      nor.setXYZ(k, nx, ny, nz);
      uv.setXY(k, along / SKIN_TILE_M, j / radial);
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeBoundingSphere();
}

/**
 * Sets the curve's control points: a drooping cable from seat `s` to seat `e`. A seat is where
 * the cable's centreline starts, CABLE_SEAT_M above a plug's foot: inside its boot, a little
 * below the plug's top. Exported so the kit's tests use this path, not a copy of it; its shape is
 * frozen with them.
 */
export function shapeCable(
  pts: THREE.Vector3[],
  s: THREE.Vector3,
  e: THREE.Vector3,
  bulge: number,
): void {
  const dx = e.x - s.x;
  const dz = e.z - s.z;
  const d = Math.hypot(dx, dz);
  const nx = d > 1e-5 ? -dz / d : 0;
  const nz = d > 1e-5 ? dx / d : 1;
  // A flexible cable hangs by about a third of its span, but never below the desk.
  const droop = 0.012 + 0.3 * d;
  const side = bulge * Math.min(d, 0.5) * 0.22;
  for (let i = 0; i < CTRL_T.length; i++) {
    const t = CTRL_T[i] ?? 0;
    const belly = 4 * t * (1 - t);
    // The ends leave the plugs a little stiffly before they droop.
    // (zero at the plug itself, so the cable meets it, rising to about a centimetre by t = 0.04).
    const u = Math.min(t, 1 - t) * 26;
    const stiff = 0.03 * u * Math.exp(-u);
    const p = pts[i];
    if (!p) continue;
    p.set(
      s.x + dx * t + nx * side * belly,
      Math.max(FLOOR_Y, s.y + (e.y - s.y) * t - droop * belly + stiff),
      s.z + dz * t + nz * side * belly,
    );
  }
}

// ---- Routed leads (layout v4) -------------------------------------------------------------------
// The diagram's seven leads have fixed ways across the bench (layout.ts): the loop's neighbours
// (cells + to the key, the key to ammeter +, ammeter − to the box) droop straight across, as
// shapeCable lays them; R2–X and Y–E− run back from the series row and along the lane in front of
// the board; V+–X and V−–Y come to the board from behind, on two lanes, V+ first tucked between
// the voltmeter's − nut and its case. A routed lead lies on the desk between its ends, so it never
// crosses a part or another lead (layout.test.ts). Any other lead she makes droops straight across,
// over whatever is in its way (a meter's case top included), never round a meter's side.

/** Control points of a routed lead's curve. */
export const ROUTE_POINTS = 26;
/** Most waypoints a route has between its two seats (with an exit stub at each end). */
const MAX_WAYPOINTS = 10;
/** How far the cable leaves its seat level before it turns down to the desk, metres. */
const EXIT_STUB_M = 0.012;
/** The voltmeter's + lead tucks this far behind its nuts, between them and the case. */
export const TUCK_BEHIND_M = 0.016;
/** Its centre on the ledge: the ledge's top (Meter.tsx LEDGE.h) plus the cable's radius. */
const LEDGE_LANE_Y = 0.012 + LEAD_RADIUS_M + 0.0003;
/** A meter's nuts stand ±3.5 cm from its middle; its ledge is 6 cm either side. */
const METER_NUT_X = 0.035;
const METER_HALF_W = 0.06;

/** Lane ends closer than this (x, metres) merge into one point: the lead just crosses the lane. */
const LANE_MERGE_M = 0.05;

/** The routed pairs, each from its canonical first end. */
const ROUTES: ReadonlyArray<readonly [TerminalId, TerminalId]> = [
  ["R2", "X"],
  ["E-", "Y"],
  ["V+", "X"],
  ["V-", "Y"],
];

/** Writes waypoint `n` (xyz) into `out`; returns the next index. */
function putPoint(out: Float64Array, n: number, x: number, y: number, z: number): number {
  out[n * 3] = x;
  out[n * 3 + 1] = y;
  out[n * 3 + 2] = z;
  return n + 1;
}

/**
 * Along a lane at `z` from x0 to x1, on the desk; when the two are nearly level the lead simply
 * crosses the lane. Returns the next index.
 */
function putLane(out: Float64Array, n: number, x0: number, x1: number, z: number): number {
  if (Math.abs(x1 - x0) < LANE_MERGE_M) return putPoint(out, n, (x0 + x1) / 2, Number.NaN, z);
  return putPoint(out, putPoint(out, n, x0, Number.NaN, z), x1, Number.NaN, z);
}

/**
 * Writes the waypoints between a lead's two seats (xyz; y NaN means on the desk) into `out` and
 * returns how many, or 0 for a lead that simply droops (shapeCable). `s` and `e` are the seats of
 * `from` and `to`. Allocates nothing.
 */
export function leadWaypoints(
  from: TerminalId,
  to: TerminalId,
  s: { x: number; y: number; z: number },
  e: { x: number; y: number; z: number },
  out: Float64Array,
): number {
  let r = -1;
  let flip = false;
  for (let i = 0; i < ROUTES.length; i++) {
    const pair = ROUTES[i];
    if (!pair) continue;
    if (pair[0] === from && pair[1] === to) r = i;
    else if (pair[0] === to && pair[1] === from) {
      r = i;
      flip = true;
    }
  }
  if (r < 0) return 0;
  const p = flip ? e : s;
  const q = flip ? s : e;
  let n = 0;
  const F = Number.NaN;
  if (r === 0 || r === 1) {
    // R2–X, E−–Y: straight back from the row's end, along the lane, then onto the board.
    n = putLane(out, n, p.x, q.x, LEAD_LANES.front);
  } else if (r === 3) {
    // V−–Y: forward off the ledge to the lane behind the board, along it, onto the board.
    n = putLane(out, n, p.x, q.x, LEAD_LANES.backNear);
  } else {
    // V+–X: back at the seat's height, down behind its own plug, along the ledge behind V−'s nut,
    // off the ledge's left end, forward to its lane (behind V−'s) and along it to X.
    const mid = p.x - METER_NUT_X;
    const tz = p.z - TUCK_BEHIND_M;
    n = putPoint(out, n, p.x, p.y + 0.004, tz);
    n = putPoint(out, n, p.x - 0.012, LEDGE_LANE_Y, tz);
    n = putPoint(out, n, mid - METER_NUT_X - 0.014, LEDGE_LANE_Y, tz);
    n = putPoint(out, n, mid - METER_HALF_W - 0.01, F, tz + 0.006);
    n = putLane(out, n, mid - METER_HALF_W - 0.015, q.x, LEAD_LANES.backFar);
  }
  if (flip) {
    for (let i = 0; i < n / 2 - 0.5; i++) {
      const j = n - 1 - i;
      for (let k = 0; k < 3; k++) {
        const t = out[i * 3 + k] ?? 0;
        out[i * 3 + k] = out[j * 3 + k] ?? 0;
        out[j * 3 + k] = t;
      }
    }
  }
  return n;
}

const _poly = new Float64Array((MAX_WAYPOINTS + 4) * 3);
const _way = new Float64Array(MAX_WAYPOINTS * 3);
const _seg = new Float64Array(MAX_WAYPOINTS + 4);
const _extra = new Int32Array(MAX_WAYPOINTS + 4);

/**
 * Spreads `n` points (n >= the polyline's corners) along the polyline `poly` (k corners, xyz),
 * keeping every corner and filling each leg with points in proportion to its length. Writes `out`.
 */
function spread(poly: Float64Array, k: number, out: THREE.Vector3[], n: number): void {
  let total = 0;
  for (let i = 0; i < k - 1; i++) {
    const d = Math.hypot(
      (poly[i * 3 + 3] ?? 0) - (poly[i * 3] ?? 0),
      (poly[i * 3 + 4] ?? 0) - (poly[i * 3 + 1] ?? 0),
      (poly[i * 3 + 5] ?? 0) - (poly[i * 3 + 2] ?? 0),
    );
    _seg[i] = d;
    total += d;
  }
  const spare = n - k;
  let given = 0;
  for (let i = 0; i < k - 1; i++) {
    const m = total > 0 ? Math.floor((spare * (_seg[i] ?? 0)) / total) : 0;
    _extra[i] = m;
    given += m;
  }
  // The points left over go to the longest legs, one each.
  while (given < spare) {
    let best = 0;
    let bestLen = -1;
    for (let i = 0; i < k - 1; i++) {
      const per = (_seg[i] ?? 0) / ((_extra[i] ?? 0) + 1);
      if (per > bestLen) {
        bestLen = per;
        best = i;
      }
    }
    _extra[best] = (_extra[best] ?? 0) + 1;
    given++;
  }
  let o = 0;
  for (let i = 0; i < k; i++) {
    out[o++]?.set(poly[i * 3] ?? 0, poly[i * 3 + 1] ?? 0, poly[i * 3 + 2] ?? 0);
    if (i === k - 1) break;
    const m = _extra[i] ?? 0;
    for (let j = 1; j <= m; j++) {
      const t = j / (m + 1);
      out[o++]?.set(
        (poly[i * 3] ?? 0) + ((poly[i * 3 + 3] ?? 0) - (poly[i * 3] ?? 0)) * t,
        (poly[i * 3 + 1] ?? 0) + ((poly[i * 3 + 4] ?? 0) - (poly[i * 3 + 1] ?? 0)) * t,
        (poly[i * 3 + 2] ?? 0) + ((poly[i * 3 + 5] ?? 0) - (poly[i * 3 + 2] ?? 0)) * t,
      );
    }
  }
}

/** Writes a polyline corner into _poly at index i. */
function corner(i: number, x: number, y: number, z: number): void {
  _poly[i * 3] = x;
  _poly[i * 3 + 1] = y;
  _poly[i * 3 + 2] = z;
}

/**
 * A short stiff exit at corner `k`: EXIT_STUB_M from seat `seat` toward the desk point (wx, wz),
 * at the seat's height. Skipped when that point is too near. Returns the next corner index.
 */
function stubCorner(k: number, seat: THREE.Vector3, wx: number, wz: number): number {
  const dx = wx - seat.x;
  const dz = wz - seat.z;
  const d = Math.hypot(dx, dz);
  if (d < EXIT_STUB_M * 2) return k;
  corner(k, seat.x + (dx / d) * EXIT_STUB_M, seat.y + 0.003, seat.z + (dz / d) * EXIT_STUB_M);
  return k + 1;
}

/** Whether a lead from `a` to `b` (either way round) is one of the diagram's. */
function isDiagramLead(a: TerminalId, b: TerminalId): boolean {
  for (let i = 0; i < DIAGRAM_LEADS.length; i++) {
    const l = DIAGRAM_LEADS[i];
    if (l && ((l[0] === a && l[1] === b) || (l[0] === b && l[1] === a))) return true;
  }
  return false;
}

/**
 * A routed lead's ROUTE_POINTS control points from seat `s` (of `from`) to seat `e` (of `to`):
 * each seat, a short stiff exit at its height, the route's waypoints on the desk (or where the
 * route puts them), filled in along each leg. Returns false (and writes nothing) for a lead with
 * no route. Allocates nothing.
 */
export function routeControl(
  out: THREE.Vector3[],
  from: TerminalId,
  to: TerminalId,
  s: THREE.Vector3,
  e: THREE.Vector3,
): boolean {
  const n = leadWaypoints(from, to, s, e, _way);
  if (n === 0) return false;
  let k = 0;
  corner(k++, s.x, s.y, s.z);
  const w0y = _way[1] ?? 0;
  if (Number.isNaN(w0y)) k = stubCorner(k, s, _way[0] ?? 0, _way[2] ?? 0);
  for (let i = 0; i < n; i++) {
    const y = _way[i * 3 + 1] ?? 0;
    corner(k++, _way[i * 3] ?? 0, Number.isNaN(y) ? FLOOR_Y : y, _way[i * 3 + 2] ?? 0);
  }
  const wly = _way[(n - 1) * 3 + 1] ?? 0;
  if (Number.isNaN(wly)) {
    // The stub before `e`, measured from e toward the last waypoint: it falls between them.
    k = stubCorner(k, e, _way[(n - 1) * 3] ?? 0, _way[(n - 1) * 3 + 2] ?? 0);
  }
  corner(k++, e.x, e.y, e.z);
  spread(_poly, k, out, ROUTE_POINTS);
  return true;
}

/**
 * The curve's control points for the lead from `from` to `to` (seats `s`, `e`): its route, or a
 * plain droop. Writes `routed` (ROUTE_POINTS) and returns true for a routed lead; writes `plain`
 * (CTRL_T's 11) and returns false otherwise. A plain droop that would cross a meter's case lies
 * over its top (restOnBench), never down its side.
 */
export function routeCable(
  routed: THREE.Vector3[],
  plain: THREE.Vector3[],
  from: TerminalId,
  to: TerminalId,
  s: THREE.Vector3,
  e: THREE.Vector3,
  bulge: number,
): boolean {
  if (routeControl(routed, from, to, s, e)) return true;
  // The loop's neighbours (cells to key, key to ammeter, ammeter to box) bow toward her, away from
  // the ammeter's case behind its nuts; any other lead bows the way its hash says.
  const neighbours = isDiagramLead(from, to);
  const toHer = Math.sign(e.x - s.x) || 1;
  shapeCable(plain, s, e, neighbours ? Math.abs(bulge) * toHer : bulge);
  return false;
}

/** The meters' cases: the tall footprints (the ledges are 1.2 cm high). */
export const METER_CASES: readonly BenchFootprint[] = BENCH_FOOTPRINTS.filter(
  (f) => (f.slot === "ammeter" || f.slot === "voltmeter") && f.top > 0.05,
);

// ---- Rest places ----------------------------------------------------------------------------

const _restQA = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const _restQB = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _qI = new THREE.Quaternion();

/**
 * A lead lying in rest place `slot`: its two plugs on their sides at the ends, pins outward (the
 * `from` plug at the back), and the cable between them in a shallow S on the desk. Writes the
 * plugs' feet and turns and ROUTE_POINTS control points.
 */
export function restPose(
  slot: number,
  footA: THREE.Vector3,
  qA: THREE.Quaternion,
  footB: THREE.Vector3,
  qB: THREE.Quaternion,
  out: THREE.Vector3[],
): void {
  const r = LEAD_REST[slot] ?? LEAD_REST[0];
  if (!r) return;
  // Lying down, a plug's axis is its radius above the desk.
  const y = PLUG_RADIUS_M;
  footA.set(r.x, y, r.z0);
  footB.set(r.x, y, r.z1);
  qA.copy(_restQA);
  qB.copy(_restQB);
  let k = 0;
  corner(k++, r.x, y, r.z0 + CABLE_SEAT_M);
  corner(k++, r.x + 0.004, FLOOR_Y, r.z0 + CABLE_SEAT_M + 0.025);
  corner(k++, r.x + 0.007, FLOOR_Y, (r.z0 + r.z1) / 2 - 0.02);
  corner(k++, r.x - 0.007, FLOOR_Y, (r.z0 + r.z1) / 2 + 0.02);
  corner(k++, r.x - 0.004, FLOOR_Y, r.z1 - CABLE_SEAT_M - 0.025);
  corner(k++, r.x, y, r.z1 - CABLE_SEAT_M);
  spread(_poly, k, out, ROUTE_POINTS);
}

/** Spreads the 11 points of a plain droop to ROUTE_POINTS (for a lead flying to or from rest). */
function plainToRoute(plain: THREE.Vector3[], out: THREE.Vector3[]): void {
  let k = 0;
  for (const p of plain) corner(k++, p.x, p.y, p.z);
  spread(_poly, k, out, ROUTE_POINTS);
}

const _seatOff = new THREE.Vector3();

/**
 * Between the rest place (`e` = 0) and the nuts (`e` = 1): each plug moves and turns upright along
 * an arc LIFT_ARC_M high at its middle, and the cable follows, its ends at the plugs' seats.
 * Writes `outPts`, the plugs' feet (`fa`, `fb`) and turns (`qa`, `qb`), from the rest pose
 * (`restPts`, `ra`, `rqa`, `rb`, `rqb`) and the connected one (`pts`, `ta`, `tb`).
 */
export function flyPose(
  e: number,
  restPts: readonly THREE.Vector3[],
  ra: THREE.Vector3,
  rqa: THREE.Quaternion,
  rb: THREE.Vector3,
  rqb: THREE.Quaternion,
  pts: readonly THREE.Vector3[],
  ta: THREE.Vector3,
  tb: THREE.Vector3,
  outPts: THREE.Vector3[],
  fa: THREE.Vector3,
  qa: THREE.Quaternion,
  fb: THREE.Vector3,
  qb: THREE.Quaternion,
): void {
  const k = Math.max(0, Math.min(1, e));
  const lift = LIFT_ARC_M * Math.sin(Math.PI * k);
  fa.lerpVectors(ra, ta, k);
  fa.y += lift;
  fb.lerpVectors(rb, tb, k);
  fb.y += lift;
  qa.slerpQuaternions(rqa, _qI, k);
  qb.slerpQuaternions(rqb, _qI, k);
  for (let i = 0; i < outPts.length; i++) {
    const o = outPts[i];
    const r = restPts[i];
    const p = pts[i];
    if (!o || !r || !p) continue;
    o.lerpVectors(r, p, k);
    o.y += lift;
  }
  const first = outPts[0];
  const last = outPts[outPts.length - 1];
  first?.copy(fa).add(_seatOff.set(0, CABLE_SEAT_M, 0).applyQuaternion(qa));
  last?.copy(fb).add(_seatOff.set(0, CABLE_SEAT_M, 0).applyQuaternion(qb));
}

// ---- The meshes ------------------------------------------------------------------------------

/** One lead's geometry, materials and curves, made once per lead (and colour and tier). */
function useLeadResources(seedKey: string, colour: LeadColour, quality: QualityTier) {
  const res = useMemo(() => {
    const low = quality === "low";
    const rng = seeded(hashString(seedKey));
    const mainN = low ? 28 : 56;
    const radial = low ? 6 : quality === "mid" ? 10 : 12;
    const hitN = low ? 10 : 18;
    const pts = CTRL_T.map((t) => new THREE.Vector3(t, 0, 0));
    const routePts = Array.from({ length: ROUTE_POINTS }, (_, i) => new THREE.Vector3(i, 0, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const routeCurve = new THREE.CatmullRomCurve3(routePts, false, "centripetal");
    const tube = new THREE.TubeGeometry(curve, mainN, LEAD_RADIUS_M, radial, false);
    const hit = new THREE.TubeGeometry(curve, hitN, HIT_RADIUS_M, 5, false);
    const plug = makePlugGeometries(quality);
    // The speckled rubber skin is one texture per colour, shared by every lead of that colour.
    // The material's colour only tints it a hair, per lead, so no two leads are quite alike.
    const skin = acquireTexture(`lead-skin:${colour}:${quality}`, () =>
      leadTexture(colour, quality),
    );
    const cableMat = new THREE.MeshStandardMaterial({
      map: skin,
      color: jitterColour("#f6f6f6", rng, 0.05),
      roughness: 0.9,
    });
    const plugMat = new THREE.MeshStandardMaterial({
      map: skin,
      color: jitterColour("#f6f6f6", rng, 0.05),
      roughness: 0.86,
    });
    // The pin's brass: the kit's own, warm and a little rough.
    const pinMat = brassSurface(hashString(`pin-${seedKey}`));
    const hitMat = new THREE.MeshBasicMaterial();
    const dot = new THREE.SphereGeometry(INK_DOT_RADIUS_M, low ? 8 : 12, low ? 6 : 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: INK_DOT_COLOUR, toneMapped: false });
    return {
      curve,
      routeCurve,
      pts,
      routePts,
      /** Scratch for flights: the rest pose's and the connected pose's control points. */
      restPts: Array.from({ length: ROUTE_POINTS }, () => new THREE.Vector3()),
      toPts: Array.from({ length: ROUTE_POINTS }, () => new THREE.Vector3()),
      tube,
      hit,
      mainN,
      hitN,
      radial,
      plug,
      skin,
      cableMat,
      plugMat,
      pinMat,
      hitMat,
      dot,
      dotMat,
      main: new Float32Array((mainN + 1) * 3),
      mid: new Float32Array((hitN + 1) * 3),
      last: new Float32Array(12).fill(Number.NaN),
      lit: false,
      ink: -1,
      s: new THREE.Vector3(),
      e: new THREE.Vector3(),
      ra: new THREE.Vector3(),
      rb: new THREE.Vector3(),
      rqa: new THREE.Quaternion(),
      rqb: new THREE.Quaternion(),
      fa: new THREE.Vector3(),
      fb: new THREE.Vector3(),
      qa: new THREE.Quaternion(),
      qb: new THREE.Quaternion(),
    };
  }, [seedKey, colour, quality]);
  useEffect(
    () => () => {
      res.tube.dispose();
      res.hit.dispose();
      res.plug.body.dispose();
      res.plug.pin.dispose();
      res.cableMat.dispose();
      res.plugMat.dispose();
      res.pinMat.dispose();
      res.hitMat.dispose();
      res.dot.dispose();
      res.dotMat.dispose();
      releaseTexture(res.skin);
    },
    [res],
  );
  return res;
}

type LeadRes = ReturnType<typeof useLeadResources>;

/** Samples `curve` (to `upto` of its length) onto the bench into res.main and writes the tube. */
function writeCable(
  res: LeadRes,
  curve: THREE.Curve<THREE.Vector3>,
  upto: number,
  ramp?: number,
): void {
  for (let i = 0; i <= res.mainN; i++) {
    curve.getPoint((i / res.mainN) * upto, _pt);
    restOnBench(_pt, ramp);
    _pt.applyMatrix4(_inv);
    res.main[i * 3] = _pt.x;
    res.main[i * 3 + 1] = _pt.y;
    res.main[i * 3 + 2] = _pt.z;
  }
  writeTube(res.tube, res.main, res.mainN, res.radial, LEAD_RADIUS_M);
}

/** Ink ids: the sleeve and cable share one; the brass pins take another, ten along. */
function tagInk(
  ink: number,
  groups: Array<{ current: THREE.Group | null }>,
  pins: Array<{ current: THREE.Group | null }>,
  tagged: { current: THREE.Group | null },
): void {
  const pinInk = INK_IDS.leadBase + ((ink - INK_IDS.leadBase + 10) % 20);
  for (const p of pins) if (p.current) inkTag(p.current, { id: pinInk, thin: true });
  for (const g of groups) if (g.current) inkTag(g.current, { id: ink, thin: true });
  // The cable is a soft line, like BC101's rope (.55): the plugs keep their full ink.
  const cableMesh = tagged.current?.children[0];
  if (cableMesh) cableMesh.userData.inkStrength = LEAD_INK_STRENGTH;
}

/** The ink dots are solid ink already: the ink pass leaves them alone. */
const NO_INK = { noInk: true } as const;

function PlugMeshes({
  res,
  plug,
  pins,
}: {
  res: LeadRes;
  plug: RefObject<THREE.Group | null>;
  pins: RefObject<THREE.Group | null>;
}) {
  return (
    <group ref={plug}>
      <mesh geometry={res.plug.body} material={res.plugMat} castShadow />
      <group ref={pins}>
        <mesh geometry={res.plug.pin} material={res.pinMat} castShadow />
      </group>
      <mesh
        geometry={res.dot}
        material={res.dotMat}
        position={[0, INK_DOT_Y_M, 0]}
        userData={NO_INK}
      />
    </group>
  );
}

/**
 * An insulated flexible lead with a banana plug at each end, between two terminals (a tube on a
 * Catmull-Rom curve). Both ends' world positions are read from the registry every frame; the tube
 * is rebuilt in place only on a frame where an end moved. With `to = "pointer"` the free end
 * follows `state.current.pointer`. A diagram lead takes its route (leadRoute: it lies on the desk
 * and crosses nothing); any other droops straight across. The cable is worked out in world space,
 * rests on the bench parts' footprints (`floorAt`), and stacks its plugs on any earlier leads at
 * the same nut. A fatter invisible tube along the middle takes the tap. A dark ink dot marks
 * where the cable leaves each plug.
 */
export function Lead({
  from,
  to,
  colour,
  state,
  quality,
  onTap,
  onHover,
  highlight,
  drawn = 1,
}: LeadProps) {
  const registry = useTerminalRegistry();
  const root = useRef<THREE.Group>(null);
  const plugA = useRef<THREE.Group>(null);
  const plugB = useRef<THREE.Group>(null);
  const pinsA = useRef<THREE.Group>(null);
  const pinsB = useRef<THREE.Group>(null);
  const tagged = useRef<THREE.Group>(null);
  const plugs = useRef<THREE.Group>(null);
  const hitMesh = useRef<THREE.Mesh>(null);

  const res = useLeadResources(`lead-${from}-${to}-${colour}`, colour, quality);
  // A stable, hash-chosen sideways bulge, so two leads between the same neighbours part. It has
  // its own stream, so it does not move with the colour draws (see leadBulge).
  const bulge = useMemo(() => leadBulge(from, to, colour), [from, to, colour]);
  const curve = useMemo<LeadCurve>(
    () => ({ points: res.main, count: res.mainN + 1, version: 0 }),
    [res],
  );
  const claim = useMemo<Claim>(() => ({ id: null, a: null, b: null }), []);
  useEffect(() => () => releaseLead(bookOf(state), claim), [state, claim]);
  // The rubber band is the lead in her hand: once she carries it (its free end more than
  // BAND_CARRIED_M from its nut) it holds a rest place, and lets it go when she makes the lead (which
  // then takes that place without flying) or drops it (it flies home). A band never carried (a tap
  // on each nut, as Watch's actor and a phone make leads) holds none: its lead flies from rest.
  const band = useRef(-1);
  useEffect(() => {
    if (to !== "pointer") return;
    return () => {
      const rest = bookOf(state).rest;
      const slot = band.current;
      band.current = -1;
      if (slot < 0 || rest.held !== slot) return;
      rest.held = -1;
      const t = nowS();
      rest.hand.slot = slot;
      rest.hand.from = from;
      rest.hand.atS = t;
      rest.backAtS[slot] = t;
      rest.backA[slot] = from;
      rest.backB[slot] = from;
    };
  }, [state, to, from]);

  useFrame((st) => {
    const g = root.current;
    if (!g) return;
    const hit = hitMesh.current;
    const dRaw = typeof drawn === "number" ? drawn : drawn.current;
    const d01 = Number.isFinite(dRaw) ? Math.max(0, Math.min(dRaw, 1)) : 1;
    const lit = highlight?.current === true;
    if (lit !== res.lit) {
      res.lit = lit;
      const c = lit ? LEAD_LIT : LEAD_UNLIT;
      res.cableMat.emissive.copy(c);
      res.plugMat.emissive.copy(c);
      res.cableMat.emissiveIntensity = lit ? 0.55 : 1;
      res.plugMat.emissiveIntensity = lit ? 0.55 : 1;
    }
    // Metres per CSS px on the bench (orthographic shot, or the close-up's perspective), for a
    // tap tube a finger can find (TerminalNut sizes its target the same way).
    const m5 = Math.max(1e-6, Math.abs(st.camera.projectionMatrix.elements[5] ?? 1));
    let worldH = 2 / m5;
    if (!(st.camera as THREE.OrthographicCamera).isOrthographicCamera) {
      worldH *= Math.max(0.05, st.camera.getWorldPosition(_cam).distanceTo(_a.set(0, 0, 0)));
    }
    const hitR = leadHitRadius(worldH / Math.max(1, st.size.height));
    const okA = registry.worldPosition(from, _a);
    let okB = true;
    if (to === "pointer") {
      _b.copy(state.current.pointer);
      _b.y += CARRY_LIFT_M;
    } else okB = registry.worldPosition(to, _b);
    const ok = okA && okB;
    g.visible = ok;
    const book = bookOf(state);
    let fly = -1;
    if (to !== "pointer") {
      claimLead(book, state.current.leads, claim, from, to, colour);
      if (claim.id !== null) {
        if (ok && book.curve.get(claim.id) !== curve) book.curve.set(claim.id, curve);
        else if (!ok && book.curve.get(claim.id) === curve) book.curve.delete(claim.id);
        // A lead that found every rest place lifted takes the first one put back.
        if (book.rest.on > 0 && !book.rest.slotOf.has(claim.id) && claim.a && claim.b) {
          _retry.id = claim.id;
          _retry.a = claim.a;
          _retry.b = claim.b;
          _retry.colour = colour;
          takeRest(book.rest, _retry, nowS());
        }
        const info = book.rest.on > 0 ? book.rest.slotOf.get(claim.id) : undefined;
        if (info?.flies && d01 < 1) fly = info.slot;
      }
    } else if (book.rest.on > 0 && band.current < 0 && book.rest.held < 0) {
      // The band starts 6 cm toward her from its nut (wiring/BenchWiring.tsx); carried past this,
      // it is in her hand.
      const p = state.current.pointer;
      if (okA && Math.hypot(p.x - _a.x, p.z - _a.z) > BAND_CARRIED_M) {
        const slot = freeSlot(book.rest, colour);
        if (slot >= 0) {
          book.rest.held = slot;
          band.current = slot;
        }
      }
    }
    // A missing end must not leave a stale tap tube behind.
    if (hit) {
      const k = ok && d01 >= 0.999 ? 1 : 0;
      if (hit.scale.x !== k) hit.scale.setScalar(k);
    }
    if (!ok) return;

    // This lead's place among the bench's leads: its ink id, and how many earlier leads share
    // each terminal (their plugs are already in the nut, so this one stacks on top).
    const leads = state.current.leads;
    let mine = -1;
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      if (l && ((l.a === from && l.b === to) || (l.a === to && l.b === from))) {
        mine = i;
        break;
      }
    }
    const upto = mine >= 0 ? mine : leads.length;
    let ka = 0;
    let kb = 0;
    for (let i = 0; i < upto; i++) {
      const l = leads[i];
      if (!l) continue;
      if (l.a === from || l.b === from) ka++;
      if (to !== "pointer" && (l.a === to || l.b === to)) kb++;
    }
    const ink = INK_IDS.leadBase + (upto % 20);
    if (ink !== res.ink) {
      res.ink = ink;
      tagInk(ink, [plugs, tagged], [pinsA, pinsB], tagged);
    }

    const liftA = ka * PLUG_HEIGHT_M * 0.85;
    const liftB = kb * PLUG_HEIGHT_M * 0.85;
    const l = res.last;
    if (
      l[0] === _a.x &&
      l[1] === _a.y &&
      l[2] === _a.z &&
      l[3] === _b.x &&
      l[4] === _b.y &&
      l[5] === _b.z &&
      l[6] === liftA &&
      l[7] === liftB &&
      l[8] === d01 &&
      l[9] === hitR &&
      l[10] === fly
    ) {
      return;
    }
    l[0] = _a.x;
    l[1] = _a.y;
    l[2] = _a.z;
    l[3] = _b.x;
    l[4] = _b.y;
    l[5] = _b.z;
    l[6] = liftA;
    l[7] = liftB;
    l[8] = d01;
    l[9] = hitR;
    l[10] = fly;

    // Everything is worked out in world space (the footprints are world boxes), then moved
    // into the parent's space, so a transformed parent cannot break the lead.
    const par = g.parent;
    if (par) _inv.copy(par.matrixWorld).invert();
    else _inv.identity();
    _a.y += liftA;
    _b.y += liftB;
    res.s.set(_a.x, _a.y + CABLE_SEAT_M, _a.z);
    res.e.set(_b.x, _b.y + CABLE_SEAT_M, _b.z);
    // The free plug she carries keeps the plain droop (the kit's tests frame it).
    const routed =
      to !== "pointer" && routeCable(res.routePts, res.pts, from, to, res.s, res.e, bulge);
    if (to === "pointer") shapeCable(res.pts, res.s, res.e, bulge);
    const cable = tagged.current?.children[0];

    if (fly >= 0) {
      // Lifted from its rest place: the whole lead travels, upright by the time it seats.
      restPose(fly, res.ra, res.rqa, res.rb, res.rqb, res.restPts);
      if (routed) for (let i = 0; i < ROUTE_POINTS; i++) res.toPts[i]?.copy(res.routePts[i] ?? _a);
      else plainToRoute(res.pts, res.toPts);
      flyPose(
        d01,
        res.restPts,
        res.ra,
        res.rqa,
        res.rb,
        res.rqb,
        res.toPts,
        _a,
        _b,
        res.routePts,
        res.fa,
        res.qa,
        res.fb,
        res.qb,
      );
      _la.copy(res.fa).applyMatrix4(_inv);
      _lb.copy(res.fb).applyMatrix4(_inv);
      plugA.current?.position.copy(_la);
      plugB.current?.position.copy(_lb);
      plugA.current?.quaternion.copy(res.qa);
      plugB.current?.quaternion.copy(res.qb);
      plugB.current?.scale.setScalar(1);
      if (cable) cable.visible = true;
      writeCable(res, res.routeCurve, 1, 0);
    } else {
      _la.copy(_a).applyMatrix4(_inv);
      _lb.copy(_b).applyMatrix4(_inv);
      plugA.current?.position.copy(_la);
      plugB.current?.position.copy(_lb);
      plugA.current?.quaternion.identity();
      plugB.current?.quaternion.identity();
      // The far plug pops in over the last tenth of the draw; the cable hides until it has length.
      plugB.current?.scale.setScalar(Math.max(0.001, Math.min(1, (d01 - 0.9) * 10)));
      if (cable) cable.visible = d01 > 0.002;
      writeCable(res, routed ? res.routeCurve : res.curve, d01, routed ? 0 : undefined);
    }
    curve.version++;
    if (to !== "pointer") {
      // The tap target covers the middle only, so the ends stay free for tapping the nuts.
      const span = Math.hypot(_b.x - _a.x, _b.z - _a.z);
      const [t0, t1] = leadHitRange(span);
      const c = routed ? res.routeCurve : res.curve;
      for (let i = 0; i <= res.hitN; i++) {
        c.getPoint(t0 + ((t1 - t0) * i) / res.hitN, _pt);
        restOnBench(_pt, routed ? 0 : undefined);
        _pt.applyMatrix4(_inv);
        res.mid[i * 3] = _pt.x;
        res.mid[i * 3 + 1] = _pt.y;
        res.mid[i * 3 + 2] = _pt.z;
      }
      writeTube(res.hit, res.mid, res.hitN, 5, hitR);
    }
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onTap?.(e.nativeEvent.pointerType);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.pointerType === "touch") return;
    e.stopPropagation();
    onHover?.(true);
  };
  const onOut = () => onHover?.(false);
  return (
    <group ref={root} visible={false}>
      <group ref={tagged}>
        <mesh geometry={res.tube} material={res.cableMat} frustumCulled={false} castShadow />
        <group ref={plugs}>
          <PlugMeshes res={res} plug={plugA} pins={pinsA} />
          <PlugMeshes res={res} plug={plugB} pins={pinsB} />
        </group>
      </group>
      {to !== "pointer" ? (
        <mesh
          ref={hitMesh}
          geometry={res.hit}
          material={res.hitMat}
          frustumCulled={false}
          onPointerDown={onDown}
          onPointerOver={onOver}
          onPointerOut={onOut}
          userData={LEAD_HIT_DATA}
          visible={false}
        />
      ) : null}
    </group>
  );
}

export interface RestingLeadProps {
  /** Which rest place (layout.ts LEAD_REST). */
  slot: number;
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  /** The entrance's drop: height above its place, and k (0: not on the bench yet). */
  drop?: { readonly heightM: number; readonly k: number } | undefined;
  /** Set while the lead flies home, so the stage keeps rendering (StageMotion's flags). */
  awake?: { busy: boolean; moving: boolean } | undefined;
}

/** inOut cubic, for the flight home (learn/stage/motion.ts has the same curve for the draw). */
function inOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * A lead lying in its rest place, until it is lifted (a Lead takes its place and flies from it) or
 * while it is in her hand. A removed lead flies home over FLY_BACK_S from the nuts it joined. It
 * takes no taps: the nuts make leads. Its ink ids follow the bench's leads, out of their way.
 */
export function RestingLead({ slot, state, quality, drop, awake }: RestingLeadProps) {
  const registry = useTerminalRegistry();
  const root = useRef<THREE.Group>(null);
  const plugA = useRef<THREE.Group>(null);
  const plugB = useRef<THREE.Group>(null);
  const pinsA = useRef<THREE.Group>(null);
  const pinsB = useRef<THREE.Group>(null);
  const tagged = useRef<THREE.Group>(null);
  const plugs = useRef<THREE.Group>(null);
  const colour = LEAD_REST[slot]?.colour ?? "red";
  const res = useLeadResources(`rest-${slot}-${colour}`, colour, quality);
  const lastE = useRef(Number.NaN);
  /** The resources last written: a new tier makes new ones, which must be written afresh. */
  const lastRes = useRef<LeadRes | null>(null);

  useEffect(() => {
    tagInk(
      INK_IDS.leadBase + ((LEAD_REST_COUNT + slot) % 20),
      [plugs, tagged],
      [pinsA, pinsB],
      tagged,
    );
  }, [slot]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const rest = bookOf(state).rest;
    // Lifted, in her hand, or just let go of her hand: the lead she made from it takes the place
    // on its first frame, so the copy at rest must not show for the frame between.
    const handing = rest.hand.slot === slot && nowS() - rest.hand.atS < HAND_HOLD_S;
    const gone = rest.taken[slot] !== null || rest.held === slot || handing;
    const k = drop ? drop.k : 1;
    g.visible = !gone && k > 0;
    if (!g.visible) {
      lastE.current = Number.NaN;
      return;
    }
    g.position.y = drop ? drop.heightM : 0;
    // On its way home: from the nuts it joined, back to its place.
    const age = nowS() - (rest.backAtS[slot] ?? Number.NEGATIVE_INFINITY);
    const a = rest.backA[slot];
    const b = rest.backB[slot];
    let e = 0;
    if (age >= 0 && age < FLY_BACK_S && a && b) {
      if (registry.worldPosition(a, _a) && registry.worldPosition(b, _b)) {
        e = 1 - inOut(age / FLY_BACK_S);
      }
      if (awake) {
        awake.busy = true;
        awake.moving = true;
      }
    }
    if (e === lastE.current && lastRes.current === res) return;
    lastRes.current = res;
    lastE.current = e;
    const par = g.parent;
    if (par) _inv.copy(par.matrixWorld).invert();
    else _inv.identity();
    restPose(slot, res.ra, res.rqa, res.rb, res.rqb, res.restPts);
    if (e > 0 && a && b) {
      res.s.set(_a.x, _a.y + CABLE_SEAT_M, _a.z);
      res.e.set(_b.x, _b.y + CABLE_SEAT_M, _b.z);
      if (!routeCable(res.toPts, res.pts, a, b, res.s, res.e, 0)) {
        plainToRoute(res.pts, res.toPts);
      }
      flyPose(
        e,
        res.restPts,
        res.ra,
        res.rqa,
        res.rb,
        res.rqb,
        res.toPts,
        _a,
        _b,
        res.routePts,
        res.fa,
        res.qa,
        res.fb,
        res.qb,
      );
    } else {
      for (let i = 0; i < ROUTE_POINTS; i++) res.routePts[i]?.copy(res.restPts[i] ?? _a);
      res.fa.copy(res.ra);
      res.fb.copy(res.rb);
      res.qa.copy(res.rqa);
      res.qb.copy(res.rqb);
    }
    _la.copy(res.fa).applyMatrix4(_inv);
    _lb.copy(res.fb).applyMatrix4(_inv);
    plugA.current?.position.copy(_la);
    plugB.current?.position.copy(_lb);
    plugA.current?.quaternion.copy(res.qa);
    plugB.current?.quaternion.copy(res.qb);
    writeCable(res, res.routeCurve, 1, 0);
  });

  return (
    <group ref={root} visible={false}>
      <group ref={tagged}>
        <mesh geometry={res.tube} material={res.cableMat} frustumCulled={false} castShadow />
        <group ref={plugs}>
          <PlugMeshes res={res} plug={plugA} pins={pinsA} />
          <PlugMeshes res={res} plug={plugB} pins={pinsB} />
        </group>
      </group>
    </group>
  );
}
