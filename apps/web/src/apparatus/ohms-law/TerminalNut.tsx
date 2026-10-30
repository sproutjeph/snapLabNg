import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { TERMINAL_IDS } from "@snaplab/engine";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTerminal, useTerminalRegistry } from "../../learn/terminals";
import type { OhmsLawVisualState, PartId, TerminalId } from "../../learn/types";
import { InkGroup } from "../../scene/ink/ink";
import {
  acquireTexture,
  boxProjectUV,
  brassSurface,
  disposeKitBag,
  paintMaterial,
} from "../materials";
import type { QualityTier } from "../meter-bridge/types";
import {
  hashString,
  knurledDisc,
  leadTexture,
  mergeAll,
  revolve,
  seeded,
  wrappedDisc,
} from "./LeadParts";
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
export const NUT_TOP_M = 0.0237;
/**
 * The tap target, unchanged by the asset pass (docs/plans/asset-pass.md, C8): at least this many
 * CSS pixels across on screen, but never more than HIT_MAX_M or less than HIT_MIN_M of radius
 * (after the 1.2 widening its radius is at most 3 cm, so nuts only 6.2 cm apart, the key's, do not
 * overlap), stretched HIT_TALL times upward.
 */
export const MIN_HIT_PX = 44;
export const HIT_MAX_M = 0.025;
export const HIT_MIN_M = 0.02;
/** Vertical stretch of the target: 4 cm half-height, centred 3 cm up, so it spans -1 to 7 cm. */
export const HIT_TALL = 2;

export type NutCap = NonNullable<TerminalNutProps["cap"]>;

/** The lead colour whose speckled skin each insulating cap shares. */
const CAP_LEAD = { red: "red", black: "black" } as const;

const _world = new THREE.Vector3();
const _cam = new THREE.Vector3();

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The kit's brass palette (apparatus/materials/textures.ts): warm gold, and the ochre in its shade. */
const BRASS_LIGHT = [226, 196, 108] as const;
const BRASS_DARK = [169, 133, 50] as const;

/**
 * The nut's brass skin: turned brass with fine brushing along u, patchy dark patina where hands
 * have not rubbed it, a few pits, and short bright scuffs on the high spots. 256 px (128 on low),
 * painted once (never per frame), seamless both ways, and shared by every nut through the
 * materials kit's cache (acquireTexture), which frees it when the last nut lets go. The kit's own
 * brass texture is made for 20 cm parts; at a nut's 2.4 cm its streaks and tarnish never show.
 */
