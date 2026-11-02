import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  createOhmsLaw,
  DIAGRAM_LEADS,
  METER_FULL_DEG,
  METER_ZERO_DEG,
  paramsFromSeed,
} from "@snaplab/engine";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import type { QualityTier } from "../apparatus/meter-bridge/types";
import { CellHolder } from "../apparatus/ohms-law/CellHolder";
import { KeyK } from "../apparatus/ohms-law/Key";
import {
  type Bounds,
  type Extents,
  fillZoom,
  parseKitParams,
  planKit,
  screenExtents,
  shotFor,
} from "../apparatus/ohms-law/kitParams";
import { Lead } from "../apparatus/ohms-law/Lead";
import { OHMS_LAW_LAYOUT } from "../apparatus/ohms-law/layout";
import { Meter } from "../apparatus/ohms-law/Meter";
import { ResistanceBox } from "../apparatus/ohms-law/ResistanceBox";
import { WireBoard } from "../apparatus/ohms-law/WireBoard";
import { createTerminalRegistry } from "../learn/terminalRegistry";
import { TerminalProvider } from "../learn/terminals";
import type { BenchLead, LeadColour, OhmsLawVisualState } from "../learn/types";
import { readDeviceSignals } from "../quality/signals";
import { chooseTier, lookFor, parseOverride } from "../quality/tier";
import { InkComposer } from "../scene/ink/InkComposer";
import { BlobShadow } from "../scene/look/BlobShadow";
import { LookCamera } from "../scene/look/LookCamera";
import { LookGround } from "../scene/look/LookGround";
import { LookLights } from "../scene/look/LookLights";
import { LookTier } from "../scene/look/lookTier";
import type { Covered } from "../scene/look/types";
import { ReadySignal } from "../scene/ReadySignal";
import { canvasOpacity, posterOpacity, wakeOnResize } from "./HomeBench3D.logic";

// The live card art for the home page's Ohm's law card: the SAME wired bench the practical
// opens (the parts and leads of apparatus/ohms-law, placed by OHMS_LAW_LAYOUT, the diagram's
// seven leads drawn on, key closed), shown as on a studio sheet of paper: the look's key light
// and contact shadow, a cool rim from behind, the camera swinging slowly about the golden
// frame's 45 degrees, the needles trembling a little. Mount it lazily (React.lazy); the
// poster `<img>` shows while it loads, on the low tier, and if WebGL is missing.
// Preview: `?home3d=1` (&az=<deg> holds one angle, &still=1 stops the idle, &quality=low|mid|high).

/** The poster baked from this view at BASE_AZ_DEG (public/home/). */
export const POSTER_SRC = "/home/ohms-law-poster.webp";

/** The swing: base azimuth, amplitude and period. A sine is already eased at both ends. */
export const BASE_AZ_DEG = 26;
export const SWING_DEG = 14;
export const SWING_PERIOD_S = 40;
/** The bench fills this much of the card along its tighter side, at the widest point of the swing. */
const FILL = 0.8;
/** The leads draw on over this long, after this delay (a still view has them drawn at once). */
const DRAW_DELAY_S = 0.35;
const DRAW_S = 2.2;
/** A still view (reduced motion, or `still`) stops rendering after this many frames. */
const STILL_FRAMES = 60;
const COLOURS: LeadColour[] = ["red", "black", "yellow"];
const NO_COVER: Covered = { left: 0, right: 0, top: 0, bottom: 0 };
const SWING_SAMPLES = 9;
/** How far the focus moves toward the viewer (+z) off the middle of the bench's bounds, metres. */
const FOCUS_TOWARD_M = 0.17;

/** Azimuth of the swing at `seconds`. Pure. */
export function swingAzimuth(seconds: number, baseDeg = BASE_AZ_DEG): number {
  return baseDeg + SWING_DEG * Math.sin((2 * Math.PI * seconds) / SWING_PERIOD_S);
}

/** Ease for the leads' draw-on, 0..1 in and out. */
function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** The tier this card runs at: `?quality=` wins, else the device's signals (no warm-up wait). */
function cardTier(): QualityTier {
  const override = parseOverride(window.location.search);
  if (override) return override;
  try {
    return chooseTier({ ...readDeviceSignals(), warmupFps: null });
  } catch {
    return "mid";
  }
}

