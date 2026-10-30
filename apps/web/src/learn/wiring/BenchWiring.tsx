import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { DIAGRAM_LEADS } from "@snaplab/engine";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { getLeadCurve, Lead, type LeadCurve } from "../../apparatus/ohms-law/Lead";
import { LEAD_RADIUS_M } from "../../apparatus/ohms-law/LeadParts";
import type { LabAudio } from "../../audio/labAudio";
import { flowRate } from "../../lab/flow";
import { inOutCubic, LEAD_DRAW_S } from "../stage/motion";
import type { StageMotion } from "../stage/stageMotion";
import { useTerminalRegistry } from "../terminals";
import type { LeadColour, OhmsLawBench, OhmsLawVisualState, TerminalId } from "../types";
import { hoverLead, leadLit, tapLead } from "./leadPick";
import { TerminalHits, TerminalMarks } from "./TerminalMarks";

// The wiring layer of the V–I bench (docs/plans/ohms-law-vi.md, "Wave 2 → Wiring"), used inside
// the Canvas under a <TerminalProvider>. It steps the bench controller each frame, routes nut
// taps to it, draws her leads (tap one to remove it) and the rubber band while a lead is
// pending, pencil-grey dashed ghosts for the guided hint, and current-flow dots on the leads.
// Every current comes from the engine through the controller; nothing here is printed.

export interface BenchWiringProps {
  bench: OhmsLawBench & { readonly nextColour?: LeadColour };
  quality: QualityTier;
  /** World size of the invisible bench plane that tracks the pointer (the desk's size). */
  deskSize?: readonly [number, number];
  /** Plays the over-range clack each time a needle slams a stop (the counters rise). */
  audio?: Pick<LabAudio, "needleSlam">;
  /**
   * The live stage's motion (learn/stage/Choreo.tsx): the lead the actor is drawing, the rings,
   * the hovered nut and the shake. Without it, leads appear whole and nothing is ringed.
   */
  motion?: Pick<StageMotion, "lead" | "marks" | "leads">;
  /** False on the demonstration bench (Watch): taps on nuts and leads do nothing (default true). */
  interactive?: boolean;
  /** A lead she makes draws itself from her first tap over LEAD_DRAW_S (Practise). */
  drawHers?: boolean;
}

/** Re-renders on every discrete bench change (leads, pending, mode). Never per frame. */
function useBenchVersion(bench: OhmsLawBench): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => bench.subscribe(bump), [bench]);
}

/** Where the rubber band's free end starts: a little toward the student from the nut. */
const BAND_START_DZ_M = 0.06;
const _nut = new THREE.Vector3();
/** The desk's size (PaperDesk's default), metres. Module-level, so the plane is built once. */
const DEFAULT_DESK = [2.4, 1.6] as const;
/** A press and release on bare desk closer than this (CSS px) is a tap, not a camera drag. */
const TAP_SLOP_PX = 8;

