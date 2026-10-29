import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  createOhmsLaw,
  DIAGRAM_LEADS,
  paramsFromSeed,
  TERMINAL_IDS,
  type TerminalId,
} from "@snaplab/engine";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createTerminalRegistry } from "../../learn/terminalRegistry";
import { TerminalProvider, useTerminalRegistry } from "../../learn/terminals";
import type {
  BenchLead,
  LeadColour,
  OhmsLawVisualState,
  TerminalRegistry,
} from "../../learn/types";
import { lookFor } from "../../quality/tier";
import { InkComposer } from "../../scene/ink/InkComposer";
import { useInkFocus } from "../../scene/ink/inkFocus";
import { BlobShadow } from "../../scene/look/BlobShadow";
import { createDprLadder, type DprLadder } from "../../scene/look/dprLadder";
import { LookCamera } from "../../scene/look/LookCamera";
import { LookGround } from "../../scene/look/LookGround";
import { LookLights } from "../../scene/look/LookLights";
import { LookTier } from "../../scene/look/lookTier";
import { useDprLadder, useLadderDpr } from "../../scene/look/useDprLadder";
import { ReadySignal } from "../../scene/ReadySignal";
import type { QualityTier } from "../meter-bridge/types";
import { CellHolder } from "./CellHolder";
import { KeyK } from "./Key";
import {
  type Bounds,
  type Extents,
  fillZoom,
  type KitParams,
  type KitPlan,
  type KitShot,
  kitCovered,
  MACRO_LIFT_M,
  macroFreeEnd,
  parseKitParams,
  planKit,
  referenceFile,
  SLOT_SUBJECTS,
  screenExtents,
  shotFor,
  terminalPositions,
  turnAzimuth,
} from "./kitParams";
import { Lead } from "./Lead";
import { type BenchSlot, OHMS_LAW_LAYOUT } from "./layout";
import { Meter } from "./Meter";
import { PenNib } from "./PenNib";
import { ResistanceBox } from "./ResistanceBox";
import { Tray } from "./Tray";
import { WireBoard } from "./WireBoard";

// ?kit=ohms-law — the V–I parts in the real look, for the apparatus slices' shots and for the
// user's look in Chrome (docs/plans/asset-pass.md, "The seam"). The look is mounted as the
// learn pages will mount it: LookTier, LookCamera (orthographic, azimuth 45 and elevation 41 on
// every screen), LookLights, LookGround, BlobShadow under each part, InkComposer.
//   &part=ammeter|voltmeter|cells|key|box|wire|tray   one part, alone on the paper
//   &part=leads                                       the seven leads over their parts, faded
//   &part=terminal&id=A%2B                            a macro of one nut with a plug seated in it
//   &part=desk                                        the desk things alone
//   (no part)                                         the whole bench and the desk things
//   &az=<deg>                                         camera azimuth (default 45, the golden frame's)
//   &zoom=<1..4>                                      this much tighter than the fitted view
//   &turn=1                                           sweeps the azimuth ±30° about az, 8 s a round
//   &dpr=<1..3>                                       pins the canvas pixel ratio (no ladder)
//   &dump=1                                           logs the 12 terminal world positions as JSON
//   &ref=1                                            the part's reference image beside the canvas
//                                                     (dev server only; not in a build)
//   &leads=1                                          adds the seven diagram leads
//   &drawn=<0..1>                                     how much of each lead is drawn on
//   &deg=<n>                                          sets both needles to n degrees
//   &pen=<terminal id>                                puts the Watch pen nib on that terminal
//   &quality=low|mid|high
// Every subject is fitted so that it fills about three quarters of the frame, on a phone and on a
// laptop. The other parts are mounted but hidden, so the shot is the part alone, as in its
// reference image; with leads= or pen= on one part the whole bench is drawn instead, and only
// that part (and the leads) keep full ink. The key starts closed (tap it to open it) and every
// plug of the box in. Drag turns the camera a little, as on the real pages. A plus in an id is
// %2B in a URL; a typed "A+" reaches the page as "A " and is read as A+ too. The pure parts
// (parameters, what is mounted, the shot) are in kitParams.ts.

const COLOURS: LeadColour[] = ["red", "black", "yellow"];
/** Frames the camera snaps to its shot (the focus of a macro is found only once the nut mounts). */
const SETTLE_FRAMES = 12;
/** Frames the shadow map is redrawn after a tap on the key or a plug (they move for a moment). */
const SHADOW_KICK_FRAMES = 45;
/** Frame at which the terminal dump is taken, after the ready signal's second frame. */
const DUMP_FRAME = 4;
const DUMP_GIVE_UP_FRAME = 240;

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