function hasWebGL2(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// ---- What is drawn ---------------------------------------------------------------------------

function benchState(): OhmsLawVisualState {
  const params = paramsFromSeed(1);
  const readout = { ...createOhmsLaw(params).readout };
  const joint = { tightened: true, clean: true };
  const leads: BenchLead[] = DIAGRAM_LEADS.map(([a, b], i) => ({
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
    // The third coil's plug out, as in a circuit with a resistance set; the rest in.
    plugsIn: params.boxCoilsOhm.map((_, i) => i !== 2),
    leads,
    pendingFrom: null,
    pointer: new THREE.Vector3(),
    ring: null,
    highlight: null,
    hintMissing: [],
    hintExtra: [],
  };
}

/** The two needles rest part way up the scale and tremble a hair, as a loaded movement does. */
const AMMETER_REST = 0.46;
const VOLTMETER_REST = 0.58;
const TREMBLE_DEG = 0.7;

function Bench({
  state,
  quality,
  drawn,
  still,
  shadowsDirty,
}: {
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  drawn: { current: number };
  still: boolean;
  shadowsDirty: { current: boolean };
}) {
  const params = useMemo(() => paramsFromSeed(1), []);
  const L = OHMS_LAW_LAYOUT;
  const common = { state, quality };
  const span = METER_FULL_DEG - METER_ZERO_DEG;
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const r = state.current.readout;
    const live = still ? 0 : 1;
    r.ammeterDeg =
      METER_ZERO_DEG + span * AMMETER_REST + live * TREMBLE_DEG * Math.sin(t * 1.3 + 0.4);
    r.voltmeterDeg =
      METER_ZERO_DEG + span * VOLTMETER_REST + live * TREMBLE_DEG * Math.sin(t * 1.1 + 2.1);
    // The lead draw-on: slow in and out, after a beat. Shadows follow while the leads move.
    const k = still ? 1 : smooth((t - DRAW_DELAY_S) / DRAW_S);
    if (drawn.current !== k) {
      drawn.current = k;
      shadowsDirty.current = true;
    }
  });
  return (
    <>
      <BlobShadow position={[L.cells.position[0] - 0.05, 0, L.cells.position[2]]} radiusM={0.08} />
      <BlobShadow position={[L.cells.position[0] + 0.05, 0, L.cells.position[2]]} radiusM={0.08} />
      <BlobShadow position={[L.key.position[0], 0, L.key.position[2]]} radiusM={0.075} />
      <BlobShadow position={[L.ammeter.position[0], 0, L.ammeter.position[2]]} radiusM={0.12} />
      <BlobShadow position={[L.voltmeter.position[0], 0, L.voltmeter.position[2]]} radiusM={0.12} />
      {[-0.15, 0, 0.15].map((d) => (
        <BlobShadow
          key={d}
          position={[L.box.position[0] + d, 0, L.box.position[2]]}
          radiusM={0.11}
        />
      ))}
      {[-0.44, -0.22, 0, 0.22, 0.44].map((d) => (
        <BlobShadow
          key={d}
          position={[L.wire.position[0] + d, 0, L.wire.position[2]]}
          radiusM={0.11}
        />
      ))}
      <CellHolder {...common} position={L.cells.position} rotationY={L.cells.rotationY} />
      <KeyK {...common} position={L.key.position} rotationY={L.key.rotationY} onToggle={noop} />
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
        onPlugToggle={noop}
      />
      <WireBoard
        {...common}
        wire={params.wire}
        position={L.wire.position}
        rotationY={L.wire.rotationY}
      />
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
    </>
  );
}

function noop() {}

// ---- The studio ------------------------------------------------------------------------------

/** Cool rim from behind-right, low strength, so the far edges of the cases lift off the paper. */
const RIM_COLOUR = "#dfe9ff";
const RIM_INTENSITY = 0.9;

function RimLight() {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight(RIM_COLOUR, RIM_INTENSITY);
    l.position.set(3.2, 2.4, -3.6);
    return l;
  }, []);
  useEffect(() => () => light.dispose(), [light]);
  return <primitive object={light} />;
}

/**
 * The turntable. It sets the shot's azimuth from the clock before LookCamera's frame (priority
 * -1), and after it zooms the orthographic camera so the bench fills FILL of the card at the
 * widest point of the swing: the outline at every azimuth of the swing is measured once, and the
 * largest reach is held, so the bench does not breathe as it turns.
 */
