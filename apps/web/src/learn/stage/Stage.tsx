import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { type BenchSlot, OHMS_LAW_LAYOUT } from "../../apparatus/ohms-law/layout";
import type { LabAudio } from "../../audio/labAudio";
import { lookFor } from "../../quality/tier";
import { InkComposer } from "../../scene/ink/InkComposer";
import { useInkFocus } from "../../scene/ink/inkFocus";
import { BlobShadow } from "../../scene/look/BlobShadow";
import { createDprLadder } from "../../scene/look/dprLadder";
import { isPortrait, LOOK_DISTANCE_M, LookCamera } from "../../scene/look/LookCamera";
import { LookGround } from "../../scene/look/LookGround";
import { LookLights } from "../../scene/look/LookLights";
import { LookTier } from "../../scene/look/lookTier";
import type { Covered } from "../../scene/look/types";
import { useDprLadder, useLadderDpr } from "../../scene/look/useDprLadder";
import { ReadySignal } from "../../scene/ReadySignal";
import type { LoupeTarget, RuleEnd } from "../readings/poses";
import { ReadingLoupe } from "../readings/ReadingLoupe";
import { BENCH_SHOT } from "../shell/benchFrame";
import { TerminalProvider } from "../terminals";
import type { OhmsLawBench } from "../types";
import { BenchParts, type BenchPartsProps } from "../wiring/BenchParts";
import { BenchWiring } from "../wiring/BenchWiring";
import {
  benchBusy,
  createPoseMemo,
  createStageLoop,
  IDLE_GAP_S,
  MAX_TICK_S,
  MOUNT_S,
  POINTER_S,
  poseChanged,
  RENDER_S,
  SETTLE_S,
  type StageLoop,
  type StagePart,
  stageFocusIds,
} from "./frameloop";

// The live practical's stage (docs/plans/wave-2-lean.md, 2a-stage): the V–I bench through the
// look that ?look=ohms-law signed off (scene/look/LookPreview.tsx), full-bleed behind the shell.
//   - A fixed orthographic shot of the whole bench (BENCH_SHOT), fitted into the part of the
//     canvas the page's cards leave free (`covered`); a drag turns the azimuth only and eases back.
//     A free area taller than wide (a phone held upright) turns the camera steeper with the bench's
//     long side up the screen, so the bench fills it.
//   - LookLights (soft key shadows, the map re-rendered only when something moved), LookGround
//     (the graph-paper desk), blob contact shadows under each part, and the ink pass.
//   - The pixel-ratio ladder, and a demand frameloop (frameloop.ts) that keeps rendering only
//     while something can move.
//   - The meter and rule close-ups take a perspective camera for as long as they are open, placed
//     where the shot looked from, and hand back to the shot when they return.

/** Blob shadows under each part: x offsets from the part and a radius, in metres (LookPreview). */
const BLOBS: Readonly<Record<BenchSlot, { dx: readonly number[]; r: number }>> = {
  cells: { dx: [-0.05, 0.05], r: 0.08 },
  key: { dx: [0], r: 0.075 },
  ammeter: { dx: [0], r: 0.12 },
  voltmeter: { dx: [0], r: 0.12 },
  box: { dx: [-0.15, 0, 0.15], r: 0.11 },
  wire: { dx: [-0.44, -0.22, 0, 0.22, 0.44], r: 0.11 },
  tray: { dx: [-0.08, 0.08], r: 0.17 },
};

/** The close-up camera's vertical field of view (ReadingLoupe fits the dial with it). */
const LOUPE_FOV_DEG = 40;

export interface StageLoupe {
  target: LoupeTarget;
  ruleEnd: RuleEnd;
}

