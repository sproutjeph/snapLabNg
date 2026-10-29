import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { TERMINAL_IDS } from "@snaplab/engine";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTerminal, useTerminalRegistry } from "../../learn/terminals";
import type { OhmsLawVisualState, PartId, TerminalId } from "../../learn/types";
import { InkGroup } from "../../scene/ink/ink";
import type { QualityTier } from "../meter-bridge/types";
import { hashString, jitterColour, mergeAll, placeAt, seeded } from "./LeadParts";
import { INK_IDS, TERMINAL_LABELS } from "./layout";

export interface TerminalNutProps {
  id: TerminalId;
  part: PartId;
  /** Local position inside the parent part, at the foot of the nut. */
  position: readonly [number, number, number];
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  /** Insulated caps on the meters: red for +, black for −. Brass everywhere else. */
  cap?: "brass" | "red" | "black";
}

/** Height of the nut's top above its foot, where a lead's plug seats. */
export const NUT_TOP_M = 0.0215;
/** The least size of the tap target on screen, in CSS pixels. */
const MIN_HIT_PX = 44;
/** The tap target never grows past this, so nuts only 6 cm apart (the key's) do not overlap. */
const HIT_MAX_M = 0.028;
const HIT_MIN_M = 0.02;
/** Vertical stretch of the target: 3.2 cm half-height, so it spans 0 to 6 cm above the foot. */
const HIT_TALL = 2;

const CAP_COLOURS = { red: "#a82a22", black: "#1f1f22", brass: "#b08d3c" } as const;

const _world = new THREE.Vector3();
const _cam = new THREE.Vector3();

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Terminals are 1.3 times the Wave 0 size: chunky enough to tap on a phone and to read from across the bench. */
const K = 1.3;