function Turntable({
  bounds,
  baseDeg,
  still,
  epoch,
  onSettled,
}: {
  bounds: Bounds;
  baseDeg: number;
  still: boolean;
  /** Bumps when a resize wakes a settled view: the still-frame count starts over. */
  epoch: number;
  onSettled: () => void;
}) {
  const shot = useMemo(() => {
    return shotFor(bounds, baseDeg, "home-bench");
  }, [bounds, baseDeg]);
  // The parts sit toward the front of their bounding box: the focus moves toward the camera along
  // the ground (which keeps it level across the screen), so the bench, not its empty back corner,
  // is what is centred.
  const middle = useMemo(() => [shot.focus[0], shot.focus[2]] as const, [shot]);
  const widest = useMemo<Extents>(() => {
    const e: Extents = { right: 0, up: 0 };
    const tmp: Extents = { right: 0, up: 0 };
    const reach = still ? 0 : SWING_DEG;
    for (let i = 0; i < SWING_SAMPLES; i++) {
      const az = baseDeg - reach + (2 * reach * i) / (SWING_SAMPLES - 1);
      screenExtents(bounds, az, tmp);
      e.right = Math.max(e.right, tmp.right);
      e.up = Math.max(e.up, tmp.up);
    }
    return e;
  }, [bounds, baseDeg, still]);
  const frames = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: epoch is the trigger, not a value read
  useEffect(() => {
    frames.current = 0;
  }, [epoch]);
  useFrame((st) => {
    const az = still ? baseDeg : swingAzimuth(st.clock.elapsedTime, baseDeg);
    shot.azimuthDeg = az;
    const rad = (az * Math.PI) / 180;
    shot.focus[0] = middle[0] + Math.sin(rad) * FOCUS_TOWARD_M;
    shot.focus[2] = middle[1] + Math.cos(rad) * FOCUS_TOWARD_M;
    if (still) {
      frames.current += 1;
      if (frames.current === STILL_FRAMES) onSettled();
    }
  }, -2);
  useFrame((st) => {
    const cam = st.camera as THREE.OrthographicCamera;
    if (!cam.isOrthographicCamera) return;
    const halfW = (cam.right - cam.left) / 2;
    const halfH = (cam.top - cam.bottom) / 2;
    const z = fillZoom(widest, halfW, halfH, NO_COVER, st.size.width, st.size.height, FILL);
    if (Math.abs(cam.zoom - z) > 1e-6) {
      cam.zoom = z;
      cam.updateProjectionMatrix();
    }
  });
  // Snap in the still view; otherwise glide (a hidden tab's long frame is clamped by LookCamera).
  return <LookCamera shot={shot} covered={NO_COVER} reducedMotion={still} />;
}

/** The first rendered frames, after which the canvas fades in over the poster. */
function FirstFrames({ onShown }: { onShown: () => void }) {
  const n = useRef(0);
  useFrame(() => {
    n.current += 1;
    if (n.current === 4) onShown();
  });
  return null;
}

/** Hands the renderer's loss of its context to the card, which then falls back to the poster. */
function ContextWatch({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl, onLost]);
  return null;
}

class CanvasGuard extends Component<
  { onError: () => void; children: ReactNode },
  { bad: boolean }
> {
  override state = { bad: false };
  static getDerivedStateFromError() {
    return { bad: true };
  }
  override componentDidCatch(_e: Error, _i: ErrorInfo) {
    this.props.onError();
  }
  override render() {
    return this.state.bad ? null : this.props.children;
  }
}

// ---- The card --------------------------------------------------------------------------------

const FILL_BOX: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

/**
 * Soft edges: the sheet of paper fades into whatever the card is, so its colour need not match
 * the card's exactly.
 */
const FEATHER =
  "radial-gradient(ellipse 60% 60% at 50% 50%, #000 66%, rgba(0,0,0,0.55) 84%, transparent 100%)";

export interface HomeBench3DProps {
  /** Poster, and a held view: base azimuth in degrees (default 45). */
  azimuth?: number;
  /** No swing, no idle; renders a second of frames and stops. Also on for reduced motion. */
  still?: boolean;
  /** Where the poster is (default POSTER_SRC). */
  poster?: string;
  /** Soft edges into the card (default true); the poster is baked without. */
  feather?: boolean;
  /** Fill the parent's height too, instead of a 4:3 box (the poster's bake). */
  fit?: boolean;
  /** Top of the pixel ratio (default 1.5; the poster is baked at 2). */
  maxDpr?: number;
  /** Called once the canvas has drawn its first frames. */
  onReady?: () => void;
}