export function BenchWiring({
  bench,
  quality,
  deskSize = DEFAULT_DESK,
  audio,
  motion,
  interactive = true,
  drawHers = false,
}: BenchWiringProps) {
  useBenchVersion(bench);
  // When each lead first appeared (performance.now, seconds); leads there at mount count as old.
  const [born] = useState(() => {
    const m = new Map<string, number>();
    for (const l of bench.visual.current.leads) m.set(l.id, Number.NEGATIVE_INFINITY);
    return m;
  });
  const slamsSeen = useRef(-1);
  const deskDown = useRef<{ x: number; y: number } | null>(null);
  const registry = useTerminalRegistry();
  const state = bench.visual;

  useEffect(() => {
    if (!interactive) return;
    registry.setTapHandler((id) => bench.tapTerminal(id));
    return () => registry.setTapHandler(null);
  }, [registry, bench, interactive]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const from = bench.visual.current.pendingFrom;
      if (from) bench.tapTerminal(from); // tapping the start nut again cancels
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bench]);

  // The rubber band starts at its nut, not wherever the pointer last was.
  const pending = state.current.pendingFrom;
  useEffect(() => {
    if (pending && registry.worldPosition(pending, _nut)) {
      bench.setPointer(_nut.x, 0, _nut.z + BAND_START_DZ_M);
    }
  }, [pending, registry, bench]);

  useFrame((_, deltaS) => {
    bench.advance(deltaS);
    const r = bench.visual.current.readout;
    const slams = r.ammeterSlams + r.voltmeterSlams;
    if (slamsSeen.current >= 0 && slams > slamsSeen.current) audio?.needleSlam(1);
    slamsSeen.current = slams;
  });

  const [deskW, deskD] = deskSize;
  const plane = useMemo(() => {
    const geo = new THREE.PlaneGeometry(deskW, deskD);
    geo.rotateX(-Math.PI / 2);
    return { geo, mat: new THREE.MeshBasicMaterial() };
  }, [deskW, deskD]);
  useEffect(
    () => () => {
      plane.geo.dispose();
      plane.mat.dispose();
    },
    [plane],
  );
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!bench.visual.current.pendingFrom) return;
    bench.setPointer(e.point.x, 0, e.point.z);
  };
  // Phones have no Esc: a tap on bare desk cancels a pending lead. The plane only sees the
  // press when nothing nearer took it (nuts, leads and parts stop it), and a press that turns
  // into a camera drag is not a tap.
  // A tap on bare desk also lets go of a lead she selected for removal.
  const picks = motion?.leads;
  const onDeskDown = (e: ThreeEvent<PointerEvent>) => {
    onMove(e);
    deskDown.current =
      bench.visual.current.pendingFrom || picks?.selected
        ? { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
        : null;
  };
  const onDeskUp = (e: ThreeEvent<PointerEvent>) => {
    const down = deskDown.current;
    deskDown.current = null;
    if (!down) return;
    const moved = Math.hypot(e.nativeEvent.clientX - down.x, e.nativeEvent.clientY - down.y);
    if (moved > TAP_SLOP_PX) return;
    const from = bench.visual.current.pendingFrom;
    if (from)
      bench.tapTerminal(from); // tapping the start nut again cancels
    else if (picks) picks.selected = null;
  };

  const leads = state.current.leads;
  const now = performance.now() / 1000;
  for (const l of leads) if (!born.has(l.id)) born.set(l.id, now);
  return (
    <group>
      <mesh
        geometry={plane.geo}
        material={plane.mat}
        position-y={0.0005}
        visible={false}
        onPointerMove={onMove}
        onPointerDown={onDeskDown}
        onPointerUp={onDeskUp}
      />
      {leads.map((l) => (
        <DrawnLead
          key={l.id}
          id={l.id}
          bench={bench}
          from={l.a}
          to={l.b}
          colour={l.colour}
          state={state}
          quality={quality}
          motion={motion}
          bornS={drawHers ? (born.get(l.id) ?? Number.NEGATIVE_INFINITY) : Number.NEGATIVE_INFINITY}
          interactive={interactive}
        />
      ))}
      {pending ? (
        <Lead
          key={`pending-${pending}`}
          from={pending}
          to="pointer"
          colour={bench.nextColour ?? "red"}
          state={state}
          quality={quality}
        />
      ) : null}
      <GhostLeads state={state} quality={quality} />
      <LeadFlowDots state={state} quality={quality} />
      {motion ? <TerminalMarks marks={motion.marks} quality={quality} /> : null}
      {motion && interactive ? <TerminalHits marks={motion.marks} /> : null}
    </group>
  );
}

/**
 * One of the bench's leads, drawn on: the actor's current lead follows the director's draw
 * (motion.lead), a lead she has just made draws from her first tap over LEAD_DRAW_S, and every
 * other lead is whole. The draw is read every frame through a ref-like object (Lead's `drawn`).
 */
function DrawnLead({
  id,
  bench,
  from,
  to,
  colour,
  state,
  quality,
  motion,
  bornS,
  interactive,
}: {
  id: string;
  bench: Pick<OhmsLawBench, "removeLead">;
  from: TerminalId;
  to: TerminalId;
  colour: LeadColour;
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  motion: Pick<StageMotion, "lead" | "leads"> | undefined;
  bornS: number;
  interactive: boolean;
}) {
  const picks = motion?.leads;
  // Picked for removal (hovered, or selected by a first tap or by the guide): the whole cable lit.
  const highlight = useMemo(
    () => ({
      get current(): boolean {
        return picks ? leadLit(picks, id, performance.now() / 1000) : false;
      },
    }),
    [picks, id],
  );
  const handlers = interactive
    ? {
        // A tap on the cable: a mouse removes the lead; a finger selects it first (leadPick.ts).
        onTap: (pointerType?: string) => {
          if (picks) tapLead(bench, picks, id, pointerType);
          else bench.removeLead(id);
        },
        onHover: (on: boolean) => {
          if (picks) hoverLead(picks, id, on, performance.now() / 1000);
          document.body.style.cursor = on ? "pointer" : "";
        },
        highlight,
      }
    : {};
  const drawn = useMemo(
    () => ({
      get current(): number {
        const a = motion?.lead;
        if (a && a.from === from && a.to === to) return a.drawn;
        if (!Number.isFinite(bornS)) return 1;
        return inOutCubic((performance.now() / 1000 - bornS) / LEAD_DRAW_S);
      },
    }),
    [motion, from, to, bornS],
  );
  return (
    <Lead
      from={from}
      to={to}
      colour={colour}
      state={state}
      quality={quality}
      drawn={drawn}
      {...handlers}
    />
  );
}

