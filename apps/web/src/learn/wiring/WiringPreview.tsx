import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { DIAGRAM_LEADS, TERMINAL_IDS, type TerminalId } from "@snaplab/engine";
import { type CSSProperties, useEffect, useReducer, useState } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { getLeadCurve } from "../../apparatus/ohms-law/Lead";
import { createLabAudio } from "../../audio/labAudio";
import { InkComposer } from "../../scene/ink/InkComposer";
import { InkLights } from "../../scene/ink/InkLights";
import { PaperDesk } from "../../scene/ink/PaperDesk";
import { ReadySignal } from "../../scene/ReadySignal";
import { TerminalProvider, useTerminalRegistry } from "../terminals";
import type { LessonMode, PartId } from "../types";
import { BenchParts } from "./BenchParts";
import { BenchWiring } from "./BenchWiring";
import { createOhmsLawBench, type OhmsLawBenchController } from "./bench";
import { CircuitDiagram, CompareToggle } from "./CircuitDiagram";

// ?wiring=1 — the whole V–I bench driven by a real createOhmsLawBench(1), with the diagram
// beside it, for the wiring slice (docs/plans/ohms-law-vi.md, "Wave 2 → Wiring").
//   &demo=good|reversed|short|series|open   pre-wires a case and closes the key
//   &pending=<terminal>                     starts a lead there (shows the rubber band)
//   &mode=exam                              exam mode: no hints, no notes, plain diagram
//   &quality=low|mid|high
// Tap a nut, then another, to run a lead; tap a lead to remove it; Esc cancels a pending lead.

type Pairs = ReadonlyArray<readonly [TerminalId, TerminalId]>;

/** The modelled mistakes (the engine's own cases in packages/engine bench.test.ts). */
const DEMOS: Readonly<Record<string, Pairs>> = {
  good: DIAGRAM_LEADS,
  // The ammeter's two leads swapped at its terminals: the needle kicks below zero.
  reversed: [
    ["E+", "K1"],
    ["K2", "A-"],
    ["A+", "R1"],
    ["R2", "X"],
    ["Y", "E-"],
    ["V+", "X"],
    ["V-", "Y"],
  ],
  // Ammeter across XY, the gap it left closed by a lead, R = 0: over range and a short.
  short: [
    ["E+", "K1"],
    ["K2", "R1"],
    ["R2", "X"],
    ["Y", "E-"],
    ["A+", "X"],
    ["A-", "Y"],
    ["V+", "X"],
    ["V-", "Y"],
  ],
  // Meters swapped: the voltmeter in series reads about the emf, the ammeter almost nothing.
  series: [
    ["E+", "K1"],
    ["K2", "V+"],
    ["V-", "R1"],
    ["R2", "X"],
    ["Y", "E-"],
    ["A+", "X"],
    ["A-", "Y"],
  ],
  // One lead short of the loop (A− to R1 missing): nothing moves.
  open: DIAGRAM_LEADS.filter(([a, b]) => !(a === "A-" && b === "R1")),
};

function benchFromQuery(search: URLSearchParams): OhmsLawBenchController {
  const mode: LessonMode = search.get("mode") === "exam" ? "exam" : "practice";
  const bench = createOhmsLawBench(1, { mode });
  const demo = DEMOS[search.get("demo") ?? ""];
  if (demo) {
    for (const [a, b] of demo) {
      bench.tapTerminal(a);
      bench.tapTerminal(b);
    }
    bench.toggleKey();
  }
  const pending = search.get("pending");
  if (pending && (TERMINAL_IDS as readonly string[]).includes(pending)) {
    bench.tapTerminal(pending as TerminalId);
  }
  return bench;
}

/** Half the width of the bench to keep in view (box to cells; the tray may crop), metres. */
const FIT_HALF_WIDTH_M = 0.62;
const BASE_EYE = [0, 0.95, 1.1] as const;

/** Backs the camera off until the bench's width fits the canvas, on any aspect. */
function FrameRig() {
  const camera = useThree((st) => st.camera);
  const width = useThree((st) => st.size.width);
  const height = useThree((st) => st.size.height);
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = width / Math.max(height, 1);
    const halfTan = Math.tan((camera.fov * Math.PI) / 360) * aspect;
    const need = FIT_HALF_WIDTH_M / Math.max(halfTan, 1e-3);
    const k = Math.min(2.6, Math.max(1, need / Math.hypot(BASE_EYE[1], BASE_EYE[2])));
    camera.position.set(0, BASE_EYE[1] * k, -0.05 + BASE_EYE[2] * k);
    camera.lookAt(0, 0, -0.05);
  }, [camera, width, height]);
  return null;
}

const _p = new THREE.Vector3();

/**
 * A test hook for learn/wiring/interact.ts (Playwright): where a nut or a lead's middle is on
 * the page, the bench, and how many dots and ghost dashes are drawn. Preview only.
 */
