import { useFrame } from "@react-three/fiber";
import { TERMINAL_IDS } from "@snaplab/engine";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { slotBounds } from "../../apparatus/ohms-law/kitParams";
import { getLeadCurve } from "../../apparatus/ohms-law/Lead";
import { TERMINAL_PART } from "../../apparatus/ohms-law/layout";
import type { CalloutSpec } from "../callouts/types";
import type { DirectorHandle } from "../script/createDirector";
import { type LeadPhase, leadPhaseInto, partsEnteredBefore } from "../script/timing";
import { useTerminalRegistry } from "../terminals";
import type { OhmsLawBench, PartId, TerminalId } from "../types";
import { chipTarget, forgetLead, HINT_TEXT } from "../wiring/leadPick";
import {
  actTaps,
  type DropSlot,
  dropAt,
  dropFrom,
  entranceOrder,
  inOutCubic,
  leadDropStartS,
  SHAKE_S,
  springStep,
} from "./motion";
import { restBounds } from "./shots";
import {
  chipSpecAt,
  clearBench,
  DROP_SLOTS,
  entranceFrame,
  entranceOnJump,
  fillBench,
  MAX_TAGS,
  type StageMotion,
  stageBusy,
} from "./stageMotion";

// The stage's choreographer (docs/plans/wave-2-lean.md, 2b-motion), inside the Canvas. Each frame
// it feeds the director its time, keeps the beat's own clock (beat seconds, scaled by the speed),
// and writes what the parts read from the shared StageMotion: which parts are on the bench and
// how high the dropping ones are, the lead being drawn and how far, where the pen nib points and
// when it taps, the rings, and the callout chip's spring toward the beat's anchor projected to
// screen px. It runs before every other frame callback (priority −2), so the parts read this
// frame's values. Allocates nothing per frame.

const TERMINALS: ReadonlySet<string> = new Set(TERMINAL_IDS);
const isTerminal = (a: string): a is TerminalId => TERMINALS.has(a);
const DROPS: ReadonlySet<string> = new Set(DROP_SLOTS);
const isDrop = (p: string): p is DropSlot => DROPS.has(p);

/** A part's anchor: the middle of its footprint, at its top. */
const PART_ANCHOR: Readonly<Record<DropSlot, readonly [number, number, number]>> =
  Object.fromEntries(
    DROP_SLOTS.map((s) => {
      const b = slotBounds(s, 0);
      return [s, [(b.x0 + b.x1) / 2, b.h, (b.z0 + b.z1) / 2] as const];
    }),
  ) as Record<DropSlot, readonly [number, number, number]>;

/** The slot a callout anchor sits on (a terminal's part, or the part itself). */
function slotOf(anchor: PartId | TerminalId): DropSlot | null {
  const part: string = isTerminal(anchor) ? TERMINAL_PART[anchor] : anchor;
  return isDrop(part) ? part : null;
}

/**
 * The callout chip for the resistance box stands at the box's front edge on the bench, not over its
 * middle, where it covered half the plugs (phone, R = 1 Ω and Repeat).
 */
const BOX_CHIP_ANCHOR: readonly [number, number, number] = (() => {
  const b = slotBounds("box", 0);
  return [(b.x0 + b.x1) / 2, 0, b.z1];
})();

/** How far up a part's footprint top its tag's dot stands; the box's plugs stand well above its body. */
const TAG_RISE = 0.8;
const BOX_TAG_RISE = 2;

/** No tags: a beat without any. */
const NO_TAGS: readonly CalloutSpec[] = [];

/** The leads' tag stands over the middle of the leads lying in front, at plug height. */
const LEADS_ANCHOR: readonly [number, number, number] = (() => {
  const r = restBounds();
  return [(r.x0 + r.x1) / 2, r.h, (r.z0 + r.z1) / 2];
})();

/** The chip's settled tolerance: px of distance and px/s of speed. */
const CHIP_REST_PX = 0.5;
const CHIP_REST_V = 4;

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

/**
 * The Remove chip on the lead she hovers or selected, or the first-lead hint: the lead's middle
 * projected to canvas px, sent to the chip's sink. True while the chip is on a timer (the hint,
 * or the linger after the mouse left a lead), so the loop keeps the frames that end it.
 */