export interface StageProps {
  bench: OhmsLawBench;
  quality: QualityTier;
  /**
   * What the page's cards cover, in CSS px, for a window this size (the page passes
   * playerCovered with its own options). Called again whenever the canvas resizes.
   */
  covered: (width: number, height: number) => Covered;
  audio?: Pick<LabAudio, "needleSlam">;
  /** Taps on parts, meters, the rule and the tray (BenchParts). Nuts, leads, plugs and the key keep their own. */
  parts?: Pick<BenchPartsProps, "onPartTap" | "onMeterTap" | "onRuleTap" | "onTrayItem">;
  /** The open close-up, or null. */
  loupe: StageLoupe | null;
  /** Her eye, degrees to the side of square, for the close-up. */
  eyeDeg: number;
  /** True from a close-up opening until it has eased back (onLoupeReturned). */
  loupeHeld: boolean;
  onLoupeReturned: () => void;
  /** Parts kept in full ink (nuts and leads always stay); null keeps everything in focus. */
  focus?: readonly StagePart[] | null;
  /** Pins the pixel ratio (shots at the device's) instead of the ladder. */
  dpr?: number | null;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The shot camera, fitted to what the cards leave free at the canvas's current size. */
function StageCamera({ covered, loop }: { covered: StageProps["covered"]; loop: StageLoop }) {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  // The shell's layout is measured on the window (shell/layout.ts), as the cards are.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the canvas size is what changes the window.
  const c = useMemo(() => covered(window.innerWidth, window.innerHeight), [covered, width, height]);
  const reducedMotion = useMemo(prefersReducedMotion, []);
  // A drag fits the shot for the widest turn she can make (±25°), which on a phone held upright
  // shrinks the bench to two thirds of the free width. There the bench fills the stage instead,
  // and does not turn; a wider window keeps the drag.
  const wasPortrait = useRef(false);
  const portrait = isPortrait(c, width, height, wasPortrait.current);
  wasPortrait.current = portrait;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new fit is what the camera eases to.
  useEffect(() => loop.wake(RENDER_S), [loop, c.left, c.right, c.top, c.bottom]);
  return (
    <LookCamera shot={BENCH_SHOT} covered={c} drag={!portrait} reducedMotion={reducedMotion} />
  );
}

const _dir = new THREE.Vector3();
const _focus = new THREE.Vector3();

/**
 * Puts `persp` where the orthographic shot `ortho` looks from, far enough back that it shows the
 * same height of bench, with the same view offset, so the close-up starts (and ends) on the shot.
 */
function matchShot(
  ortho: THREE.Camera,
  persp: THREE.PerspectiveCamera,
  width: number,
  height: number,
): void {
  persp.aspect = width / Math.max(1, height);
  if (!(ortho instanceof THREE.OrthographicCamera)) {
    persp.position.copy(ortho.position);
    persp.quaternion.copy(ortho.quaternion);
    persp.updateProjectionMatrix();
    persp.updateMatrixWorld();
    return;
  }
  ortho.getWorldDirection(_dir);
  _focus.copy(ortho.position).addScaledVector(_dir, LOOK_DISTANCE_M);
  const halfH = (ortho.top - ortho.bottom) / 2 / Math.max(ortho.zoom, 1e-5);
  const d = halfH / Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));
  persp.position.copy(_focus).addScaledVector(_dir, -d);
  persp.quaternion.copy(ortho.quaternion);
  const v = ortho.view;
  if (v?.enabled) {
    persp.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height);
  } else {
    persp.clearViewOffset();
  }
  persp.updateProjectionMatrix();
  persp.updateMatrixWorld();
}

/**
 * While mounted, a perspective camera is the canvas's own, starting where the shot looked from
 * (ReadingLoupe flies it in and back). The shot's camera comes back on unmount. Its children (the
 * loupe) mount only once the camera has been handed over, so they never see the shot's camera.
 */
function CloseUpCamera({ children }: { children: ReactNode }) {
  const get = useThree((s) => s.get);
  const set = useThree((s) => s.set);
  const camera = useMemo(() => {
    const c = new THREE.PerspectiveCamera(LOUPE_FOV_DEG, 1, 0.02, 20);
    c.name = "CloseUpCamera";
    return c;
  }, []);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const prev = get().camera;
    const { width, height } = get().size;
    matchShot(prev, camera, width, height);
    set({ camera });
    setReady(true);
    return () => {
      if (get().camera === camera) set({ camera: prev });
    };
  }, [camera, get, set]);
  return ready ? children : null;
}

/**
 * The demand loop's heart: each rendered frame asks for the next while the bench is busy or the
 * loop is awake, and marks the shadow map dirty after anything that casts a shadow moved.
 */