/** A + terminal takes a red lead, a − terminal a black one, the others a yellow one. */
function macroColour(id: TerminalId): LeadColour {
  return id.endsWith("+") ? "red" : id.endsWith("-") ? "black" : "yellow";
}

function previewState(p: KitParams, plan: KitPlan): OhmsLawVisualState {
  const params = paramsFromSeed(1);
  const readout = { ...createOhmsLaw(params).readout };
  if (p.deg !== null) {
    readout.ammeterDeg = p.deg;
    readout.voltmeterDeg = p.deg;
  }
  const joint = { tightened: true, clean: true };
  const leads: BenchLead[] = plan.leads
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
    // Closed, as in the look page and the key's reference image (tap the key to open it).
    keyClosed: true,
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

/**
 * The look's camera with a shot fitted to the subject. LookCamera fits the shot's patch of desk
 * to the screen; after its frame this zooms the orthographic camera in until the subject itself
 * fills KIT_FILL of the free area (times `zoom`), whatever its shape and the screen's. It snaps
 * to the shot for its first frames (a macro's focus arrives a frame late, and the shots wait for
 * the first frames), then eases and lets her drag, like the real pages. `turn` sweeps the shot's
 * azimuth, and the fit follows it. The covered strip keeps LookCamera on its 41° view on a tall
 * phone.
 */
function KitCamera({
  shot,
  bounds,
  azDeg,
  turn,
  zoom,
}: {
  shot: KitShot;
  bounds: Bounds;
  azDeg: number;
  turn: boolean;
  zoom: number;
}) {
  const { width, height } = useThree((s) => s.size);
  const covered = useMemo(() => kitCovered(width, height), [width, height]);
  const [settled, setSettled] = useState(false);
  const frames = useRef(0);
  const extents = useMemo<Extents>(() => ({ right: 0, up: 0 }), []);
  // Before LookCamera's own frame (priority -1), so it follows this frame's azimuth.
  useFrame((state) => {
    if (turn) shot.azimuthDeg = turnAzimuth(azDeg, state.clock.elapsedTime);
    if (frames.current < SETTLE_FRAMES) {
      frames.current += 1;
      if (frames.current === SETTLE_FRAMES) setSettled(true);
    }
  }, -2);
  // After it: LookCamera has just written the frustum that fits its patch (at zoom 1).
  useFrame((state) => {
    const cam = state.camera as THREE.OrthographicCamera;
    if (!cam.isOrthographicCamera) return;
    screenExtents(bounds, shot.azimuthDeg, extents);
    const halfW = (cam.right - cam.left) / 2;
    const halfH = (cam.top - cam.bottom) / 2;
    const z = zoom * fillZoom(extents, halfW, halfH, covered, state.size.width, state.size.height);
    if (Math.abs(cam.zoom - z) > 1e-6) {
      cam.zoom = z;
      cam.updateProjectionMatrix();
    }
  });
  return <LookCamera shot={shot} covered={covered} drag reducedMotion={!settled} />;
}

/**
 * `part=terminal`: aims the shot at the nut once it is mounted, and puts the lead's free plug out
 * past the edge of the canvas (macroFreeEnd), so the shot shows the nut, its plug and the cable
 * leaving, not a plug held in the air, and no cable lifted over a part the shot hides.
 */
function MacroAim({
  id,
  shot,
  state,
}: {
  id: TerminalId;
  shot: KitShot;
  state: { current: OhmsLawVisualState };
}) {
  const registry = useTerminalRegistry();
  const at = useMemo(() => new THREE.Vector3(), []);
  const aimed = useRef(false);
  useFrame(() => {
    if (!registry.worldPosition(id, at)) return;
    shot.focus[0] = at.x;
    shot.focus[1] = at.y + MACRO_LIFT_M;
    shot.focus[2] = at.z;
    if (aimed.current) return;
    aimed.current = true;
    // The cable leaves by this nut's own heading, clear of the parts the shot hides.
    macroFreeEnd(id, at, state.current.pointer);
  }, -2);
  return null;
}

function allMounted(registry: TerminalRegistry): boolean {
  for (const id of TERMINAL_IDS) if (!registry.get(id)) return false;
  return true;
}

/**
 * `dump=1`: one console line of JSON, the terminals' world positions, once they are all mounted.
 * The frame only decides when; the line is built after it, in an effect.
 */
function DumpTerminals({ registry }: { registry: TerminalRegistry }) {
  const frames = useRef(0);
  const [ready, setReady] = useState(false);
  useFrame(() => {
    if (ready) return;
    frames.current += 1;
    if (frames.current < DUMP_FRAME) return;
    if (frames.current < DUMP_GIVE_UP_FRAME && !allMounted(registry)) return;
    setReady(true);
  });
  useEffect(() => {
    if (ready) console.log(JSON.stringify(terminalPositions(registry)));
  }, [ready, registry]);
  return null;
}

/**
 * The desk things sit in LookGround (scene/look/DeskProps.tsx names their group "DeskProps"); they
 * are shown only where the subject is the desk or the whole bench, and hidden for a part alone.
 */
function DeskVisibility({ show }: { show: boolean }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const desk = scene.getObjectByName("DeskProps");
    if (!desk) {
      if (!show)
        console.warn("kit: no DeskProps group in the scene, so the desk things stay in view");
      return;
    }
    desk.visible = show;
    return () => {
      desk.visible = true;
    };
  }, [scene, show]);
  return null;
}