function placeRemove(
  m: StageMotion,
  bench: OhmsLawBench,
  camera: THREE.Camera,
  size: { width: number; height: number },
): boolean {
  if (!m.remove) return false;
  const nowS = performance.now() / 1000;
  const tgt = chipTarget(m.leads, nowS);
  if (tgt) {
    let exists = false;
    const leads = bench.visual.current.leads;
    for (let i = 0; i < leads.length; i++) if (leads[i]?.id === tgt.id) exists = true;
    const c = exists ? getLeadCurve(bench.visual, tgt.id) : undefined;
    if (!exists) forgetLead(m.leads, tgt.id);
    if (c && c.count > 1) {
      const k = Math.floor(c.count / 2) * 3;
      // The cable's points are in BenchWiring's space, which is the scene's.
      _q.set(c.points[k] ?? 0, c.points[k + 1] ?? 0, c.points[k + 2] ?? 0).project(camera);
      const x = ((_q.x + 1) / 2) * size.width;
      const y = ((1 - _q.y) / 2) * size.height;
      m.remove(x, y, tgt.label, tgt.removes, tgt.id);
      return tgt.label === HINT_TEXT || (m.leads.hover === null && m.leads.selected !== tgt.id);
    }
  }
  m.remove(0, 0, "", false, null);
  return false;
}

export interface ChoreoProps {
  director: DirectorHandle | null;
  bench: OhmsLawBench;
  motion: StageMotion;
}

