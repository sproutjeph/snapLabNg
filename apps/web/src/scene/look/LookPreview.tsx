import { Canvas, useFrame } from "@react-three/fiber";
import { createOhmsLaw, DIAGRAM_LEADS, paramsFromSeed } from "@snaplab/engine";
import { useMemo, useRef } from "react";
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
import { LookCamera } from "./LookCamera";
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

const COLOURS: LeadColour[] = ["red", "black", "yellow"];
const SLOTS = Object.keys(OHMS_LAW_LAYOUT) as BenchSlot[];
const NO_COVER: Covered = { left: 0, right: 0, top: 0, bottom: 0 };

/** Blob radius under each V–I part, in metres. The wire board gets a row of blobs. */
const BLOB_RADIUS: Readonly<Record<Exclude<BenchSlot, "wire">, number>> = {
  cells: 0.13,
  key: 0.09,
  ammeter: 0.13,
  voltmeter: 0.13,
  box: 0.26,
  tray: 0.24,
};

function parseCovered(raw: string | null): Covered {
  if (!raw) return NO_COVER;
  const [left = 0, right = 0, top = 0, bottom = 0] = raw.split(",").map((v) => Number(v) || 0);
  return { left, right, top, bottom };
}

function ohmsLawShot(search: URLSearchParams): LookShot {
  const part = search.get("shot") as BenchSlot | null;
  if (part && SLOTS.includes(part)) {
    const [x, y, z] = OHMS_LAW_LAYOUT[part].position;
    return { id: part, focus: [x, y + 0.03, z], spanM: part === "wire" ? 1.15 : 0.42 };
  }
  // A tall phone frames the apparatus only, turned so the bench runs up the screen; a wide
  // screen takes in the desk props too.
  return portrait()
    ? { id: "bench", focus: [0.04, 0, -0.17], spanM: 1.36, azimuthDeg: 66 }
    : { id: "bench", focus: [0.06, 0, -0.02], spanM: 1.3 };
}

function portrait(): boolean {
  return window.innerWidth < window.innerHeight;
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
  const wire = L.wire.position;
  return (
    <>
      {(Object.keys(BLOB_RADIUS) as (keyof typeof BLOB_RADIUS)[]).map((slot) => (
        <BlobShadow key={slot} position={L[slot].position} radiusM={BLOB_RADIUS[slot]} />
      ))}
      {[-0.42, -0.21, 0, 0.21, 0.42].map((dx) => (
        <BlobShadow key={dx} position={[wire[0] + dx, wire[1], wire[2]]} radiusM={0.15} />
      ))}
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
      <WireBoard {...common} wire={params.wire} position={wire} rotationY={L.wire.rotationY} />
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
function bridgeShot(): LookShot {
  return {
    id: "bench",
    focus: [0, -BRIDGE_BASE.height, -0.02],
    ...(portrait() ? { spanM: 0.95, azimuthDeg: 66 } : { spanM: 1.25 }),
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
  const look = useMemo(() => lookFor(quality, window.devicePixelRatio || 1), [quality]);
  const shot = useMemo(
    () => (which === "ohms-law" ? ohmsLawShot(search) : bridgeShot()),
    [which, search],
  );
  const covered = parseCovered(search.get("covered"));
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
        <Ladder ladder={ladder} enabled={search.get("ladder") !== "0"} />
        <ReadySignal />
      </LookTier.Provider>
    </Canvas>
  );
}
