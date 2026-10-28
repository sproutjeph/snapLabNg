import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { createOhmsLaw, DIAGRAM_LEADS, paramsFromSeed } from "@snaplab/engine";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TerminalProvider } from "../../learn/terminals";
import type { BenchLead, LeadColour, OhmsLawVisualState } from "../../learn/types";
import { InkComposer } from "../../scene/ink/InkComposer";
import { InkLights } from "../../scene/ink/InkLights";
import { PaperDesk } from "../../scene/ink/PaperDesk";
import { ReadySignal } from "../../scene/ReadySignal";
import type { QualityTier } from "../meter-bridge/types";
import { CellHolder } from "./CellHolder";
import { KeyK } from "./Key";
import { Lead } from "./Lead";
import { type BenchSlot, OHMS_LAW_LAYOUT } from "./layout";
import { Meter } from "./Meter";
import { ResistanceBox } from "./ResistanceBox";
import { Tray } from "./Tray";
import { WireBoard } from "./WireBoard";

// ?kit=ohms-law — every V–I part on the bench, for the apparatus slices' screenshots.
//   &part=ammeter|voltmeter|cells|key|box|wire|tray  frames one part
//   &leads=1                                         adds the seven diagram leads
//   &deg=<n>                                         sets both needles to n degrees
//   &quality=low|mid|high
// Lead-owned (Wave 0): slices fill in the parts, not this file.

const COLOURS: LeadColour[] = ["red", "black", "yellow"];
const SLOTS = Object.keys(OHMS_LAW_LAYOUT) as BenchSlot[];

function previewState(search: URLSearchParams): OhmsLawVisualState {
  const params = paramsFromSeed(1);
  const readout = { ...createOhmsLaw(params).readout };
  const deg = Number(search.get("deg"));
  if (search.has("deg") && Number.isFinite(deg)) {
    readout.ammeterDeg = deg;
    readout.voltmeterDeg = deg;
  }
  const joint = { tightened: true, clean: true };
  const leads: BenchLead[] =
    search.get("leads") === "1"
      ? DIAGRAM_LEADS.map(([a, b], i) => ({
          id: `L${i + 1}`,
          a,
          b,
          jointA: joint,
          jointB: joint,
          colour: COLOURS[i % COLOURS.length] ?? "red",
        }))
      : [];
  return {
    readout,
    keyClosed: false,
    plugsIn: params.boxCoilsOhm.map(() => true),
    leads,
    pendingFrom: null,
    pointer: new THREE.Vector3(),
    ring: null,
    highlight: null,
    hintMissing: [],
    hintExtra: [],
  };
}

/** Keeps the whole bench (or the framed part) in view on a tall phone screen. */
function FrameRig({
  camera: base,
  target,
}: {
  camera: readonly [number, number, number];
  target: readonly [number, number, number];
}) {
  const camera = useThree((st) => st.camera);
  const width = useThree((st) => st.size.width);
  const height = useThree((st) => st.size.height);
  useEffect(() => {
    const aspect = width / Math.max(height, 1);
    const k = aspect < 1 ? Math.min(2.2, 0.85 / aspect) : 1;
    camera.position.set(
      target[0] + (base[0] - target[0]) * k,
      target[1] + (base[1] - target[1]) * k,
      target[2] + (base[2] - target[2]) * k,
    );
    camera.lookAt(target[0], target[1], target[2]);
  }, [camera, base, target, width, height]);
  return null;
}

function Bench({ quality, search }: { quality: QualityTier; search: URLSearchParams }) {
  const params = useMemo(() => paramsFromSeed(1), []);
  const state = useRef(previewState(search));
  const L = OHMS_LAW_LAYOUT;
  const common = { state, quality };
  return (
    <>
      <PaperDesk quality={quality} />
      <CellHolder {...common} position={L.cells.position} rotationY={L.cells.rotationY} />
      <KeyK
        {...common}
        position={L.key.position}
        rotationY={L.key.rotationY}
        onToggle={() => {
          state.current.keyClosed = !state.current.keyClosed;
        }}
      />
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
        onPlugToggle={(i) => {
          const p = state.current.plugsIn;
          p[i] = !p[i];
        }}
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

export default function KitPreview() {
  const search = new URLSearchParams(location.search);
  const q = search.get("quality");
  const quality: QualityTier = q === "low" || q === "mid" ? q : "high";
  const part = search.get("part") as BenchSlot | null;
  const focus = part && SLOTS.includes(part) ? OHMS_LAW_LAYOUT[part].position : null;
  const target: [number, number, number] = focus ? [focus[0], 0.03, focus[2]] : [0, 0, -0.05];
  const camera: [number, number, number] = focus
    ? [focus[0], 0.22, focus[2] + 0.32]
    : [0, 0.95, 1.05];
  return (
    <Canvas
      shadows="percentage"
      dpr={quality === "low" ? 1 : [1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 40, position: camera, near: 0.02, far: 20 }}
    >
      <InkLights quality={quality} />
      <FrameRig camera={camera} target={target} />
      <OrbitControls target={target} makeDefault />
      <TerminalProvider>
        <Bench quality={quality} search={search} />
      </TerminalProvider>
      <InkComposer quality={quality} />
      <ReadySignal />
    </Canvas>
  );
}
