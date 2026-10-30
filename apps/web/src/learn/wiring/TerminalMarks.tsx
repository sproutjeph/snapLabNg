import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { TERMINAL_IDS } from "@snaplab/engine";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { mergeAll } from "../../apparatus/ohms-law/LeadParts";
import { HIT_TALL, NUT_TOP_M } from "../../apparatus/ohms-law/TerminalNut";
import { SHAKE_S, shakeAt } from "../stage/motion";
import type { StageMotion } from "../stage/stageMotion";
import { useTerminalRegistry } from "../terminals";
import type { TerminalId } from "../types";

// Practise feel on the bench's terminals (docs/plans/wave-2-lean.md, 2b-motion), drawn by the
// wiring layer so the nuts themselves (2a-real's TerminalNut) stay as they are:
//   - TerminalMarks: a pulsing dashed ink ring on each of the beat's two target terminals, a
//     softer ring under the nut the pointer is over, and a wrong tap's shake (0.3 s), which moves
//     the nuts themselves (and with them the plugs seated on them) and puts them back after.
//   - TerminalHits: bigger tap targets than the nuts' own 44 px, as big as the gap to the
//     nearest other nut allows, and the hover that lights a nut.

/** Up to this many rings at once: two targets and the hovered nut. */
const RINGS = 3;
const PULSE_RATE = 4.5;

/** Dashes of a ring lying flat (normal +y), as TerminalNut draws its own. */
function dashedRing(inner: number, outer: number, dashes: number): THREE.BufferGeometry {
  const arc = ((Math.PI * 2) / dashes) * 0.62;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < dashes; i++) {
    parts.push(new THREE.RingGeometry(inner, outer, 4, 1, (i / dashes) * Math.PI * 2, arc));
  }
  const merged = mergeAll(parts);
  merged.rotateX(-Math.PI / 2);
  return merged;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const _w = new THREE.Vector3();

