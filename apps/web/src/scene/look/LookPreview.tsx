import { Canvas, useFrame } from "@react-three/fiber";
import { createOhmsLaw, DIAGRAM_LEADS, paramsFromSeed } from "@snaplab/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BRIDGE_BASE } from "../../apparatus/meter-bridge/dimensions";
import MeterBridgeKit from "../../apparatus/meter-bridge/MeterBridgeKit";
import type { MeterBridgeVisualState, QualityTier } from "../../apparatus/meter-bridge/types";
import { useMeterBridgeEngine } from "../../apparatus/meter-bridge/useMeterBridgeEngine";
import { CellHolder } from "../../apparatus/ohms-law/CellHolder";
import { KeyK } from "../../apparatus/ohms-law/Key";
import { Lead } from "../../apparatus/ohms-law/Lead";
import { type BenchSlot, INK_IDS, OHMS_LAW_LAYOUT } from "../../apparatus/ohms-law/layout";
import { Meter } from "../../apparatus/ohms-law/Meter";
import { ResistanceBox } from "../../apparatus/ohms-law/ResistanceBox";
import { Tray } from "../../apparatus/ohms-law/Tray";
import { WireBoard } from "../../apparatus/ohms-law/WireBoard";
import { TerminalProvider } from "../../learn/terminals";
import type { BenchLead, LeadColour, OhmsLawVisualState } from "../../learn/types";
import { lookFor, parseOverride } from "../../quality/tier";
import { InkComposer } from "../ink/InkComposer";
import { useInkFocus } from "../ink/inkFocus";
import { ReadySignal } from "../ReadySignal";
import { BlobShadow } from "./BlobShadow";
import { createDprLadder, type DprLadder } from "./dprLadder";
import { isPortrait, LookCamera } from "./LookCamera";
import { LookGround } from "./LookGround";
import { LookLights } from "./LookLights";
import { LookTier } from "./lookTier";
import type { Covered, LookShot } from "./types";
import { useDprLadder, useLadderDpr } from "./useDprLadder";

// ?look=ohms-law | ?look=meter-bridge: the look recipe on today's apparatus, for screenshots
// and the golden frame (docs/plans/exam-redesign.md, Wave 1, W1-look).
//   &quality=low|mid|high        the tier (default high)
//   &shot=bench|<slot>           ohms-law: the whole bench (default) or one part
//   &covered=l,r,t,b             CSS px covered by panels, to check the shot fit
//   &focus=ammeter,voltmeter     ohms-law: parts kept in focus; the rest fade back
//   &deg=<n>                     ohms-law: both needles at n degrees (default: a mid reading)
//   &leads=0                     ohms-law: no leads
//   &drag=1                      lets the camera turn by dragging
//   &ladder=0                    keeps the top pixel ratio (no step-down)
//   &dpr=<1–3>                   pins the pixel ratio there (no ladder)

const COLOURS: LeadColour[] = ["red", "black", "yellow"];
const SLOTS = Object.keys(OHMS_LAW_LAYOUT) as BenchSlot[];
const NO_COVER: Covered = { left: 0, right: 0, top: 0, bottom: 0 };

/** Blob shadows under each V–I part: x offsets from the part and a radius, in metres. Long parts get a row. */
const BLOBS: Readonly<Record<BenchSlot, { dx: readonly number[]; r: number }>> = {
  cells: { dx: [-0.05, 0.05], r: 0.08 },
  key: { dx: [0], r: 0.075 },
  ammeter: { dx: [0], r: 0.12 },
  voltmeter: { dx: [0], r: 0.12 },
  box: { dx: [-0.15, 0, 0.15], r: 0.11 },
  wire: { dx: [-0.44, -0.22, 0, 0.22, 0.44], r: 0.11 },
  tray: { dx: [-0.08, 0.08], r: 0.17 },
};

function parseCovered(raw: string | null): Covered {
  if (!raw) return NO_COVER;
  const [left = 0, right = 0, top = 0, bottom = 0] = raw.split(",").map((v) => Number(v) || 0);
  return { left, right, top, bottom };
}

function ohmsLawShot(search: URLSearchParams, portrait: boolean): LookShot {
  const part = search.get("shot") as BenchSlot | null;
  if (part && SLOTS.includes(part)) {
    const [x, y, z] = OHMS_LAW_LAYOUT[part].position;
    return { id: part, focus: [x, y + 0.03, z], spanM: part === "wire" ? 1.15 : 0.42 };
  }
  // A tall phone frames the apparatus only (the camera turns it up the screen); a wide screen
  // takes in more of the desk round it.
  return portrait
    ? { id: "bench", focus: [-0.02, 0, -0.05], spanM: 0.9 }
    : { id: "bench", focus: [0.06, 0, -0.02], spanM: 1.3 };
}

