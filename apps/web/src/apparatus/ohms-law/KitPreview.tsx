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
import { BENCH_FOOTPRINTS } from "./LeadParts";
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
    search.get("leads") === "1" || search.has("drawn")
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

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Top of the tallest part, metres. */
  h: number;
}

const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * An isometric-style view: a narrow field of view from far away looks the way the lab's
 * orthographic camera does (azimuth `azDeg`, elevation 41 degrees). The camera looks at the
 * middle of how `box` projects on the screen and backs off until that projection fits both the
 * width and the height with a small margin, so a phone and a laptop both fill their frames.
 */
function FrameRig({ rects, azDeg }: { rects: readonly Box[]; azDeg: number }) {
  const camera = useThree((st) => st.camera);
  const width = useThree((st) => st.size.width);
  const height = useThree((st) => st.size.height);
  const controls = useThree((st) => st.controls) as unknown as {
    target: THREE.Vector3;
    update(): void;
  } | null;
  useEffect(() => {
    const aspect = width / Math.max(height, 1);
    const t = Math.tan((FOV * Math.PI) / 360);
    const az = (azDeg * Math.PI) / 180;
    // The camera looks along -f; r is screen right and u is screen up.
    _f.set(-Math.sin(az) * Math.cos(EL), -Math.sin(EL), -Math.cos(az) * Math.cos(EL));
    _r.set(Math.cos(az), 0, -Math.sin(az));
    _u.crossVectors(_r, _f).negate();
    const cx = (Math.min(...rects.map((r) => r.x0)) + Math.max(...rects.map((r) => r.x1))) / 2;
    const cz = (Math.min(...rects.map((r) => r.z0)) + Math.max(...rects.map((r) => r.z1))) / 2;
    let rMin = Number.POSITIVE_INFINITY;
    let rMax = Number.NEGATIVE_INFINITY;
    let uMin = Number.POSITIVE_INFINITY;
    let uMax = Number.NEGATIVE_INFINITY;
    for (const box of rects) {
      for (const x of [box.x0, box.x1]) {
        for (const z of [box.z0, box.z1]) {
          for (const y of [0, box.h]) {
            _p.set(x - cx, y, z - cz);
            const pr = _p.dot(_r);
            const pu = _p.dot(_u);
            rMin = Math.min(rMin, pr);
            rMax = Math.max(rMax, pr);
            uMin = Math.min(uMin, pu);
            uMax = Math.max(uMax, pu);
          }
        }
      }
    }
    const margin = 1.08;
    const d = Math.max(
      ((rMax - rMin) / 2 / (t * aspect)) * margin,
      ((uMax - uMin) / 2 / t) * margin,
    );
    // Look at the middle of the projection, not of the footprint.
    const tx = cx + _r.x * ((rMin + rMax) / 2) + _u.x * ((uMin + uMax) / 2);
    const ty = _r.y * ((rMin + rMax) / 2) + _u.y * ((uMin + uMax) / 2);
    const tz = cz + _r.z * ((rMin + rMax) / 2) + _u.z * ((uMin + uMax) / 2);
    camera.position.set(
      tx + d * Math.sin(az) * Math.cos(EL),
      ty + d * Math.sin(EL),
      tz + d * Math.cos(az) * Math.cos(EL),
    );
    camera.lookAt(tx, ty, tz);
    if (controls) {
      controls.target.set(tx, ty, tz);
      controls.update();
    }
    camera.near = Math.max(0.05, d - 2.5);
    camera.far = d + 3;
    camera.updateProjectionMatrix();
  }, [camera, controls, rects, azDeg, width, height]);
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

/** The footprints the shot has to fit: every part of the bench, or one part with a little room. */
function shotRects(part: BenchSlot | null): Box[] {
  if (!part || !SLOTS.includes(part)) {
    // Each part's footprint, with 6 cm on top for nuts and plugs.
    return BENCH_FOOTPRINTS.map((f) => ({
      x0: f.cx - f.hx,
      x1: f.cx + f.hx,
      z0: f.cz - f.hz,
      z1: f.cz + f.hz,
      h: f.top + 0.06,
    }));
  }
  const [x, , z] = OHMS_LAW_LAYOUT[part].position;
  const w = part === "wire" ? 0.42 : part === "tray" ? 0.18 : 0.14;
  const d = part === "wire" ? 0.1 : part === "tray" ? 0.2 : 0.1;
  return [{ x0: x - w, x1: x + w, z0: z - d, z1: z + d, h: 0.1 }];
}

export default function KitPreview() {
  const search = new URLSearchParams(location.search);
  const q = search.get("quality");
  const quality: QualityTier = q === "low" || q === "mid" ? q : "high";
  const part = search.get("part") as BenchSlot | null;
  const rects = useMemo(() => shotRects(part), [part]);
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
      <FrameRig rects={rects} azDeg={azDeg} />
      <OrbitControls makeDefault enableDamping={false} />
      <TerminalProvider>
        <Bench quality={quality} search={search} />
      </TerminalProvider>
      <InkComposer quality={quality} />
      <ReadySignal />
    </Canvas>
  );
}