// ── Guided hint: pencil-grey dashed ghosts for the diagram leads still missing ──────────────

const GHOST_DASHES = 14;
const GHOST_RADIUS_M = 0.0012;
/** The ghost runs a little above the nut tops and arcs up, so it never hides in a part. */
const GHOST_LIFT_M = 0.012;
const GHOST_ARC_M = 0.035;
/** Pencil grey (--pencil in styles/tokens.css). Dashed, so colour is not the only cue. */
const PENCIL = "#9a958a";

const _ga = new THREE.Vector3();
const _gb = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _yAxis = new THREE.Vector3(0, 1, 0);

function ghostPoint(t: number, out: THREE.Vector3): void {
  out.lerpVectors(_ga, _gb, t);
  out.y += GHOST_ARC_M * 4 * t * (1 - t);
}

function GhostLeads({
  state,
  quality,
}: {
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
}) {
  const registry = useTerminalRegistry();
  const mesh = useMemo(() => {
    const geo = new THREE.CylinderGeometry(1, 1, 1, quality === "low" ? 5 : 8, 1);
    const mat = new THREE.MeshBasicMaterial({ color: PENCIL, transparent: true, opacity: 0.9 });
    const m = new THREE.InstancedMesh(geo, mat, DIAGRAM_LEADS.length * GHOST_DASHES);
    m.count = 0;
    m.frustumCulled = false;
    m.renderOrder = 2;
    m.name = "ghost-leads";
    return m;
  }, [quality]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  useFrame(() => {
    const hints = state.current.hintMissing;
    let n = 0;
    for (let h = 0; h < hints.length && h < DIAGRAM_LEADS.length; h++) {
      const pair = hints[h];
      if (!pair) continue;
      if (!registry.worldPosition(pair[0], _ga) || !registry.worldPosition(pair[1], _gb)) continue;
      _ga.y += GHOST_LIFT_M;
      _gb.y += GHOST_LIFT_M;
      for (let d = 0; d < GHOST_DASHES; d++) {
        // Each dash fills 60% of its slot, so the gaps read as a dashed pencil line.
        ghostPoint(d / GHOST_DASHES, _p0);
        ghostPoint((d + 0.6) / GHOST_DASHES, _p1);
        _dir.subVectors(_p1, _p0);
        const len = _dir.length();
        if (len < 1e-6) continue;
        _q.setFromUnitVectors(_yAxis, _dir.divideScalar(len));
        _p0.add(_p1).multiplyScalar(0.5);
        _s.set(GHOST_RADIUS_M, len, GHOST_RADIUS_M);
        _m.compose(_p0, _q, _s);
        mesh.setMatrixAt(n++, _m);
      }
    }
    mesh.count = n;
    if (n > 0) mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}

// ── Current-flow dots on the leads ──────────────────────────────────────────────────────────

/** Leads that get dots; more than the diagram's seven, for her extra leads. */
const MAX_FLOW_LEADS = 20;
const DOT_M = 0.003;
/** At full rate a dot runs along a lead at 0.25 m/s, as on the metre bridge (lab/CurrentFlow). */
const MAX_SPEED_M_S = 0.25;
/** Solid blue-black pen ink (a touch bluer than --ink), so the dots read on paper and leads. */
const DOT_COLOUR = "#1d2c4a";

interface CurveLengths {
  version: number;
  /** Cumulative arc length at each point, metres. */
  cum: Float32Array;
}
const LENGTHS = new WeakMap<LeadCurve, CurveLengths>();

function lengthsOf(c: LeadCurve): CurveLengths {
  let l = LENGTHS.get(c);
  if (!l || l.cum.length !== c.count) {
    l = { version: -1, cum: new Float32Array(c.count) };
    LENGTHS.set(c, l);
  }
  if (l.version !== c.version) {
    l.version = c.version;
    const p = c.points;
    let acc = 0;
    l.cum[0] = 0;
    for (let i = 1; i < c.count; i++) {
      const dx = (p[i * 3] ?? 0) - (p[i * 3 - 3] ?? 0);
      const dy = (p[i * 3 + 1] ?? 0) - (p[i * 3 - 2] ?? 0);
      const dz = (p[i * 3 + 2] ?? 0) - (p[i * 3 - 1] ?? 0);
      acc += Math.sqrt(dx * dx + dy * dy + dz * dz);
      l.cum[i] = acc;
    }
  }
  return l;
}

/** Writes the point at arc length `s` along the curve into `out`. No allocation. */
function pointAt(c: LeadCurve, cum: Float32Array, s: number, out: THREE.Vector3): void {
  const p = c.points;
  let lo = 0;
  let hi = c.count - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((cum[mid] ?? 0) < s) lo = mid;
    else hi = mid;
  }
  const s0 = cum[lo] ?? 0;
  const s1 = cum[hi] ?? 0;
  const k = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
  out.set(
    (p[lo * 3] ?? 0) + ((p[hi * 3] ?? 0) - (p[lo * 3] ?? 0)) * k,
    (p[lo * 3 + 1] ?? 0) + ((p[hi * 3 + 1] ?? 0) - (p[lo * 3 + 1] ?? 0)) * k,
    (p[lo * 3 + 2] ?? 0) + ((p[hi * 3 + 2] ?? 0) - (p[lo * 3 + 2] ?? 0)) * k,
  );
}

const _dot = new THREE.Vector3();
const _dm = new THREE.Matrix4();

/**
 * Dots run along each lead at a rate set by the engine's current in it (flowRate, log scale),
 * in the direction of conventional current: forward from lead.a to lead.b when positive. A lead
 * with no current has no dots. Fewer dots on the low tier.
 */
function LeadFlowDots({
  state,
  quality,
}: {
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
}) {
  const perLead = quality === "low" ? 3 : 6;
  const mesh = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, quality === "low" ? 6 : 8, quality === "low" ? 4 : 6);
    const mat = new THREE.MeshBasicMaterial({ color: DOT_COLOUR });
    const m = new THREE.InstancedMesh(geo, mat, MAX_FLOW_LEADS * perLead);
    m.count = 0;
    m.frustumCulled = false;
    m.renderOrder = 3;
    m.name = "lead-flow-dots";
    // Not outlined by the ink pass (scene/ink): the dots are solid ink already.
    m.userData.noInk = true;
    return m;
  }, [quality, perLead]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  // Each slot's phase along its lead, 0–1; spread evenly to start.
  const phase = useMemo(() => {
    const f = new Float32Array(MAX_FLOW_LEADS * perLead);
    for (let i = 0; i < f.length; i++) f[i] = (i % perLead) / perLead;
    return f;
  }, [perLead]);

  useFrame((_, dtRaw) => {
    const v = state.current;
    const dt = Math.min(dtRaw, 0.1);
    const currents = v.readout.leadCurrentsA;
    let n = 0;
    for (let i = 0; i < v.leads.length && i < MAX_FLOW_LEADS; i++) {
      const lead = v.leads[i];
      if (!lead) continue;
      const iA = currents[lead.id] ?? 0;
      const rate = flowRate(iA);
      if (rate <= 0) continue;
      const curve = getLeadCurve(state, lead.id);
      if (!curve || curve.count < 2) continue;
      const { cum } = lengthsOf(curve);
      const total = cum[curve.count - 1] ?? 0;
      if (!(total > 1e-4)) continue;
      const du = (Math.sign(iA) * rate * MAX_SPEED_M_S * dt) / total;
      // A dot is a bead on the cable: its centre is on the cable's line, so its radius is the
      // cable's plus DOT_M scaled by the rate, or the cable would hide it.
      const size = LEAD_RADIUS_M + DOT_M * (0.5 + 0.5 * rate);
      for (let k = 0; k < perLead; k++) {
        const slot = i * perLead + k;
        let u = (phase[slot] ?? 0) + du;
        u -= Math.floor(u);
        phase[slot] = u;
        pointAt(curve, cum, u * total, _dot);
        _dm.makeScale(size, size, size);
        _dm.setPosition(_dot);
        mesh.setMatrixAt(n++, _dm);
      }
    }
    mesh.count = n;
    if (n > 0) mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