export function Choreo({ director, bench, motion }: ChoreoProps) {
  const registry = useTerminalRegistry();
  const order = useMemo(() => entranceOrder(DROP_SLOTS), []);
  const c = useRef({
    beat: -1,
    epoch: -1,
    t: 0,
    tapped: 0,
    entered: new Set<PartId>() as ReadonlySet<PartId>,
    /** Where each of this beat's entering parts falls in the drop order. */
    dropIndex: new Map<DropSlot, number>(),
    spec: null as CalloutSpec | null,
    phase: { nibAt: "from", tapped: 0, drawn: 0 } as LeadPhase,
    cx: { x: 0, v: 0 },
    cy: { x: 0, v: 0 },
    shown: false,
  });

  useFrame((state, dtRaw) => {
    let dt = Math.min(dtRaw, 0.1);
    const m = motion;
    const k = c.current;
    // A shot's freeze point: play no further into the beat than it (dev only, &freeze=).
    if (
      director &&
      m.freezeAtS !== null &&
      director.state.playing &&
      k.beat === director.state.beat
    ) {
      dt = Math.max(0, Math.min(dt, (m.freezeAtS - k.t) / director.state.speed));
    }
    if (!director) {
      fillBench(m);
      m.busy = false;
      m.moving = false;
      return;
    }
    director.advance(dt);
    const s = director.state;
    const script = director.script;
    const beat = script.beats[s.beat];
    const watch = s.mode === "watch";

    // ---- The beat's own clock ----
    if (s.beat !== k.beat || m.epoch !== k.epoch) {
      // A seek, previous, next or replay plays Watch's own entrance again, even after the paper's.
      if (k.epoch !== -1 && m.epoch !== k.epoch) {
        m.entrance.landed = false;
        // Guided: a jump past the first sentence hands the bench to the director; a jump back to
        // it is armed by its reading's start (LearnPage), or here if it is not playing.
        entranceOnJump(m.entrance, s.beat);
      }
      k.beat = s.beat;
      k.epoch = m.epoch;
      k.t = 0;
      k.tapped = 0;
      k.entered = partsEnteredBefore(script, s.beat);
      k.dropIndex.clear();
      const act = beat?.act;
      if (act?.kind === "enter") {
        let i = 0;
        for (const slot of order) if (act.parts.includes(slot)) k.dropIndex.set(slot, i++);
      }
      // One chip: the beat's own callout, or the last one before it in the same stage. Worked
      // out from the script, so a seek shows the same chip as playing there.
      k.spec = chipSpecAt(script.beats, s.beat);
      // The beat's part tags (guided identify): only its own, never carried on.
      m.tags.specs = beat?.tags ?? NO_TAGS;
      m.tags.onSpecs?.();
    }
    if (s.playing && !s.finished) k.t += dt * s.speed;
    if (m.freezeAtS !== null && s.playing && k.t >= m.freezeAtS - 1e-6) {
      m.freezeAtS = null;
      director.pause();
    }

    // ---- The entrance: under the question paper, parts land as the paper names them (or on the
    // timed drop), then the leads one by one; in Watch, in turn on the enter beat, unless the
    // paper's entrance has already put them down; Practise and Exam start with a full bench ----
    let dropping = false;
    const entrance = m.entrance;
    if (entrance.on) {
      dropping = entranceFrame(entrance, order, dt, m.parts, m.restLeads);
      // Guided: once everything has landed and the director has moved on, it takes the bench over.
      if (entrance.endsAtBeat !== null && entrance.landed && s.beat > entrance.endsAtBeat) {
        entrance.on = false;
      }
    } else if (watch && !s.finished) {
      clearBench(m);
      for (const slot of DROP_SLOTS) {
        const pose = m.parts[slot];
        const i = k.dropIndex.get(slot);
        if (k.entered.has(slot) || entrance.landed) {
          pose.heightM = 0;
          pose.k = 1;
        } else if (i !== undefined) {
          dropAt(k.t, i, pose);
          if (pose.k > 0 && pose.k < 1) dropping = true;
        }
      }
      // The leads follow the enter beat's parts, one by one, and lie in place after it.
      const entering = k.dropIndex.size;
      for (let j = 0; j < m.restLeads.length; j++) {
        const pose = m.restLeads[j];
        if (!pose) continue;
        if (entrance.landed || (entering === 0 && k.entered.size > 0)) {
          pose.heightM = 0;
          pose.k = 1;
        } else if (entering > 0) {
          dropFrom(k.t, leadDropStartS(j, entering), pose);
          if (pose.k > 0 && pose.k < 1) dropping = true;
        }
      }
    } else {
      fillBench(m);
    }

    // ---- The actor's hand: the lead it draws and the pen nib ----
    const act = s.act;
    m.nib.rate = watch ? s.speed : 1;
    m.lead.from = null;
    m.lead.to = null;
    m.lead.drawn = 1;
    m.nib.target = null;
    // The nib taps each terminal of a lead, the key as it moves, and the box as a plug moves.
    const taps = act ? actTaps(act.kind, s.actT) : 0;
    if (taps > k.tapped) {
      m.nib.tap++;
      k.tapped = taps;
    }
    if (act?.kind === "lead") {
      const ph = leadPhaseInto(s.actT, k.phase);
      m.lead.from = act.from;
      m.lead.to = act.to;
      m.lead.drawn = inOutCubic(ph.drawn);
      if (s.actT < 1) m.nib.target = ph.nibAt === "from" ? act.from : act.to;
    } else if (act?.kind === "key" && s.actT < 1) {
      m.nib.target = PART_ANCHOR.key;
    } else if (act?.kind === "plug" && s.actT < 1) {
      m.nib.target = PART_ANCHOR.box;
    }
    const drawing = m.lead.from !== null && m.lead.drawn > 0 && m.lead.drawn < 1;

    // ---- Rings: the two terminals of the lead being made (Watch) or to be made (Practise) ----
    const t = m.marks.targets;
    t.length = 0;
    if (watch && act?.kind === "lead" && s.actT < 1) {
      t.push(act.from, act.to);
    } else if (s.mode === "practice" && beat?.act?.kind === "lead" && s.waiting) {
      const { from, to } = beat.act;
      const cmp = bench.comparison;
      const want = cmp.missing.find(
        ([a, b]) => (a === from && b === to) || (a === to && b === from),
      );
      const next = want ?? cmp.missing[0];
      if (next) t.push(next[0], next[1]);
    }
    const shaking =
      m.marks.shake.length > 0 && performance.now() / 1000 - m.marks.shakeAtS < SHAKE_S;

    // ---- The callout chip: one, springing to the beat's anchor in real time ----
    let chipBusy = false;
    if (m.chip) {
      // One label at a time: while a lead's Remove chip (or its hint) shows, the callout steps aside.
      const removing = chipTarget(m.leads, performance.now() / 1000) !== null;
      const spec = s.mode === "exam" || removing ? null : k.spec;
      const slot = spec ? slotOf(spec.anchor) : null;
      let ok = spec !== null && (slot === null || m.parts[slot].k > 0);
      if (ok && spec) {
        if (isTerminal(spec.anchor)) ok = registry.worldPosition(spec.anchor, _p);
        else if (slot) {
          if (slot === "box") _p.set(...BOX_CHIP_ANCHOR);
          else {
            const [x, y, z] = PART_ANCHOR[slot];
            _p.set(x, y + m.parts[slot].heightM, z);
          }
        } else ok = false;
      }
      if (ok) {
        _p.project(state.camera);
        ok = _p.z < 1 && Math.abs(_p.x) <= 1.2 && Math.abs(_p.y) <= 1.2;
      }
      if (ok) {
        const px = ((_p.x + 1) / 2) * state.size.width;
        const py = ((1 - _p.y) / 2) * state.size.height;
        if (!k.shown) {
          k.cx.x = px;
          k.cx.v = 0;
          k.cy.x = py;
          k.cy.v = 0;
        } else {
          // Real time: the speed never scales the chip (BC101).
          springStep(k.cx, px, dt);
          springStep(k.cy, py, dt);
        }
        k.shown = true;
        const settled =
          Math.abs(k.cx.x - px) < CHIP_REST_PX &&
          Math.abs(k.cy.x - py) < CHIP_REST_PX &&
          Math.abs(k.cx.v) < CHIP_REST_V &&
          Math.abs(k.cy.v) < CHIP_REST_V;
        chipBusy = !settled;
        m.chip(k.cx.x, k.cy.x, spec?.label ?? "", true, settled);
      } else {
        k.shown = false;
        m.chip(k.cx.x, k.cy.x, spec?.label ?? "", false, true);
      }
    }

    // ---- Part tags: each beat's, projected to canvas px every frame (the camera is easing) ----
    const tags = m.tags;
    // None under the question paper (its entrance is on) or in Exam.
    const tagCount = s.mode === "exam" || entrance.on ? 0 : Math.min(tags.specs.length, MAX_TAGS);
    for (let i = 0; i < MAX_TAGS; i++) {
      const spec = tags.specs[i];
      const pt = tags.points[i];
      if (!pt) continue;
      if (!spec || i >= tagCount) {
        pt.visible = false;
        continue;
      }
      const slot = slotOf(spec.anchor);
      let ok = true;
      if (slot) {
        const [x, y, z] = PART_ANCHOR[slot];
        ok = m.parts[slot].k > 0;
        // Most of the way up: on the case of a meter, not at the back edge of its top.
        _p.set(x, y * (slot === "box" ? BOX_TAG_RISE : TAG_RISE) + m.parts[slot].heightM, z);
      } else if (spec.anchor === "leads") {
        const lead = m.restLeads[0];
        ok = lead !== undefined && lead.k > 0;
        _p.set(LEADS_ANCHOR[0], LEADS_ANCHOR[1] + (lead?.heightM ?? 0), LEADS_ANCHOR[2]);
      } else ok = false;
      if (ok) {
        _p.project(state.camera);
        ok = _p.z < 1;
        pt.x = ((_p.x + 1) / 2) * state.size.width;
        pt.y = ((1 - _p.y) / 2) * state.size.height;
      }
      pt.visible = ok;
    }
    tags.onFrame?.();

    // Paused, nothing on the bench moves: the loop may rest even mid-drop or mid-draw.
    const playing = s.playing && !s.finished && s.mode !== "exam";
    const nibOut = m.nib.target !== null;
    m.moving = (playing && (dropping || drawing || nibOut)) || shaking || (entrance.on && dropping);
    m.busy =
      stageBusy(s, t.length, chipBusy, m.moving) || placeRemove(m, bench, state.camera, state.size);
  }, -2);

  return null;
}
