import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import MeterBridgeKit from "../apparatus/meter-bridge/MeterBridgeKit";
import {
  type BenchSetup,
  useMeterBridgeEngine,
} from "../apparatus/meter-bridge/useMeterBridgeEngine";
import { ContextLossOverlay } from "../quality/ContextLossOverlay";
import { QualityMonitor } from "../quality/QualityMonitor";
import { QualityProvider, useQuality } from "../quality/QualityProvider";
import { InkComposer } from "../scene/ink/InkComposer";
import { InkLights } from "../scene/ink/InkLights";
import { PaperDesk } from "../scene/ink/PaperDesk";
import { benchSetupFrom } from "./benchSetup";
import { CurrentFlow } from "./CurrentFlow";
import { type DrawnPart, InkSparks } from "./InkSparks";
import { BENCH_TOP_Y, pageLayout } from "./layout";
import { MAX_EYE_DEG } from "./loupe";
import { PageSheet } from "./PageSheet";
import { RevealClip } from "./RevealClip";
import { type LoupeState, RuleLoupe } from "./RuleLoupe";
import { ease, REVEAL_S, type RevealPhases, revealAt, revealInto } from "./reveal";

const LiteBench = lazy(() => import("../lite/LiteBench"));

type Bench = ReturnType<typeof benchSetupFrom>;

export interface LabBenchProps {
  /** Her flattened page (name band already pixelated). */
  pageUrl: string;
  /** Page height / width. */
  pageAspect: number;
  /** The parts she drew, with Spark's boxes on her page. */
  parts: DrawnPart[];
  /** The R values she wrote (blueprint values). */
  resistancesOhm: Array<number | null>;
  teacherXOhm: number | null;
  /** Her own mean X as written; only an engine input, never shown. */
  herMeanXOhm: number | null;
}