export default function HomeBench3D({
  azimuth = BASE_AZ_DEG,
  still: stillProp = false,
  poster = POSTER_SRC,
  feather = true,
  fit = false,
  maxDpr = 1.5,
  onReady,
}: HomeBench3DProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const tier = useMemo(cardTier, []);
  const webgl = useMemo(hasWebGL2, []);
  const reduced = useMemo(prefersReducedMotion, []);
  const still = stillProp || reduced;
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(false);
  const [settled, setSettled] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const settledRef = useRef(false);
  const shadowsDirtyRef = useRef(true);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => !document.hidden);
  const live = webgl && tier !== "low" && !failed;

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e?.isIntersecting ?? true), {
      rootMargin: "80px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // A resize clears the canvas, and a settled (stopped) loop cannot redraw it: wake it for
  // another run of still frames.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let first = true;
    const ro = new ResizeObserver(() => {
      const wake = wakeOnResize(settledRef.current, first);
      first = false;
      if (!wake) return;
      settledRef.current = false;
      shadowsDirtyRef.current = true;
      setSettled(false);
      setEpoch((e) => e + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const look = useMemo(() => lookFor(tier, window.devicePixelRatio || 1), [tier]);
  const registry = useMemo(createTerminalRegistry, []);
  const state = useMemo(() => ({ current: benchState() }), []);
  const bounds = useMemo(() => planKit(parseKitParams("?part=leads")).bounds, []);
  const drawn = useMemo(() => ({ current: 0 }), []);
  const fail = useCallback(() => setFailed(true), []);
  const onShown = useCallback(() => {
    setShown(true);
    onReady?.();
  }, [onReady]);
  const onSettled = useCallback(() => {
    settledRef.current = true;
    setSettled(true);
  }, []);

  const running = inView && tabVisible && !settled;
  return (
    <div
      ref={boxRef}
      data-testid="home-bench-3d"
      style={{
        position: "relative",
        width: "100%",
        ...(fit ? { height: "100%" } : { aspectRatio: "4 / 3" }),
        overflow: "hidden",
        // Taps and clicks pass through to the card's own buttons.
        pointerEvents: "none",
        ...(feather ? { WebkitMaskImage: FEATHER, maskImage: FEATHER } : {}),
      }}
    >
      <img
        src={poster}
        alt=""
        draggable={false}
        style={{
          ...FILL_BOX,
          objectFit: "cover",
          opacity: posterOpacity(shown, live),
          transition: "opacity .6s",
        }}
      />
      {live ? (
        <div
          style={{
            ...FILL_BOX,
            opacity: canvasOpacity(shown, live),
            transition: "opacity .6s",
          }}
        >
          <CanvasGuard onError={fail}>
            <Canvas
              frameloop={running ? "always" : "never"}
              shadows={look.shadowMapSize > 0 ? "percentage" : false}
              dpr={[1, maxDpr]}
              gl={{ antialias: true, powerPreference: "high-performance" }}
              style={{ pointerEvents: "none" }}
              aria-hidden
            >
              <LookTier.Provider value={tier}>
                <Turntable
                  bounds={bounds}
                  baseDeg={azimuth}
                  still={still}
                  epoch={epoch}
                  onSettled={onSettled}
                />
                <LookLights shadowsDirty={shadowsDirtyRef} />
                <RimLight />
                <LookGround sizeM={2.6} />
                <TerminalProvider registry={registry}>
                  <Bench
                    state={state}
                    quality={tier}
                    drawn={drawn}
                    still={still}
                    shadowsDirty={shadowsDirtyRef}
                  />
                </TerminalProvider>
                <InkComposer quality={tier} />
                <FirstFrames onShown={onShown} />
                <ContextWatch onLost={fail} />
                <ReadySignal />
              </LookTier.Provider>
            </Canvas>
          </CanvasGuard>
        </div>
      ) : null}
    </div>
  );
}

/**
 * `?home3d=1`: the card art alone, in a 600 x 450 box on a card-coloured page. `&az=<deg>` holds
 * one angle; `&bare=1` is the poster's bake: no feathering, the box 800 x 550 on paper.
 */
export function HomeBench3DPreview() {
  const q = new URLSearchParams(location.search);
  const az = Number(q.get("az"));
  const bare = q.get("bare") === "1";
  const box = bare ? { width: 800, height: 550 } : { width: "min(600px, 100%)" };
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: bare ? "800px" : "minmax(0, 1fr)",
        justifyItems: bare ? "start" : "center",
        alignContent: bare ? "start" : "center",
        background: bare ? "#f4ecdc" : "#f8f2e6",
      }}
    >
      <div style={box}>
        <HomeBench3D
          azimuth={q.get("az") !== null && Number.isFinite(az) ? az : BASE_AZ_DEG}
          still={q.get("still") === "1" || q.get("az") !== null}
          feather={!bare}
          fit={bare}
          maxDpr={bare ? 2 : 1.5}
        />
      </div>
    </div>
  );
}