function DevHook({ bench }: { bench: OhmsLawBenchController }) {
  const registry = useTerminalRegistry();
  const camera = useThree((st) => st.camera);
  const scene = useThree((st) => st.scene);
  const gl = useThree((st) => st.gl);
  useEffect(() => {
    const toPage = (v: THREE.Vector3): [number, number] => {
      v.project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
    };
    const hook = {
      bench,
      /** A point on the nut's tap target, a little above its top. */
      nut(id: TerminalId): [number, number] | null {
        if (!registry.worldPosition(id, _p)) return null;
        _p.y += 0.012;
        return toPage(_p);
      },
      leadMid(leadId: string): [number, number] | null {
        const l = bench.visual.current.leads.find((x) => x.id === leadId);
        const c = l && getLeadCurve(bench.visual, l.id);
        if (!c) return null;
        const i = Math.floor(c.count / 2);
        _p.set(c.points[i * 3] ?? 0, c.points[i * 3 + 1] ?? 0, c.points[i * 3 + 2] ?? 0);
        return toPage(_p);
      },
      drawn(name: string): number {
        const m = scene.getObjectByName(name);
        return m instanceof THREE.InstancedMesh ? m.count : -1;
      },
    };
    (window as unknown as { __SNAPLAB_WIRING__?: typeof hook }).__SNAPLAB_WIRING__ = hook;
  }, [bench, registry, camera, scene, gl]);
  return null;
}

const button: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "0 14px",
  border: "1.5px solid var(--ink)",
  borderRadius: "var(--radius)",
  background: "var(--card)",
  color: "var(--ink)",
  font: "600 15px var(--f-cond)",
  cursor: "pointer",
};

export default function WiringPreview() {
  const search = new URLSearchParams(location.search);
  const q = search.get("quality");
  const quality: QualityTier = q === "low" || q === "mid" ? q : "high";
  const [bench] = useState(() => benchFromQuery(search));
  const [audio] = useState(createLabAudio);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [compare, setCompare] = useState(true);
  const [highlight, setHighlight] = useState<PartId | null>(null);
  const [wide, setWide] = useState(() => window.innerWidth >= 900);

  useEffect(() => bench.subscribe(bump), [bench]);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 900);
    const unlock = () => void audio.unlock();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", unlock);
      audio.dispose();
    };
  }, [audio]);
  useEffect(() => {
    bench.visual.current.highlight = highlight;
  }, [bench, highlight]);

  const exam = bench.mode === "exam";
  const v = bench.visual.current;
  return (
    <div
      className="snap-paper"
      style={{
        display: "flex",
        flexDirection: wide ? "row" : "column",
        width: "100%",
        height: "100%",
      }}
    >
      <div style={{ flex: wide ? 1 : "0 0 58%", minHeight: 0, position: "relative" }}>
        <Canvas
          shadows="percentage"
          dpr={quality === "low" ? 1 : [1, 2]}
          gl={{ antialias: true }}
          camera={{ fov: 40, position: [0, 0.95, 1.05], near: 0.02, far: 20 }}
        >
          <InkLights quality={quality} />
          <FrameRig />
          <OrbitControls target={[0, 0, -0.05]} makeDefault />
          <TerminalProvider>
            <PaperDesk quality={quality} />
            <BenchParts bench={bench} quality={quality} />
            <BenchWiring bench={bench} quality={quality} audio={audio} />
            <DevHook bench={bench} />
          </TerminalProvider>
          <InkComposer quality={quality} />
          <ReadySignal />
        </Canvas>
      </div>
      <aside
        style={{
          flex: wide ? "0 0 380px" : 1,
          overflowY: "auto",
          padding: 16,
          borderLeft: wide ? "var(--rule)" : undefined,
          borderTop: wide ? undefined : "var(--rule)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div className="snap-label" style={{ fontSize: 14 }}>
          Wiring preview · {exam ? "exam" : "practice"} mode
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={button} onClick={() => bench.undo()}>
            Undo
          </button>
          <button type="button" style={button} onClick={() => bench.reset()}>
            Reset
          </button>
          <button
            type="button"
            style={button}
            aria-pressed={v.keyClosed}
            onClick={() => bench.toggleKey()}
          >
            {v.keyClosed ? "Open key K" : "Close key K"}
          </button>
          <button
            type="button"
            style={button}
            aria-pressed={exam}
            onClick={() => bench.setMode(exam ? "practice" : "exam")}
          >
            {exam ? "Exam mode: on" : "Exam mode: off"}
          </button>
          <CompareToggle on={compare} onChange={setCompare} />
        </div>
        {compare ? (
          <CircuitDiagram
            comparison={exam ? null : bench.comparison}
            highlight={highlight}
            onPart={(part, how) => setHighlight(how === "tap" && part === highlight ? null : part)}
            style={{ maxWidth: 380 }}
          />
        ) : null}
        {v.pendingFrom ? (
          <p style={{ margin: 0 }}>Now tap the nut where this lead ends (Esc cancels).</p>
        ) : null}
        {exam ? null : (
          <section aria-label="Procedure notes" style={{ display: "grid", gap: 6 }}>
            {bench.notes.map((n) => (
              <p
                key={n.id}
                style={{
                  margin: 0,
                  padding: "6px 10px",
                  borderLeft: "3px solid var(--accent)",
                  background: "var(--card)",
                }}
              >
                {n.text}
              </p>
            ))}
          </section>
        )}
      </aside>
    </div>
  );
}