function Focus({ ids }: { ids: ReadonlySet<number> | null }) {
  const focus = useMemo(() => ({ ids }), [ids]);
  useInkFocus(focus);
  return null;
}

function Ladder({ ladder, enabled }: { ladder: DprLadder; enabled: boolean }) {
  useDprLadder(ladder, enabled);
  return null;
}

/** Keeps the shadow map fresh for a moment after a tap moved the key or a plug. */
function ShadowKick({
  kick,
  shadowsDirty,
}: {
  kick: { current: number };
  shadowsDirty: { current: boolean };
}) {
  useFrame(() => {
    if (kick.current <= 0) return;
    kick.current -= 1;
    shadowsDirty.current = true;
  });
  return null;
}

function Bench({
  plan,
  p,
  state,
  quality,
  kick,
}: {
  plan: KitPlan;
  p: KitParams;
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  kick: { current: number };
}) {
  const params = useMemo(() => paramsFromSeed(1), []);
  const L = OHMS_LAW_LAYOUT;
  const common = { state, quality };
  const on = plan.parts;
  return (
    <>
      {SLOT_SUBJECTS.filter((slot) => on[slot]).flatMap((slot) => {
        const [x, y, z] = L[slot].position;
        const { dx, r } = BLOBS[slot];
        return dx.map((d) => (
          <BlobShadow key={`${slot}${d}`} position={[x + d, y, z]} radiusM={r} />
        ));
      })}
      {/* Every part stays mounted, so all twelve terminals are registered; a hidden part draws nothing. */}
      <group visible={on.cells}>
        <CellHolder {...common} position={L.cells.position} rotationY={L.cells.rotationY} />
      </group>
      <group visible={on.key}>
        <KeyK
          {...common}
          position={L.key.position}
          rotationY={L.key.rotationY}
          onToggle={() => {
            state.current.keyClosed = !state.current.keyClosed;
            kick.current = SHADOW_KICK_FRAMES;
          }}
        />
      </group>
      <group visible={on.ammeter}>
        <Meter
          {...common}
          kind="ammeter"
          fullScale={params.ammeter.fullScale}
          division={params.ammeter.division}
          position={L.ammeter.position}
          rotationY={L.ammeter.rotationY}
        />
      </group>
      <group visible={on.voltmeter}>
        <Meter
          {...common}
          kind="voltmeter"
          fullScale={params.voltmeter.fullScale}
          division={params.voltmeter.division}
          position={L.voltmeter.position}
          rotationY={L.voltmeter.rotationY}
        />
      </group>
      <group visible={on.box}>
        <ResistanceBox
          {...common}
          coilsOhm={params.boxCoilsOhm}
          position={L.box.position}
          rotationY={L.box.rotationY}
          onPlugToggle={(i) => {
            const plugs = state.current.plugsIn;
            plugs[i] = !plugs[i];
            kick.current = SHADOW_KICK_FRAMES;
          }}
        />
      </group>
      <group visible={on.wire}>
        <WireBoard
          {...common}
          wire={params.wire}
          position={L.wire.position}
          rotationY={L.wire.rotationY}
        />
      </group>
      <group visible={on.tray}>
        <Tray {...common} position={L.tray.position} rotationY={L.tray.rotationY} />
      </group>
      {state.current.leads.map((l) => (
        <Lead
          key={l.id}
          from={l.a}
          to={l.b}
          colour={l.colour}
          state={state}
          quality={quality}
          drawn={p.drawn}
        />
      ))}
      {plan.macro ? (
        <Lead
          from={plan.macro}
          to="pointer"
          colour={macroColour(plan.macro)}
          state={state}
          quality={quality}
        />
      ) : null}
      {p.pen ? <PenNib target={p.pen} quality={quality} /> : null}
    </>
  );
}

