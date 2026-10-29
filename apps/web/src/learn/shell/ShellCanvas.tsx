import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { lookFor } from "../../quality/tier";
import { InkComposer } from "../../scene/ink/InkComposer";
import { LookCamera } from "../../scene/look/LookCamera";
import { LookGround } from "../../scene/look/LookGround";
import { LookLights } from "../../scene/look/LookLights";
import { LookTier } from "../../scene/look/lookTier";
import type { Covered } from "../../scene/look/types";
import { ReadySignal } from "../../scene/ReadySignal";
import type { Director } from "../script/types";
import { TerminalProvider } from "../terminals";
import type { OhmsLawBench } from "../types";
import { BenchParts } from "../wiring/BenchParts";
import { BenchWiring } from "../wiring/BenchWiring";
import { BENCH_SHOT } from "./benchFrame";

// ?shell=1&canvas=1: the real V–I bench through the look (the orthographic camera, the soft
// light and shadows, the graph-paper desk, the ink pass), full-bleed behind the shell's cards.
// The camera fits the bench into the part of the stage the cards leave free (`covered`), as
// scene/look/LookPreview.tsx does for its `&covered=` URLs, with the one shot in benchFrame.ts
// (the bench's real footprint). With a director the actor works the bench (Watch), the same bench
// BenchParts and BenchWiring draw.

export interface ShellCanvasProps {
  bench: OhmsLawBench;
  director: Director | null;
  /** The part of the canvas the cards cover, from playerCovered. */
  covered: Covered;
  quality: QualityTier;
  /** Pins the pixel ratio (shots at the device's), instead of 1 to 2. */
  dpr: number | null;
}

/** The camera, the light, and each frame's work: the director's time, the terminal ring. */
function Rig({
  bench,
  director,
  covered,
}: {
  bench: OhmsLawBench;
  director: Director | null;
  covered: Covered;
}) {
  const shadowsDirty = useRef(true);
  const reducedMotion = useMemo(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }, []);
  useFrame((_, dt) => {
    // The preview keeps it simple: re-render the shadow map each frame.
    shadowsDirty.current = true;
    if (!director) return;
    director.advance(Math.min(dt, 0.1));
    const { act, actT, mode } = director.state;
    const v = bench.visual.current;
    if (mode === "watch" && act?.kind === "lead" && actT < 0.99) {
      v.ring = actT < 0.25 ? act.from : act.to;
    } else if (mode === "watch") {
      v.ring = null;
    }
  });
  return (
    <>
      <LookCamera shot={BENCH_SHOT} covered={covered} reducedMotion={reducedMotion} />
      <LookLights shadowsDirty={shadowsDirty} />
    </>
  );
}

export default function ShellCanvas({ bench, director, covered, quality, dpr }: ShellCanvasProps) {
  const look = useMemo(() => lookFor(quality, window.devicePixelRatio || 1), [quality]);
  return (
    <Canvas
      shadows={look.shadowMapSize > 0 ? "percentage" : false}
      dpr={dpr ?? [1, 2]}
      gl={{ antialias: true }}
    >
      <LookTier.Provider value={quality}>
        <Rig bench={bench} director={director} covered={covered} />
        <LookGround />
        <TerminalProvider>
          <BenchParts bench={bench} quality={quality} />
          <BenchWiring bench={bench} quality={quality} />
        </TerminalProvider>
        <InkComposer quality={quality} />
        <ReadySignal />
      </LookTier.Provider>
    </Canvas>
  );
}