/** Rings on the targets and the hovered nut, and the wrong tap's shake. */
export function TerminalMarks({
  marks,
  quality,
}: {
  marks: StageMotion["marks"];
  quality: QualityTier;
}) {
  const registry = useTerminalRegistry();
  const rings = useRef<Array<THREE.Group | null>>([]);
  const reduced = useMemo(prefersReducedMotion, []);
  const res = useMemo(() => {
    const dashes = quality === "low" ? 10 : 14;
    const ink = new THREE.MeshBasicMaterial({ color: "#1d2430", depthWrite: false });
    ink.polygonOffset = true;
    ink.polygonOffsetFactor = -2;
    const halo = new THREE.MeshBasicMaterial({ color: "#f4ecdc", depthWrite: false });
    halo.polygonOffset = true;
    halo.polygonOffsetFactor = -1;
    // The hover ring: solid, lighter, a hair wider than a target's, so the two read apart.
    const soft = new THREE.MeshBasicMaterial({
      color: "#1d2430",
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    soft.polygonOffset = true;
    soft.polygonOffsetFactor = -2;
    return {
      ringInk: dashedRing(0.02145, 0.02444, dashes),
      ringHalo: dashedRing(0.02041, 0.02548, dashes),
      hover: (() => {
        const g = new THREE.RingGeometry(0.0232, 0.0262, quality === "low" ? 24 : 48);
        g.rotateX(-Math.PI / 2);
        return g;
      })(),
      ink,
      halo,
      soft,
    };
  }, [quality]);
  useEffect(
    () => () => {
      res.ringInk.dispose();
      res.ringHalo.dispose();
      res.hover.dispose();
      res.ink.dispose();
      res.halo.dispose();
      res.soft.dispose();
    },
    [res],
  );

  /** The nuts shaking now, with where each stood before the shake. */
  const shaking = useRef(new Map<TerminalId, { obj: THREE.Object3D; x: number }>());
  const seenShake = useRef(-1);
  useEffect(
    () => () => {
      for (const s of shaking.current.values()) s.obj.position.x = s.x;
      shaking.current.clear();
    },
    [],
  );

  useFrame((state) => {
    // ---- The shake: the nut's own group (the parent of its attach point) swings and returns ----
    const nowS = performance.now() / 1000;
    const sh = shaking.current;
    if (marks.shakeAtS !== seenShake.current) {
      seenShake.current = marks.shakeAtS;
      for (const s of sh.values()) s.obj.position.x = s.x;
      sh.clear();
      for (const id of marks.shake) {
        const obj = registry.get(id)?.object.parent;
        if (obj) sh.set(id, { obj, x: obj.position.x });
      }
    }
    const t = nowS - marks.shakeAtS;
    for (const s of sh.values()) s.obj.position.x = s.x + (reduced ? 0 : shakeAt(t));
    if (sh.size > 0 && t >= SHAKE_S) {
      for (const s of sh.values()) s.obj.position.x = s.x;
      sh.clear();
    }

    // ---- The rings ----
    const k = reduced ? 1 : 1 + 0.12 * Math.sin(state.clock.elapsedTime * PULSE_RATE);
    for (let i = 0; i < RINGS; i++) {
      const g = rings.current[i];
      if (!g) continue;
      const id = i < 2 ? marks.targets[i] : marks.hover;
      const on =
        id !== undefined &&
        id !== null &&
        (i < 2 || !marks.targets.includes(id)) &&
        registry.worldPosition(id, _w);
      g.visible = on;
      if (!on) continue;
      g.position.set(_w.x, _w.y - NUT_TOP_M + 0.0016, _w.z);
      if (i < 2) {
        g.scale.set(k, 1, k);
        if (!reduced) g.rotation.y = state.clock.elapsedTime * 0.5;
      }
    }
  });

  return (
    <group>
      {[0, 1].map((i) => (
        <group
          key={i}
          ref={(g) => {
            rings.current[i] = g;
          }}
          visible={false}
        >
          <mesh geometry={res.ringHalo} material={res.halo} renderOrder={5} />
          <mesh geometry={res.ringInk} material={res.ink} renderOrder={6} />
        </group>
      ))}
      <group
        ref={(g) => {
          rings.current[2] = g;
        }}
        visible={false}
      >
        <mesh geometry={res.hover} material={res.soft} renderOrder={6} />
      </group>
    </group>
  );
}

/** Her tap target round a nut: at least this many CSS px across (the nut's own is 44). */
export const BIG_HIT_PX = 60;
/** …but never more than this share of the way to the nearest other nut, so targets never meet. */
export const HIT_NEIGHBOUR_SHARE = 0.42;
/** …and never more than this radius, metres. */
export const BIG_HIT_MAX_M = 0.035;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _cam = new THREE.Vector3();

/**
 * The radius of a nut's big target: BIG_HIT_PX across on screen at `metresPerPx`, capped by the
 * gap to its nearest neighbour (`nearestM`) and BIG_HIT_MAX_M. Pure, for the tests.
 */
export function bigHitRadius(metresPerPx: number, nearestM: number): number {
  const want = (BIG_HIT_PX / 2) * metresPerPx;
  return Math.max(0.005, Math.min(want, nearestM * HIT_NEIGHBOUR_SHARE, BIG_HIT_MAX_M));
}

/** Bigger invisible tap targets on every nut, and the hover. */
export function TerminalHits({ marks }: { marks: StageMotion["marks"] }) {
  const registry = useTerminalRegistry();
  const hits = useRef<Array<THREE.Mesh | null>>([]);
  const res = useMemo(
    () => ({ geo: new THREE.SphereGeometry(1, 10, 8), mat: new THREE.MeshBasicMaterial() }),
    [],
  );
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
      document.body.style.cursor = "";
    },
    [res],
  );

  useFrame((s) => {
    const m5 = Math.max(1e-6, Math.abs(s.camera.projectionMatrix.elements[5] ?? 1));
    const ortho = (s.camera as THREE.OrthographicCamera).isOrthographicCamera === true;
    s.camera.getWorldPosition(_cam);
    for (let i = 0; i < TERMINAL_IDS.length; i++) {
      const h = hits.current[i];
      const id = TERMINAL_IDS[i];
      if (!h || !id) continue;
      if (!registry.worldPosition(id, _a)) {
        h.visible = false;
        h.scale.setScalar(1e-4);
        continue;
      }
      let nearest = Number.POSITIVE_INFINITY;
      for (const other of TERMINAL_IDS) {
        if (other === id || !registry.worldPosition(other, _b)) continue;
        nearest = Math.min(nearest, Math.hypot(_a.x - _b.x, _a.z - _b.z));
      }
      const worldH = (2 / m5) * (ortho ? 1 : Math.max(0.05, _cam.distanceTo(_a)));
      const r = bigHitRadius(worldH / Math.max(1, s.size.height), nearest);
      // Centred a little above the nut's top, tall like the nut's own target, so an oblique tap
      // on a seated plug still finds it.
      h.position.set(_a.x, _a.y - NUT_TOP_M + 0.03, _a.z);
      h.scale.set(r, Math.max(r, 0.02 * HIT_TALL), r);
    }
  });

  const down = (id: TerminalId) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    registry.tap(id);
  };
  const over = (id: TerminalId) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    marks.hover = id;
    document.body.style.cursor = "pointer";
  };
  const out = (id: TerminalId) => () => {
    if (marks.hover === id) marks.hover = null;
    document.body.style.cursor = "";
  };
  return (
    <group>
      {TERMINAL_IDS.map((id, i) => (
        <mesh
          key={id}
          ref={(m) => {
            hits.current[i] = m;
          }}
          geometry={res.geo}
          material={res.mat}
          visible={false}
          onPointerDown={down(id)}
          onPointerOver={over(id)}
          onPointerOut={out(id)}
        />
      ))}
    </group>
  );
}