/**
 * `ref=1` (dev server only): the subject's reference image (docs/design/asset-pass/<name>.webp)
 * to the right of the canvas, so the shot and the target are compared on one screen. The images
 * are found by a glob that only the dev server runs (`import.meta.env.DEV`), so no build
 * carries them.
 */
const REFERENCES: Readonly<Record<string, () => Promise<string>>> = import.meta.env.DEV
  ? import.meta.glob<string>("../../../../../docs/design/asset-pass/*.webp", {
      query: "?url",
      import: "default",
    })
  : {};

function ReferenceBeside({
  subject,
  children,
}: {
  subject: KitParams["subject"];
  children: ReactNode;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const file = subject ? referenceFile(subject) : null;
  useEffect(() => {
    setSrc(null);
    const load = Object.entries(REFERENCES).find(([path]) => file && path.endsWith(`/${file}`));
    if (!load) return;
    let live = true;
    load[1]().then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [file]);
  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <div style={{ flex: "1 1 0", minWidth: 0, position: "relative" }}>{children}</div>
      <aside
        style={{
          flex: "0 0 40%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4ecdc",
          borderLeft: "2px solid #1d2430",
          font: "13px/1.4 ui-monospace, monospace",
          color: "#1d2430",
          padding: 8,
          boxSizing: "border-box",
        }}
      >
        {src ? (
          <img
            src={src}
            alt={`Reference for the ${subject ?? "bench"}: ${file ?? ""}`}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        ) : (
          <p>
            {file ? `No reference image yet: ${file}` : "The whole bench has no reference image."}
          </p>
        )}
      </aside>
    </div>
  );
}

export default function KitPreview() {
  const p = useMemo(() => parseKitParams(location.search), []);
  const plan = useMemo(() => planKit(p), [p]);
  const { quality } = p;
  // The look's pixel-ratio ladder, as the real pages run it; `dpr` pins one rung and stops it.
  const look = useMemo(() => {
    const l = lookFor(quality, window.devicePixelRatio || 1);
    return p.dpr === null ? l : { ...l, dprLadder: [p.dpr] };
  }, [quality, p.dpr]);
  const ladder = useMemo(() => createDprLadder(look.dprLadder), [look]);
  const dpr = useLadderDpr(ladder);
  const registry = useMemo(createTerminalRegistry, []);
  const state = useMemo(() => ({ current: previewState(p, plan) }), [p, plan]);
  // One shot, fitted once; KitCamera and MacroAim move its azimuth and focus in place.
  const shot = useMemo(() => shotFor(plan.bounds, p.azDeg, p.subject ?? "bench"), [plan, p]);
  const shadowsDirty = useRef(true);
  const kick = useRef(0);
  const canvas = (
    <Canvas
      shadows={look.shadowMapSize > 0 ? "percentage" : false}
      dpr={dpr}
      gl={{ antialias: true }}
    >
      <LookTier.Provider value={quality}>
        <KitCamera shot={shot} bounds={plan.bounds} azDeg={p.azDeg} turn={p.turn} zoom={p.zoom} />
        <LookLights shadowsDirty={shadowsDirty} />
        <LookGround />
        <DeskVisibility show={plan.desk} />
        <TerminalProvider registry={registry}>
          <Bench plan={plan} p={p} state={state} quality={quality} kick={kick} />
          {plan.macro ? <MacroAim id={plan.macro} shot={shot} state={state} /> : null}
        </TerminalProvider>
        <ShadowKick kick={kick} shadowsDirty={shadowsDirty} />
        <InkComposer quality={quality} />
        <Focus ids={plan.focusIds} />
        <Ladder ladder={ladder} enabled={p.dpr === null} />
        {p.dump ? <DumpTerminals registry={registry} /> : null}
        <ReadySignal />
      </LookTier.Provider>
    </Canvas>
  );
  // `ref=1` is for the dev server only: a build drops this branch and the images with it.
  if (import.meta.env.DEV && p.ref)
    return <ReferenceBeside subject={p.subject}>{canvas}</ReferenceBeside>;
  return canvas;
}
