import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { demoSeedFor } from "@snaplab/engine";
import { useEffect, useReducer, useState } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { InkComposer } from "../../scene/ink/InkComposer";
import { InkLights } from "../../scene/ink/InkLights";
import { PaperDesk } from "../../scene/ink/PaperDesk";
import { ReadySignal } from "../../scene/ReadySignal";
import { OHMS_LAW_LESSON } from "../lessons/ohms-law/lesson";
import { Player } from "../player/Player";
import { playerCovered } from "../player/stages";
import { emptyOhmsLawRecord } from "../readings/record";
import { TerminalProvider } from "../terminals";
import type { BenchState, PracticalMode } from "../types";
import { createVoice } from "../voice/createVoice";
import { createSfx } from "../voice/sfx";
import { BenchParts } from "../wiring/BenchParts";
import { BenchWiring } from "../wiring/BenchWiring";
import { createOhmsLawBench } from "../wiring/bench";
import { createDirector } from "./createDirector";
import { SAMPLE_SCRIPT } from "./sampleScript";
import type { DirectorOptions } from "./types";

// ?director=1: the director and its player on the real V–I bench, with the director's own
// sample script (sampleScript.ts), for the director slice (docs/plans/exam-redesign.md, Wave 1).
// The look here is today's (perspective camera, ink pass); the look slice replaces it.
//   &mode=watch|practice|exam   (default watch; practice and exam run on the one bench you see)
//   &seed=N                     the practice bench's seed (default 7; Watch runs on demoSeedFor(N))
//   &beat=N                     starts paused at the start of beat N
//   &play=1                     starts playing (browsers only speak after a tap, so the voice
//                               stays quiet until you press Start)
//   &speed=1|1.5|2   &quality=low|mid|high   &mute=1
// Watch is hands-off: the actor does the practical. In Practise tap the nuts yourself.

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

/** Feeds the director each frame, and rings the terminal the actor is working on. */
function Driver({
  director,
  bench,
}: {
  director: ReturnType<typeof createDirector>;
  bench: ReturnType<typeof createOhmsLawBench>;
}) {
  useFrame((_, dt) => {
    director.advance(Math.min(dt, 0.1));
    const { act, actT, mode } = director.state;
    const v = bench.visual.current;
    if (mode === "watch" && act?.kind === "lead" && actT < 0.99) {
      v.ring = actT < 0.25 ? act.from : act.to;
    } else if (mode === "watch") {
      v.ring = null;
    }
  });
  return null;
}

const STAGE_TITLES = Object.fromEntries(OHMS_LAW_LESSON.steps.map((st) => [st.key, st.title]));