/** The camera's own portrait test (with its hysteresis), kept up to date as the screen turns. */
function usePortrait(covered: Covered): boolean {
  const [portrait, setPortrait] = useState(() =>
    isPortrait(covered, window.innerWidth, window.innerHeight),
  );
  useEffect(() => {
    const update = () =>
      setPortrait((was) => isPortrait(covered, window.innerWidth, window.innerHeight, was));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [covered]);
  return portrait;
}

/** `&dpr=1.5` pins the canvas at that ratio (no ladder), so a shot shows a chosen rung. */
function pinnedDpr(search: URLSearchParams): number | null {
  const raw = search.get("dpr");
  const n = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 3 ? n : null;
}

function previewState(search: URLSearchParams): OhmsLawVisualState {
  const params = paramsFromSeed(1);
  const readout = { ...createOhmsLaw(params).readout };
  const deg = search.has("deg") ? Number(search.get("deg")) : Number.NaN;
  readout.ammeterDeg = Number.isFinite(deg) ? deg : 6;
  readout.voltmeterDeg = Number.isFinite(deg) ? deg : -8;
  const joint = { tightened: true, clean: true };
  const leads: BenchLead[] =
    search.get("leads") === "0"
      ? []
      : DIAGRAM_LEADS.map(([a, b], i) => ({
          id: `L${i + 1}`,
          a,
          b,
          jointA: joint,
          jointB: joint,
          colour: COLOURS[i % COLOURS.length] ?? "red",
        }));
  return {
    readout,
    keyClosed: true,
    plugsIn: params.boxCoilsOhm.map((_, i) => i !== 3),
    leads,
    pendingFrom: null,
    pointer: new THREE.Vector3(),
    ring: null,
    highlight: null,
    hintMissing: [],
    hintExtra: [],
  };
}

function focusIds(search: URLSearchParams): Set<number> | null {
  const raw = search.get("focus");
  if (!raw) return null;
  const ids = new Set<number>();
  for (const name of raw.split(",")) {
    const base = (INK_IDS as Record<string, number>)[name];
    if (base === undefined) continue;
    // Each part owns a block of ten ids (layout.ts).
    for (let i = 0; i < 10; i++) ids.add(base + i);
  }
  return ids.size > 0 ? ids : null;
}

function OhmsLawBench({ quality, search }: { quality: QualityTier; search: URLSearchParams }) {
  const params = useMemo(() => paramsFromSeed(1), []);
  const state = useRef(previewState(search));
  const L = OHMS_LAW_LAYOUT;
  const common = { state, quality };
  return (
    <>
      {(Object.keys(BLOBS) as BenchSlot[]).flatMap((slot) => {
        const [x, y, z] = L[slot].position;
        const { dx, r } = BLOBS[slot];
        return dx.map((d) => (
          <BlobShadow key={`${slot}${d}`} position={[x + d, y, z]} radiusM={r} />
        ));
      })}
      <CellHolder {...common} position={L.cells.position} rotationY={L.cells.rotationY} />
      <KeyK {...common} position={L.key.position} rotationY={L.key.rotationY} />
      <Meter
        {...common}
        kind="ammeter"
        fullScale={params.ammeter.fullScale}
        division={params.ammeter.division}
        position={L.ammeter.position}
        rotationY={L.ammeter.rotationY}
      />
      <Meter
        {...common}
        kind="voltmeter"
        fullScale={params.voltmeter.fullScale}
        division={params.voltmeter.division}
        position={L.voltmeter.position}
        rotationY={L.voltmeter.rotationY}
      />
      <ResistanceBox
        {...common}
        coilsOhm={params.boxCoilsOhm}
        position={L.box.position}
        rotationY={L.box.rotationY}
      />
      <WireBoard
        {...common}
        wire={params.wire}
        position={L.wire.position}
        rotationY={L.wire.rotationY}
      />
      <Tray {...common} position={L.tray.position} rotationY={L.tray.rotationY} />
      {state.current.leads.map((l) => (
        <Lead key={l.id} from={l.a} to={l.b} colour={l.colour} state={state} quality={quality} />
      ))}
    </>
  );
}

// The plug box of the hero's golden question (as in the meter-bridge kit preview).
const BRIDGE_BENCH = {
  boxValuesOhm: [1, 2, 2, 5, 10],
  plugsIn: [false, true, true, true, true],
  xOhm: 3,
};
const BRIDGE_PLUG_LABELS = ["1", "2", "2", "5", "10"];
function bridgeShot(portrait: boolean): LookShot {
  return {
    id: "bench",
    focus: [0, -BRIDGE_BASE.height, -0.02],
    spanM: portrait ? 0.85 : 1.25,
  };
}

/** Contact shadows along the plank, so it sits on the desk (it is 1.1 m long, 0.15 m deep). */
const PLANK_BLOBS_X = [-0.48, -0.29, -0.1, 0.1, 0.29, 0.48];

/** What moves on the metre bridge, folded into one number, to know when shadows are stale. */
function bridgePose(v: MeterBridgeVisualState): number {
  let plugs = 0;
  for (let i = 0; i < v.plugsIn.length; i++) if (v.plugsIn[i]) plugs += 2 ** i;
  return (
    v.jockeyCm * 1e3 +
    (v.jockeyDown ? 7e5 : 0) +
    (v.keyClosed ? 3e5 : 0) +
    plugs * 1e6 +
    v.needleDeg
  );
}

function MeterBridgeBench({ shadowsDirty }: { shadowsDirty: { current: boolean } }) {
  const { visual, handlers } = useMeterBridgeEngine(BRIDGE_BENCH);
  const y = -BRIDGE_BASE.height;
  const pose = useRef(Number.NaN);
  // The jockey, plugs, key and needle cast shadows: re-render the map when any of them moves.
  useFrame(() => {
    const p = bridgePose(visual.current);
    if (p !== pose.current) {
      pose.current = p;
      shadowsDirty.current = true;
    }
  });
  return (
    <>
      {PLANK_BLOBS_X.map((x) => (
        <BlobShadow key={x} position={[x, y, 0.004]} radiusM={0.115} opacity={0.3} />
      ))}
      <MeterBridgeKit
        state={visual}
        plugLabels={BRIDGE_PLUG_LABELS}
        unknownLabel="X"
        quality="high"
        onWireTap={handlers.onWireTap}
        onWireDrag={handlers.onWireDrag}
        onPlugToggle={handlers.onPlugToggle}
        onKeyToggle={handlers.onKeyToggle}
      />
    </>
  );
}

function Ladder({ ladder, enabled }: { ladder: DprLadder; enabled: boolean }) {
  useDprLadder(ladder, enabled);
  return null;
}

function Focus({ ids }: { ids: Set<number> | null }) {
  const focus = useMemo(() => ({ ids }), [ids]);
  useInkFocus(focus);
  return null;
}

export default function LookPreview() {
  const search = useMemo(() => new URLSearchParams(location.search), []);
  const which = search.get("look") === "meter-bridge" ? "meter-bridge" : "ohms-law";
  const quality: QualityTier = parseOverride(location.search) ?? "high";
  const pinned = useMemo(() => pinnedDpr(search), [search]);
  const look = useMemo(() => {
    const l = lookFor(quality, window.devicePixelRatio || 1);
    return pinned === null ? l : { ...l, dprLadder: [pinned] };
  }, [quality, pinned]);
  const covered = useMemo(() => parseCovered(search.get("covered")), [search]);
  const portrait = usePortrait(covered);
  const shot = useMemo(
    () => (which === "ohms-law" ? ohmsLawShot(search, portrait) : bridgeShot(portrait)),
    [which, search, portrait],
  );
  const shadowsDirty = useRef(true);
  const reducedMotion = useMemo(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }, []);

  const focus = useMemo(() => (which === "ohms-law" ? focusIds(search) : null), [search, which]);
  // The ladder lives outside the Canvas, so a re-render keeps its rung (dprLadder.ts).
  const ladder = useMemo(() => createDprLadder(look.dprLadder), [look]);
  const dpr = useLadderDpr(ladder);

  return (
    <Canvas
      shadows={look.shadowMapSize > 0 ? "percentage" : false}
      dpr={dpr}
      gl={{ antialias: true }}
    >
      <LookTier.Provider value={quality}>
        <LookCamera
          shot={shot}
          covered={covered}
          drag={search.get("drag") === "1"}
          reducedMotion={reducedMotion}
        />
        <LookLights shadowsDirty={shadowsDirty} />
        {which === "ohms-law" ? (
          <>
            <LookGround />
            <TerminalProvider>
              <OhmsLawBench quality={quality} search={search} />
            </TerminalProvider>
          </>
        ) : (
          <>
            <group position-y={-BRIDGE_BASE.height}>
              <LookGround />
            </group>
            <MeterBridgeBench shadowsDirty={shadowsDirty} />
          </>
        )}
        <InkComposer quality={quality} />
        <Focus ids={focus} />
        <Ladder ladder={ladder} enabled={pinned === null && search.get("ladder") !== "0"} />
        <ReadySignal />
      </LookTier.Provider>
    </Canvas>
  );
}
