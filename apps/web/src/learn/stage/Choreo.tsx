import { useFrame } from "@react-three/fiber";
import { TERMINAL_IDS } from "@snaplab/engine";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { slotBounds } from "../../apparatus/ohms-law/kitParams";
import { TERMINAL_PART } from "../../apparatus/ohms-law/layout";
import type { CalloutSpec } from "../callouts/types";
import type { DirectorHandle } from "../script/createDirector";
import { KEY_TOGGLE_AT, leadPhase, partsEnteredBefore } from "../script/timing";
import { useTerminalRegistry } from "../terminals";
import type { OhmsLawBench, PartId, TerminalId } from "../types";
import { type DropSlot, dropAt, entranceOrder, inOutCubic, SHAKE_S, springStep } from "./motion";
import { clearBench, DROP_SLOTS, type StageMotion } from "./stageMotion";

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

/** The chip's settled tolerance: px of distance and px/s of speed. */
const CHIP_REST_PX = 0.5;
const CHIP_REST_V = 4;

const _p = new THREE.Vector3();

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
    keyTapped: false,
    entered: new Set<PartId>() as ReadonlySet<PartId>,
    /** Where each of this beat's entering parts falls in the drop order. */
    dropIndex: new Map<DropSlot, number>(),
    spec: null as CalloutSpec | null,
    specStage: "",
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
      for (const s of DROP_SLOTS) {
        m.parts[s].heightM = 0;
        m.parts[s].k = 1;
      }
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
      k.beat = s.beat;
      k.epoch = m.epoch;
      k.t = 0;
      k.tapped = 0;
      k.keyTapped = false;
      k.entered = partsEnteredBefore(script, s.beat);
      k.dropIndex.clear();
      const act = beat?.act;
      if (act?.kind === "enter") {
        let i = 0;
        for (const slot of order) if (act.parts.includes(slot)) k.dropIndex.set(slot, i++);
      }
      // One chip: the beat's own callout, or the last one while the stage is the same.
      const spec = beat?.callouts?.[0] ?? null;
      if (spec) {
        k.spec = spec;
        k.specStage = beat?.stage ?? "";
      } else if (beat?.stage !== k.specStage) {
        k.spec = null;
      }
    }
    if (s.playing && !s.finished) k.t += dt * s.speed;
    if (m.freezeAtS !== null && s.playing && k.t >= m.freezeAtS - 1e-6) {
      m.freezeAtS = null;
      director.pause();
    }

    // ---- The entrance (Watch): parts land in turn; Practise and Exam start with a full bench ----
    let dropping = false;
    if (watch && !s.finished) {
      clearBench(m);
      for (const slot of DROP_SLOTS) {
        const pose = m.parts[slot];
        const i = k.dropIndex.get(slot);
        if (k.entered.has(slot)) {
          pose.heightM = 0;
          pose.k = 1;
        } else if (i !== undefined) {
          dropAt(k.t, i, pose);
          if (pose.k > 0 && pose.k < 1) dropping = true;
        }
      }
    } else {
      for (const slot of DROP_SLOTS) {
        m.parts[slot].heightM = 0;
        m.parts[slot].k = 1;
      }
    }

    // ---- The actor's hand: the lead it draws and the pen nib ----
    const act = s.act;
    m.nib.rate = watch ? s.speed : 1;
    m.lead.from = null;
    m.lead.to = null;
    m.lead.drawn = 1;
    m.nib.target = null;
    if (act?.kind === "lead") {
      const ph = leadPhase(s.actT);
      m.lead.from = act.from;
      m.lead.to = act.to;
      m.lead.drawn = inOutCubic(ph.drawn);
      if (ph.tapped > k.tapped) {
        m.nib.tap++;
        k.tapped = ph.tapped;
      }
      if (s.actT < 1) m.nib.target = ph.nibAt === "from" ? act.from : act.to;
    } else if (act?.kind === "key" && s.actT < 1) {
      m.nib.target = PART_ANCHOR.key;
      if (s.actT >= KEY_TOGGLE_AT && !k.keyTapped) {
        k.keyTapped = true;
        m.nib.tap++;
      }
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
      const spec = s.mode === "exam" ? null : k.spec;
      const slot = spec ? slotOf(spec.anchor) : null;
      let ok = spec !== null && (slot === null || m.parts[slot].k > 0);
      if (ok && spec) {
        if (isTerminal(spec.anchor)) ok = registry.worldPosition(spec.anchor, _p);
        else if (slot) {
          const [x, y, z] = PART_ANCHOR[slot];
          _p.set(x, y + m.parts[slot].heightM, z);
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

    // Paused, nothing on the bench moves: the loop may rest even mid-drop or mid-draw.
    const playing = s.playing && !s.finished && s.mode !== "exam";
    const nibOut = m.nib.target !== null;
    m.moving = (playing && (dropping || drawing || nibOut)) || shaking;
    m.busy = (watch && playing) || t.length > 0 || chipBusy || m.moving;
  }, -2);

  return null;
}