function Heartbeat({
  bench,
  loop,
  held,
  shadowsDirty,
}: {
  bench: OhmsLawBench;
  loop: StageLoop;
  held: boolean;
  shadowsDirty: { current: boolean };
}) {
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const dpr = useThree((s) => s.viewport.dpr);
  const memo = useMemo(createPoseMemo, []);
  const shadowLeft = useRef(0);
  const heldRef = useRef(held);
  heldRef.current = held;

  useEffect(() => {
    loop.invalidate = () => invalidate();
    loop.resetClock = () => void get().clock.getDelta();
    loop.wake(MOUNT_S);
    return () => {
      loop.invalidate = () => {};
      loop.resetClock = () => {};
    };
  }, [loop, invalidate, get]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new pixel ratio needs frames to settle.
  useEffect(() => loop.wake(RENDER_S), [loop, dpr]);
  useEffect(
    () =>
      bench.subscribe(() => {
        shadowLeft.current = SETTLE_S;
        loop.wake(SETTLE_S);
      }),
    [bench, loop],
  );
  // Hover and taps on the canvas. A press that starts on it may drag the camera, which follows the
  // window's moves (LookCamera), so while it is down any move wakes the loop, over the cards too.
  useEffect(() => {
    const el = gl.domElement;
    let down = false;
    const wake = () => loop.wake(POINTER_S);
    const press = () => {
      down = true;
      wake();
    };
    const move = () => {
      if (down) wake();
    };
    const lift = () => {
      down = false;
      wake();
    };
    el.addEventListener("pointermove", wake);
    el.addEventListener("pointerdown", press);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", lift);
    window.addEventListener("pointercancel", lift);
    return () => {
      el.removeEventListener("pointermove", wake);
      el.removeEventListener("pointerdown", press);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", lift);
      window.removeEventListener("pointercancel", lift);
    };
  }, [gl, loop]);

  useFrame((_, dt) => {
    const v = bench.visual.current;
    if (poseChanged(memo, v)) {
      shadowLeft.current = SETTLE_S;
      loop.wake(SETTLE_S);
    }
    if (shadowLeft.current > 0) {
      shadowsDirty.current = true;
      shadowLeft.current -= Math.min(dt, MAX_TICK_S);
    }
    // The rubber-band lead follows the pointer and casts a shadow: keep its shadow with it.
    if (v.pendingFrom !== null) shadowsDirty.current = true;
    const awake = loop.tick(dt);
    const next = awake || heldRef.current || benchBusy(v);
    loop.frameEnd(next);
    if (next) invalidate();
  });
  return null;
}

function Ladder({
  ladder,
  enabled,
}: {
  ladder: ReturnType<typeof createDprLadder>;
  enabled: boolean;
}) {
  useDprLadder(ladder, enabled, IDLE_GAP_S);
  return null;
}

function Focus({ parts }: { parts: readonly StagePart[] | null | undefined }) {
  const key = parts ? parts.join(",") : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: the joined names are the identity.
  const focus = useMemo(() => ({ ids: stageFocusIds(parts) }), [key]);
  useInkFocus(focus);
  return null;
}

/** Contact blobs under each part, so they sit on the desk on every tier. */
function Blobs() {
  const L = OHMS_LAW_LAYOUT;
  return (
    <>
      {(Object.keys(BLOBS) as BenchSlot[]).flatMap((slot) => {
        const [x, y, z] = L[slot].position;
        const { dx, r } = BLOBS[slot];
        return dx.map((d) => (
          <BlobShadow key={`${slot}${d}`} position={[x + d, y, z]} radiusM={r} />
        ));
      })}
    </>
  );
}

export function Stage({
  bench,
  quality,
  covered,
  audio,
  parts,
  loupe,
  eyeDeg,
  loupeHeld,
  onLoupeReturned,
  focus = null,
  dpr: pinned = null,
}: StageProps) {
  const look = useMemo(() => lookFor(quality, window.devicePixelRatio || 1), [quality]);
  // The ladder lives outside the Canvas, so a re-render keeps its rung (scene/look/dprLadder.ts).
  const ladder = useMemo(() => createDprLadder(look.dprLadder), [look]);
  const ladderDpr = useLadderDpr(ladder);
  const dpr = pinned ?? ladderDpr;
  const loop = useMemo(createStageLoop, []);
  const shadowsDirty = useRef(true);
  // Anything the page changes (the step, the ring, the hints, a close-up, the guide) re-renders
  // the stage: give it frames to show.
  useEffect(() => loop.wake(RENDER_S));

  return (
    <Canvas
      frameloop="demand"
      shadows={look.shadowMapSize > 0 ? "percentage" : false}
      dpr={dpr}
      gl={{ antialias: true }}
    >
      <LookTier.Provider value={quality}>
        <StageCamera covered={covered} loop={loop} />
        <LookLights shadowsDirty={shadowsDirty} />
        <LookGround />
        <Blobs />
        <TerminalProvider>
          <BenchParts bench={bench} quality={quality} {...parts} />
          <BenchWiring bench={bench} quality={quality} {...(audio ? { audio } : {})} />
        </TerminalProvider>
        {loupeHeld && (
          <CloseUpCamera>
            <ReadingLoupe
              target={loupe?.target ?? null}
              eyeDeg={eyeDeg}
              ruleEnd={loupe?.ruleEnd ?? "X"}
              wire={bench.params.wire}
              onReturned={onLoupeReturned}
            />
          </CloseUpCamera>
        )}
        <InkComposer quality={quality} />
        <Focus parts={focus} />
        <Heartbeat bench={bench} loop={loop} held={loupeHeld} shadowsDirty={shadowsDirty} />
        <Ladder ladder={ladder} enabled={pinned === null} />
        <ReadySignal />
      </LookTier.Provider>
    </Canvas>
  );
}

export default Stage;