const BENCH_TARGET = new THREE.Vector3(0, 0, 0.02);
const FOV_DEG = 40;
const FOV_HALF_TAN = Math.tan(((FOV_DEG / 2) * Math.PI) / 180);

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Runs the reveal clock and eases the camera from her page to the bench. */
function RevealDirector({
  phases,
  startKey,
  skipKey,
  reducedMotion,
  pageCentre,
  home,
  onDone,
}: {
  phases: { current: RevealPhases };
  /** The bench view the reveal ends on; the metre-rule close-up returns to it. */
  home: { position: THREE.Vector3; target: THREE.Vector3 };
  startKey: number;
  skipKey: number;
  reducedMotion: boolean;
  pageCentre: readonly [number, number, number];
  onDone: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const clock = useRef({ t: 0, done: false });
  const v = useMemo(
    () => ({
      fromPos: new THREE.Vector3(),
      fromTarget: new THREE.Vector3(),
      toPos: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    void startKey;
    clock.current = { t: 0, done: false };
  }, [startKey]);

  useEffect(() => {
    if (skipKey > 0) clock.current.t = REVEAL_S;
  }, [skipKey]);

  useFrame((_, dt) => {
    const c = clock.current;
    // Real time, so a slow phone sees the same 4.6 s reveal (only a long stall is cut short).
    c.t += Math.min(dt, 0.25);
    const p = revealInto(c.t, phases.current, reducedMotion);
    const aspect = size.width / Math.max(size.height, 1);
    // Far enough back that the 1.3 m-wide bench fits across: half-width / tan(half-fov).
    const dist = Math.max(1.15, 0.66 / (FOV_HALF_TAN * Math.max(aspect, 0.3)));
    v.toPos.set(0, dist * 0.62, BENCH_TARGET.z + dist * 0.78);
    home.position.copy(v.toPos);
    home.target.copy(BENCH_TARGET);
    if (c.done) return;
    v.fromTarget.set(pageCentre[0], pageCentre[1], pageCentre[2]);
    v.fromPos.set(pageCentre[0], pageCentre[1] + (aspect < 1 ? 0.62 : 0.5), pageCentre[2] + 0.12);
    const k = ease(p.camera);
    v.pos.lerpVectors(v.fromPos, v.toPos, k);
    v.target.lerpVectors(v.fromTarget, BENCH_TARGET, k);
    camera.position.copy(v.pos);
    camera.lookAt(v.target);

    if (c.t >= REVEAL_S || reducedMotion) {
      c.done = true;
      onDone();
    }
  });
  return null;
}

function BenchScene({
  props,
  bench,
  startKey,
  skipKey,
  loupe,
  loupeOn,
}: {
  props: LabBenchProps;
  bench: Bench;
  startKey: number;
  skipKey: number;
  loupe: { current: LoupeState };
  loupeOn: boolean;
}) {
  const { settings, tier } = useQuality();
  const [done, setDone] = useState(false);
  // True from opening the close-up until the camera is back at the bench view.
  const [inLoupe, setInLoupe] = useState(false);
  useEffect(() => {
    if (loupeOn) setInLoupe(true);
  }, [loupeOn]);
  const home = useMemo(() => ({ position: new THREE.Vector3(), target: BENCH_TARGET.clone() }), []);
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const phases = useRef<RevealPhases>(revealAt(0, reducedMotion));
  // Fixed at mount: the tier can settle while the sparks are in flight, and a new budget
  // would rebuild them mid-air.
  const [sparkBudget] = useState(() => Math.floor(settings.maxParticles / 2));
  const page = useMemo(() => pageLayout(props.pageAspect), [props.pageAspect]);
  const { visual, handlers } = useMeterBridgeEngine(bench.setup as BenchSetup);

  useEffect(() => {
    void startKey;
    setDone(false);
  }, [startKey]);

  return (
    <>
      <InkLights quality={tier} />
      <PaperDesk quality={tier} y={BENCH_TOP_Y} />
      <Suspense fallback={null}>
        <PageSheet
          url={props.pageUrl}
          width={page.width}
          height={page.height}
          position={page.centre}
          phases={phases}
        />
      </Suspense>
      <InkSparks parts={props.parts} page={page} maxSparks={sparkBudget} phases={phases} />
      <RevealClip phases={phases}>
        <MeterBridgeKit
          state={visual}
          plugLabels={bench.plugLabels}
          unknownLabel="X"
          quality={tier}
          onWireTap={handlers.onWireTap}
          onWireDrag={handlers.onWireDrag}
          onPlugToggle={handlers.onPlugToggle}
          onKeyToggle={handlers.onKeyToggle}
        />
      </RevealClip>
      <CurrentFlow state={visual} maxDots={settings.maxParticles} />
      <RevealDirector
        phases={phases}
        startKey={startKey}
        skipKey={skipKey}
        reducedMotion={reducedMotion}
        pageCentre={page.centre}
        home={home}
        onDone={() => setDone(true)}
      />
      {done && (
        <RuleLoupe loupe={loupe} state={visual} home={home} onReturned={() => setInLoupe(false)} />
      )}
      {done && !inLoupe && (
        <OrbitControls
          target={BENCH_TARGET}
          makeDefault
          enablePan={false}
          minDistance={0.35}
          maxDistance={5}
          maxPolarAngle={Math.PI * 0.47}
        />
      )}
      <QualityMonitor />
      <InkComposer quality={tier} />
    </>
  );
}

const BUTTON_STYLE = {
  minHeight: 40,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#f8fafc",
  fontSize: 13,
} as const;

function LabCanvas({
  props,
  bench,
  onLite,
}: {
  props: LabBenchProps;
  bench: Bench;
  onLite: () => void;
}) {
  const { settings } = useQuality();
  const [canvasKey, setCanvasKey] = useState(0);
  const [startKey, setStartKey] = useState(0);
  const [skipKey, setSkipKey] = useState(0);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const replay = useCallback(() => setStartKey((k) => k + 1), []);
  const loupe = useRef<LoupeState>({ on: false, eyeDeg: 0 });
  const [loupeOn, setLoupeOn] = useState(false);
  const [eyeDeg, setEyeDeg] = useState(0);
  const toggleLoupe = () => {
    loupe.current.on = !loupe.current.on;
    loupe.current.eyeDeg = 0;
    setEyeDeg(0);
    setLoupeOn(loupe.current.on);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        key={canvasKey}
        shadows={settings.shadows ? "percentage" : false}
        dpr={settings.dpr}
        gl={{ antialias: true }}
        camera={{ fov: FOV_DEG, near: 0.02, far: 20, position: [0, 0.6, 0.6] }}
        onCreated={({ gl }) => setCanvasEl(gl.domElement)}
      >
        <BenchScene
          props={props}
          bench={bench}
          startKey={startKey}
          skipKey={skipKey}
          loupe={loupe}
          loupeOn={loupeOn}
        />
      </Canvas>
      <ContextLossOverlay canvas={canvasEl} onReload={() => setCanvasKey((k) => k + 1)} />
      {loupeOn && (
        <label
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(12, 15, 20, 0.78)",
            color: "#e2e8f0",
            fontSize: 13,
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>Your eye</span>
          <input
            type="range"
            min={-MAX_EYE_DEG}
            max={MAX_EYE_DEG}
            step={1}
            value={eyeDeg}
            onChange={(e) => {
              const d = Number(e.target.value);
              loupe.current.eyeDeg = d;
              setEyeDeg(d);
            }}
            style={{ flex: 1 }}
            aria-label="Move your eye left or right of the jockey"
          />
          <span style={{ minWidth: 150 }}>
            {eyeDeg === 0 ? "Square to the scale: no parallax" : "To the side: parallax error"}
          </span>
        </label>
      )}
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 12,
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          justifyContent: "space-between",
          pointerEvents: "none",
        }}
      >
        <p
          style={{
            margin: 0,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(12, 15, 20, 0.78)",
            color: "#e2e8f0",
            fontSize: 13,
            lineHeight: 1.4,
            maxWidth: 420,
          }}
        >
          Close the key, then tap the wire with the jockey to find the balance point. Don't slide
          it.
        </p>
        <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
          <button type="button" onClick={toggleLoupe} aria-pressed={loupeOn} style={BUTTON_STYLE}>
            {loupeOn ? "Back to bench" : "Read the scale"}
          </button>
          <button type="button" onClick={onLite} style={BUTTON_STYLE}>
            2D
          </button>
          <button
            type="button"
            onClick={() => setSkipKey((k) => k + 1)}
            style={{
              minHeight: 40,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#f8fafc",
              fontSize: 13,
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={replay}
            style={{
              pointerEvents: "auto",
              minHeight: 40,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#f8fafc",
              fontSize: 13,
            }}
          >
            Replay
          </button>
        </div>
      </div>
    </div>
  );
}

/** Whether this browser can make a WebGL2 context at all (the 3D lab needs one). */
function hasWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

/** The 3D lab, or the 2D Lite bench when WebGL is missing, the phone is too slow, or she asks. */
function LabView(props: LabBenchProps) {
  const { liteSuggested } = useQuality();
  const [webgl] = useState(hasWebGL2);
  const [choice, setChoice] = useState<"3d" | "lite" | null>(null);
  // The bench is set up once per page; each view's engine owns it from then on.
  const [bench] = useState(() =>
    benchSetupFrom({
      resistancesOhm: props.resistancesOhm,
      teacherXOhm: props.teacherXOhm,
      herMeanXOhm: props.herMeanXOhm,
    }),
  );
  const lite = !webgl || choice === "lite" || (choice === null && liteSuggested);

  if (!lite) return <LabCanvas props={props} bench={bench} onLite={() => setChoice("lite")} />;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflowY: "auto" }}>
      <p style={{ margin: "8px 12px", color: "#94a3b8", fontSize: 13 }}>
        {!webgl
          ? "This browser can't show the 3D lab, so here is the same bench in 2D."
          : choice === "lite"
            ? "The same bench in 2D."
            : "This phone was running the 3D lab slowly, so here is the same bench in 2D."}
        {webgl && (
          <button
            type="button"
            onClick={() => setChoice("3d")}
            style={{ ...BUTTON_STYLE, marginLeft: 8, minHeight: 32, padding: "4px 10px" }}
          >
            Back to 3D
          </button>
        )}
      </p>
      <Suspense fallback={null}>
        <LiteBench setup={bench.setup} plugLabels={bench.plugLabels} unknownLabel="X" />
      </Suspense>
    </div>
  );
}

/** "Your lab": her page on the bench, the reveal, then the live metre bridge. */
export default function LabBench(props: LabBenchProps) {
  return (
    <QualityProvider>
      <LabView {...props} />
    </QualityProvider>
  );
}