/** A knurled knob: a toothed disc extruded upward from y = 0 to `height`. */
function knurledKnob(radius: number, height: number, teeth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const steps = teeth * 2;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.88;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Dashes of a ring lying flat (normal +y). */
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

/**
 * A knurled terminal nut that lead ends attach to: a brass washer and collar under a knurled
 * knob (brass, or red or black insulated on the meters) with a hole in its top for the plug.
 * Registers itself in the terminal registry and forwards taps to it. When
 * `state.current.ring === id` a dashed ink ring pulses around it (still, if the student asks
 * for reduced motion). The tap target is grown in useFrame so it stays about 44 px across.
 *
 * Joint state (tightened or loose) comes later: the knob sits in `knob`, a group at rest at
 * y = 0, ready to be raised a couple of millimetres.
 */
export function TerminalNut({
  id,
  part,
  position,
  state,
  quality,
  cap = "brass",
}: TerminalNutProps) {
  const attach = useRef<THREE.Object3D>(null);
  const hit = useRef<THREE.Mesh>(null);
  const ringGroup = useRef<THREE.Group>(null);
  const registry = useTerminalRegistry();
  useTerminal(id, part, TERMINAL_LABELS[id], attach);
  const reduced = useMemo(prefersReducedMotion, []);
  const inkId = INK_IDS.nutBase + Math.max(0, TERMINAL_IDS.indexOf(id));

  const res = useMemo(() => {
    const rng = seeded(hashString(`nut-${id}`));
    const low = quality === "low";
    // A washer, a hex nut and a neck: the brass the student sees from across the bench.
    const base = mergeAll([
      placeAt(
        new THREE.CylinderGeometry(0.0085 * K, 0.0088 * K, 0.003, low ? 10 : 20),
        0,
        0.0015,
        0,
      ),
      placeAt(
        new THREE.CylinderGeometry(0.0078 * K, 0.0078 * K, 0.0068, 6),
        0,
        0.0064,
        0,
        0,
        0.26,
        0,
      ),
      placeAt(
        new THREE.CylinderGeometry(0.0046 * K, 0.0046 * K, 0.004, low ? 8 : 14),
        0,
        0.0112,
        0,
      ),
    ]);
    const knob = knurledKnob(0.0068 * K, 0.0078 * K, low ? 10 : 18);
    knob.translate(0, 0.0125, 0);
    const hole = new THREE.CircleGeometry(0.0022 * K, low ? 8 : 12);
    hole.rotateX(-Math.PI / 2);
    hole.translate(0, 0.0125 + 0.0078 * K + 0.0001, 0);
    const ink = new THREE.MeshBasicMaterial({ color: "#1d2430", depthWrite: false });
    ink.polygonOffset = true;
    ink.polygonOffsetFactor = -2;
    const halo = new THREE.MeshBasicMaterial({ color: "#f4ecdc", depthWrite: false });
    halo.polygonOffset = true;
    halo.polygonOffsetFactor = -1;
    return {
      base,
      knob,
      hole,
      ringInk: dashedRing(0.0165 * K, 0.0188 * K, 12),
      ringHalo: dashedRing(0.0157 * K, 0.0196 * K, 12),
      baseMat: new THREE.MeshStandardMaterial({
        color: jitterColour("#b08d3c", rng),
        roughness: 0.6,
        metalness: 0.2,
      }),
      knobMat: new THREE.MeshStandardMaterial({
        color: jitterColour(CAP_COLOURS[cap], rng, cap === "brass" ? 0.03 : 0.015),
        roughness: cap === "brass" ? 0.6 : 0.75,
        metalness: cap === "brass" ? 0.2 : 0,
      }),
      holeMat: new THREE.MeshBasicMaterial({ color: "#0c0c0e" }),
      ink,
      halo,
    };
  }, [id, quality, cap]);
  useEffect(
    () => () => {
      for (const v of Object.values(res)) v.dispose();
    },
    [res],
  );

  useFrame((s) => {
    const ring = ringGroup.current;
    if (ring) {
      const on = state.current.ring === id;
      ring.visible = on;
      if (on && !reduced) {
        const t = s.clock.elapsedTime;
        const k = 1 + 0.12 * Math.sin(t * 4.5);
        ring.scale.set(k, 1, k);
        ring.rotation.y = t * 0.5;
      }
    }
    const h = hit.current;
    if (h) {
      // Metres per CSS pixel at the nut, for a perspective or an orthographic camera (the
      // projection matrix already carries zoom and any view offset).
      const m5 = Math.max(1e-6, Math.abs(s.camera.projectionMatrix.elements[5] ?? 1));
      let worldH = 2 / m5;
      if (!(s.camera as THREE.OrthographicCamera).isOrthographicCamera) {
        h.getWorldPosition(_world);
        worldH *= Math.max(0.05, s.camera.getWorldPosition(_cam).distanceTo(_world));
      }
      const metresPerPx = worldH / Math.max(1, s.size.height);
      const r = Math.min(HIT_MAX_M, Math.max(HIT_MIN_M, (MIN_HIT_PX / 2) * metresPerPx));
      // The target is a tall ellipsoid, centred 3 cm up and reaching 6 cm, so an oblique tap on a
      // seated plug still finds the nut; it is widened a fifth to keep the nut-height width.
      const k = (r / HIT_MIN_M) * 1.2;
      if (Math.abs(h.scale.x - k) > 0.02) h.scale.set(k, HIT_TALL, k);
    }
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    registry.tap(id);
  };
  return (
    <group position={[position[0], position[1], position[2]]}>
      <InkGroup id={inkId} thin>
        <mesh geometry={res.base} material={res.baseMat} castShadow receiveShadow />
        <group name="knob">
          <mesh geometry={res.knob} material={res.knobMat} castShadow receiveShadow />
          <mesh geometry={res.hole} material={res.holeMat} />
        </group>
        <group ref={ringGroup} position-y={0.0016} visible={false}>
          <mesh geometry={res.ringHalo} material={res.halo} renderOrder={5} />
          <mesh geometry={res.ringInk} material={res.ink} renderOrder={6} />
        </group>
      </InkGroup>
      <object3D ref={attach} position-y={NUT_TOP_M} />
      <mesh ref={hit} position-y={0.03} onPointerDown={onDown} visible={false}>
        <sphereGeometry args={[HIT_MIN_M, 8, 6]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
