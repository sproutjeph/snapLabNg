import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { createOhmsLaw, DIAGRAM_LEADS, paramsFromSeed } from "@snaplab/engine";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TerminalProvider } from "../../learn/terminals";
import type { BenchLead, LeadColour, OhmsLawVisualState, TerminalId } from "../../learn/types";
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
import { PenNib } from "./PenNib";
import { ResistanceBox } from "./ResistanceBox";
import { Tray } from "./Tray";
import { WireBoard } from "./WireBoard";

// ?kit=ohms-law — every V–I part on the bench, for the apparatus slices' screenshots.
//   &part=ammeter|voltmeter|cells|key|box|wire|tray  frames one part
//   &leads=1                                         adds the seven diagram leads
//   &deg=<n>                                         sets both needles to n degrees
//   &drawn=<0..1>                                    how much of each lead is drawn on
//   &pen=<terminal id>                               puts the Watch pen nib on that terminal
//   &az=<deg>                                        camera azimuth (default -45)
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

const EL = (41 * Math.PI) / 180;
const FOV = 12;

/**
 * An isometric-style view: a narrow field of view from far away looks the way the lab's
 * orthographic camera does (azimuth `azDeg`, elevation 41 degrees), and `spanM` of the bench
 * fits across whichever of width and height is tighter.
 */
function FrameRig({
  target,
  spanM,
  azDeg,
}: {
  target: readonly [number, number, number];
  spanM: number;
  azDeg: number;
}) {
  const camera = useThree((st) => st.camera);
  const width = useThree((st) => st.size.width);
  const height = useThree((st) => st.size.height);
  useEffect(() => {
    const aspect = width / Math.max(height, 1);
    const t = Math.tan((FOV * Math.PI) / 360);
    // spanM across the width, and about 0.62 of it tall on screen (the bench is wider than deep).
    const dW = spanM / (2 * t * Math.max(aspect, 0.2));
    const dH = (spanM * 0.62) / (2 * t);
    const d = Math.max(dW, dH);
    const az = (azDeg * Math.PI) / 180;
    camera.position.set(
      target[0] + d * Math.sin(az) * Math.cos(EL),
      target[1] + d * Math.sin(EL),
      target[2] + d * Math.cos(az) * Math.cos(EL),
    );
    camera.lookAt(target[0], target[1], target[2]);
    camera.near = Math.max(0.05, d - 2.5);
    camera.far = d + 3;
    camera.updateProjectionMatrix();
  }, [camera, target, spanM, azDeg, width, height]);
  return null;
}

function Bench({ quality, search }: { quality: QualityTier; search: URLSearchParams }) {
  const params = useMemo(() => paramsFromSeed(1), []);
  const state = useRef(previewState(search));
  const L = OHMS_LAW_LAYOUT;
  const common = { state, quality };
  const drawnParam = Number(search.get("drawn"));
  const drawn = search.has("drawn") && Number.isFinite(drawnParam) ? drawnParam : 1;
  const pen = search.get("pen") as TerminalId | null;
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
        <Lead
          key={l.id}
          from={l.a}
          to={l.b}
          colour={l.colour}
          state={state}
          quality={quality}
          drawn={drawn}
        />
      ))}
      {pen ? <PenNib target={pen} quality={quality} /> : null}
    </>
  );
}

export default function KitPreview() {
  const search = new URLSearchParams(location.search);
  const q = search.get("quality");
  const quality: QualityTier = q === "low" || q === "mid" ? q : "high";
  const part = search.get("part") as BenchSlot | null;
  const focus = part && SLOTS.includes(part) ? OHMS_LAW_LAYOUT[part].position : null;
  const target: [number, number, number] = focus ? [focus[0], 0.03, focus[2]] : [0, 0.02, -0.12];
  const spanM = focus ? (part === "wire" ? 0.7 : part === "tray" ? 0.4 : 0.3) : 1.3;
  const azParam = Number(search.get("az"));
  const azDeg = search.has("az") && Number.isFinite(azParam) ? azParam : -45;
  return (
    <Canvas
      shadows="percentage"
      dpr={quality === "low" ? 1 : [1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: FOV, position: [0, 4, 4], near: 1, far: 40 }}
    >
      <InkLights quality={quality} />
      <FrameRig target={target} spanM={spanM} azDeg={azDeg} />
      <OrbitControls target={target} makeDefault enableDamping={false} />
      <TerminalProvider>
        <Bench quality={quality} search={search} />
      </TerminalProvider>
      <InkComposer quality={quality} />
      <ReadySignal />
    </Canvas>
  );
}