function nutBrassTexture(quality: QualityTier): THREE.CanvasTexture {
  const size = quality === "low" ? 128 : 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  const rnd = seeded(0x62726173);
  const img = ctx.createImageData(size, size);
  // Brushing: a level for every few rows, eased between, so the lines are broad and soft (a row
  // of its own per pixel row would alias into bands, like wood grain).
  const knots = Array.from({ length: size / 6 }, () => rnd() - 0.5);
  const drift = new Float32Array(size);
  const beat = new Float32Array(size);
  for (let y = 0; y < size; y++) {
    drift[y] = rnd() * Math.PI * 2;
    beat[y] = 1 + Math.floor(rnd() * 3);
  }
  for (let y = 0; y < size; y++) {
    const k = y / 6;
    const k0 = Math.floor(k) % knots.length;
    const k1 = (k0 + 1) % knots.length;
    const f = k - Math.floor(k);
    const lift = (knots[k0] ?? 0) * (1 - f) + (knots[k1] ?? 0) * f;
    for (let x = 0; x < size; x++) {
      // A whole number of beats along each row, so the row tiles.
      const wave = Math.sin((x / size) * Math.PI * 2 * (beat[y] ?? 1) + (drift[y] ?? 0));
      const t = Math.min(1, Math.max(0, 0.6 + 0.16 * lift + 0.04 * wave));
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const d = BRASS_DARK[c] ?? 0;
        img.data[i + c] = d + ((BRASS_LIGHT[c] ?? 0) - d) * t;
      }
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Patina: big soft dark blotches, a greenish-brown.
  ctx.fillStyle = "#4f3a14";
  for (let i = 0; i < 16; i++) {
    ctx.globalAlpha = 0.1 + rnd() * 0.1;
    wrappedDisc(ctx, size, rnd() * size, rnd() * size, size * (0.06 + rnd() * 0.13));
  }
  // Pits.
  ctx.fillStyle = "#3a2a0c";
  for (let i = 0; i < (quality === "low" ? 30 : 90); i++) {
    ctx.globalAlpha = 0.35 + rnd() * 0.4;
    wrappedDisc(ctx, size, rnd() * size, rnd() * size, (0.5 + rnd() * 1.1) * (size / 256));
  }
  // Scuffs: bright flecks where a thumb has worn it.
  ctx.fillStyle = "#fff0b8";
  for (let i = 0; i < (quality === "low" ? 20 : 60); i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.35;
    wrappedDisc(ctx, size, rnd() * size, rnd() * size, (0.5 + rnd() * 0.9) * (size / 256));
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
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

// ---- The nut's build, from the foot up (metres) -------------------------------------------------
// A wide flat washer, a hex collar, a knurled nut, and on top either an insulating cap (the
// meters: red +, black −) or the bare threaded stud (everywhere else). The washer and collar are
// one brass piece; the knurled nut with its stud, the cap and the socket are the `knob`, which a
// loosened joint will raise a little. Chunky and stylised, after docs/design/asset-pass/terminal
// .webp: the nut is about 2.4 cm across the washer and as tall, so it reads as a thing to tap.

const WASHER_R = 0.0115;
const WASHER_TOP = 0.0024;
const HEX_R = 0.0092;
const HEX_TOP = 0.0098;
const KNURL_R = 0.0099;
const KNURL_TOP = 0.0148;
const CAP_R = 0.0072;
const STUD_R = 0.0041;
const STUD_CREST = 0.0048;
const SOCKET_R = 0.0029;
/** The brass skin: one tile covers this much of a nut (see nutBrassTexture). */
const BRASS_TILE_M = 0.04;

export interface NutGeometries {
  /** The washer and the hex collar: brass. */
  base: THREE.BufferGeometry;
  /** The knurled nut, and for a bare terminal the threaded stud above it: brass. */
  knurl: THREE.BufferGeometry;
  /** The insulating cap on a meter's terminal, or null on a bare one. */
  cap: THREE.BufferGeometry | null;
  /** The dark socket disc a plug pin goes into, flat on the top. */
  socket: THREE.BufferGeometry;
}

/**
 * The nut's geometry, pure (no WebGL, no canvas): `seed` turns the hex and the knurl a little
 * and shifts the brass texture's window, so no two nuts are quite alike. The top of the knob is
 * exactly NUT_TOP_M, where the plug's brass collar sits.
 */
export function makeNutGeometries(quality: QualityTier, cap: NutCap, seed = 0): NutGeometries {
  const low = quality === "low";
  const rnd = seeded(seed);
  const turn = rnd() * Math.PI;
  // The washer's top runs right in to the stud, under the hex collar. The hex's flats sit nearer
  // the axis than its corners, above a chamfer that faces down, so a ring that stopped short of
  // them would leave a see-through crescent at the hex's foot, six of them round the nut.
  const washer = revolve(
    [
      [WASHER_R, 0],
      [WASHER_R, 0.0016],
      [WASHER_R - 0.0009, WASHER_TOP],
      [STUD_R, WASHER_TOP],
    ],
    low ? 8 : 20,
  );
  // The hex collar, flat-faced with chamfered edges; its top is under the knurled nut.
  const hex = revolve(
    [
      [HEX_R - 0.0014, WASHER_TOP],
      [HEX_R, WASHER_TOP + 0.001],
      [HEX_R, HEX_TOP - 0.001],
      [HEX_R - 0.0014, HEX_TOP],
    ],
    6,
    true,
    0.26 + turn * 0.1,
  );
  const base = mergeAll([washer, hex]);

  const ridges = knurledDisc(KNURL_R, KNURL_TOP - HEX_TOP, low ? 9 : 16, 0.9, turn);
  ridges.translate(0, HEX_TOP, 0);
  const upper: THREE.BufferGeometry[] = [ridges];
  let capGeo: THREE.BufferGeometry | null = null;
  if (cap === "brass") {
    // The threaded stud: valleys and crests up to the top, with a flat top ring round the socket.
    const crests = low ? 2 : 3;
    const pitch = (NUT_TOP_M - KNURL_TOP) / crests;
    const stud: Array<readonly [number, number]> = [[STUD_R, KNURL_TOP]];
    for (let k = 0; k < crests; k++) {
      stud.push([STUD_CREST, KNURL_TOP + (k + 0.5) * pitch]);
      stud.push([STUD_R, KNURL_TOP + (k + 1) * pitch]);
    }
    stud.push([SOCKET_R, NUT_TOP_M]);
    upper.push(revolve(stud, low ? 7 : 10));
  } else {
    // The insulating cap: a short dome on the knurled nut with a flat top for the plug to seat on.
    capGeo = revolve(
      [
        [CAP_R, KNURL_TOP],
        [CAP_R, 0.0176, true],
        [CAP_R - 0.0003, 0.0204, true],
        [0.0057, 0.0226, true],
        [0.0044, NUT_TOP_M],
        [SOCKET_R, NUT_TOP_M],
      ],
      low ? 8 : 12,
    );
  }
  const knurl = mergeAll(upper);
  // One brass skin on both brass pieces, its window moved by the seed.
  const ox = rnd();
  const oy = rnd();
  for (const g of [base, knurl]) {
    boxProjectUV(g, [BRASS_TILE_M, BRASS_TILE_M]);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + ox, uv.getY(i) + oy);
  }
  const socket = new THREE.CircleGeometry(SOCKET_R, low ? 8 : 10);
  socket.rotateX(-Math.PI / 2);
  socket.translate(0, NUT_TOP_M + 0.0001, 0);
  return { base, knurl, cap: capGeo, socket };
}

/**
 * A knurled terminal nut that lead ends attach to: a brass washer, hex collar and knurled nut,
 * under an insulating cap on the meters or a bare threaded stud on the other parts, with a socket
 * in its top for the plug. Registers itself in the terminal registry and forwards taps to it. When
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
    const seed = hashString(`nut-${id}`);
    const geo = makeNutGeometries(quality, cap, seed);
    const brassTex = acquireTexture(`nut-brass:${quality}`, () => nutBrassTexture(quality));
    const capSkin =
      cap === "brass"
        ? null
        : acquireTexture(`lead-skin:${CAP_LEAD[cap]}:${quality}`, () =>
            leadTexture(CAP_LEAD[cap], quality),
          );
    const ink = new THREE.MeshBasicMaterial({ color: "#1d2430", depthWrite: false });
    ink.polygonOffset = true;
    ink.polygonOffsetFactor = -2;
    const halo = new THREE.MeshBasicMaterial({ color: "#f4ecdc", depthWrite: false });
    halo.polygonOffset = true;
    halo.polygonOffsetFactor = -1;
    return {
      ...geo,
      brassTex,
      // The pulsing ring is unchanged from before the asset pass.
      ringInk: dashedRing(0.02145, 0.02444, 12),
      ringHalo: dashedRing(0.02041, 0.02548, 12),
      // The kit's own brass (warm, a little rough, metalness 0.3). The look's lights lift an
      // albedo by about half, so more metal or a brighter tint turns it lemon, not brass.
      brassMat: brassSurface(seed, { map: brassTex }),
      // The moulded cap shares the leads' speckled skin of its colour, so a red cap and a red lead
      // are one plastic; the material only tints it a hair.
      capSkin,
      capMat: capSkin ? paintMaterial("#f6f6f6", seed, { map: capSkin, amount: 0.02 }) : null,
      socketMat: new THREE.MeshBasicMaterial({ color: "#0c0c0e" }),
      ink,
      halo,
    };
  }, [id, quality, cap]);
  useEffect(() => () => disposeKitBag(res), [res]);

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
      // The target is a tall ellipsoid, centred 3 cm up and 4 cm either way, so an oblique tap on a
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
        <mesh geometry={res.base} material={res.brassMat} castShadow receiveShadow />
        <group name="knob">
          <mesh geometry={res.knurl} material={res.brassMat} castShadow receiveShadow />
          {res.cap && res.capMat ? (
            <mesh geometry={res.cap} material={res.capMat} castShadow receiveShadow />
          ) : null}
          <mesh geometry={res.socket} material={res.socketMat} />
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