/** The demonstration notebook as the actor fills it, for the preview only. */
function Notebook({ director }: { director: ReturnType<typeof createDirector> }) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => director.subscribe(bump), [director]);
  const rec = director.demoRecord;
  const s = director.state;
  if (s.mode !== "watch") return null;
  const cell = (t: string) => t || "·";
  return (
    <div className="dpv-notebook">
      <div className="dpv-notebook-head">Demo notebook</div>
      <div className="dpv-notebook-loupe">
        {s.loupe ? `Loupe on the ${s.loupe}` : "Loupe closed"}
      </div>
      <table>
        <thead>
          <tr>
            <th>{rec.headers.R ?? "R"}</th>
            <th>{rec.headers.I ?? "I"}</th>
            <th>{rec.headers.V ?? "V"}</th>
          </tr>
        </thead>
        <tbody>
          {rec.rows.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed table of rows
            <tr key={i}>
              <td>{cell(r.R.text_as_written)}</td>
              <td>{cell(r.I.text_as_written)}</td>
              <td>{cell(r.V.text_as_written)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dpv-notebook-foot">
        {rec.length_xy ? `XY = ${rec.length_xy.text_as_written}` : "XY ·"}
        {rec.graph ? ` · ${rec.graph.points.length} points` : ""}
        {rec.graph?.slope_as_written ? ` · ${rec.graph.slope_as_written}` : ""}
      </div>
    </div>
  );
}

const css = `
.dpv { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--paper); }
.dpv-canvas { position: absolute; }
.dpv-notebook { position: absolute; left: 16px; z-index: 1; width: 176px; padding: 8px 10px;
  background: var(--card); border: var(--rule); border-radius: var(--radius);
  font-family: var(--f-body); font-size: 13px; color: var(--ink); pointer-events: none; }
.dpv-notebook-loupe { margin-bottom: 4px; font-size: 12px; color: var(--ink-2); }
.dpv-notebook-head { margin-bottom: 1px;
  font-family: var(--f-cond); font-weight: 600; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }
.dpv-notebook table { width: 100%; border-collapse: collapse; text-align: center; font-variant-numeric: tabular-nums; }
.dpv-notebook th { font-weight: 600; border-bottom: 1px solid var(--line); }
.dpv-notebook td { padding: 1px 0; }
.dpv-notebook-foot { margin-top: 4px; font-size: 12px; color: var(--ink-2); }
@media (max-width: 640px) { .dpv-notebook { display: none; } }
`;

function modeFrom(q: string | null): PracticalMode {
  return q === "practice" || q === "exam" ? q : "watch";
}

export default function DirectorPreview() {
  const search = new URLSearchParams(location.search);
  const q = search.get("quality");
  const quality: QualityTier = q === "low" || q === "mid" ? q : "high";
  const [size, setSize] = useState(() => [window.innerWidth, window.innerHeight] as const);

  const [rig] = useState(() => {
    const mode = modeFrom(search.get("mode"));
    const seed = Number(search.get("seed")) || 7;
    // Watch drives its own bench, on a different seed from the one she would practise on.
    const bench = createOhmsLawBench(mode === "watch" ? demoSeedFor(seed) : seed, {
      mode: mode === "exam" ? "exam" : "practice",
    });
    const voice = createVoice();
    voice.muted = search.get("mute") === "1";
    const benchState = (): BenchState => ({
      comparison: bench.comparison,
      keyClosed: bench.visual.current.keyClosed,
      boxSettingOhm: bench.boxSettingOhm,
      record: emptyOhmsLawRecord("practice"),
      identified: new Set(),
    });
    const base = { script: SAMPLE_SCRIPT, voice, benchState };
    const options: DirectorOptions =
      mode === "watch" ? { ...base, mode, bench } : { ...base, mode, bench };
    const director = createDirector(options);
    const sfx = createSfx(() => voice.muted);
    director.onEvent((e) => {
      if (e.kind === "lead") sfx.leadSnap();
      else if (e.kind === "plug") sfx.plug();
      else if (e.kind === "key") sfx.key();
      else if (e.kind === "write" || e.kind === "plot") sfx.page();
    });
    const speed = Number(search.get("speed"));
    if (speed === 1 || speed === 1.5 || speed === 2) director.setSpeed(speed);
    const beat = search.get("beat");
    if (beat !== null && beat !== "" && Number.isFinite(Number(beat))) director.seek(Number(beat));
    if (search.get("play") === "1") director.play();
    return { bench, director, voice, sfx };
  });

  useEffect(() => {
    const onResize = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      rig.voice.stop();
    };
  }, [rig]);

  const covered = playerCovered(size[0], size[1]);
  return (
    <div className="dpv snap-paper">
      <style>{css}</style>
      <div
        className="dpv-canvas"
        style={{
          top: covered.top,
          bottom: covered.bottom,
          left: covered.left,
          right: covered.right,
        }}
      >
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
            <BenchParts bench={rig.bench} quality={quality} />
            <BenchWiring bench={rig.bench} quality={quality} />
            <Driver director={rig.director} bench={rig.bench} />
          </TerminalProvider>
          <InkComposer quality={quality} />
          <ReadySignal />
        </Canvas>
      </div>
      <div style={{ position: "absolute", left: 0, top: covered.top + 8, zIndex: 1 }}>
        <Notebook director={rig.director} />
      </div>
      <Player director={rig.director} stageTitles={STAGE_TITLES} />
    </div>
  );
}
