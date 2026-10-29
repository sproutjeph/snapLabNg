import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTerminalRegistry } from "../../learn/terminals";
import type { LeadColour, OhmsLawVisualState, TerminalId } from "../../learn/types";
import { inkTag } from "../../scene/ink/ink";
import { acquireTexture, brassSurface, releaseTexture } from "../materials";
import type { QualityTier } from "../meter-bridge/types";
import {
  CABLE_SEAT_M,
  floorAt,
  hashString,
  jitterColour,
  LEAD_RADIUS_M,
  leadTexture,
  makePlugGeometries,
  PLUG_HEIGHT_M,
  seeded,
} from "./LeadParts";
import { INK_IDS } from "./layout";

export interface LeadProps {
  from: TerminalId;
  /** The other terminal, or "pointer" for the rubber band while she picks the other end. */
  to: TerminalId | "pointer";
  colour: LeadColour;
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  /** Tap the lead to remove it. */
  onTap?: () => void;
  /**
   * How much of the lead is drawn, 0..1 (default 1): the cable grows from the `from` plug along
   * its curve, and the far plug pops in as it arrives. Pass a ref-like object and change its
   * `.current` in useFrame to animate without a React render per frame (Watch's draw-on).
   */
  drawn?: number | { current: number };
}

/**
 * A lead's sampled cable centreline, published so the current-flow dots can follow it. Points
 * run from the `from` plug to the `to` plug, xyz packed, in the Lead's parent space (the same
 * space as its siblings). `version` rises each time the points are rewritten.
 */
export interface LeadCurve {
  readonly points: Float32Array;
  /** Number of points (xyz triples) in `points`. */
  readonly count: number;
  version: number;
}

/**
 * Per visual-state ref (one bench): which mounted Lead draws which bench lead (by lead id), and
 * the curve each publishes. A Lead's props carry only its two ends, so each mounted Lead claims
 * one unclaimed lead in `state.current.leads` with its ends (and colour, when one matches);
 * two parallel leads between the same nuts therefore publish under their own ids.
 */
interface LeadBook {
  owner: Map<string, object>;
  curve: Map<string, LeadCurve>;
}
const LEAD_BOOKS = new WeakMap<object, LeadBook>();

function bookOf(state: object): LeadBook {
  let b = LEAD_BOOKS.get(state);
  if (!b) {
    b = { owner: new Map(), curve: new Map() };
    LEAD_BOOKS.set(state, b);
  }
  return b;
}

/** The cable of bench lead `leadId` (from lead.a to lead.b), or undefined while it is not drawn. */
export function getLeadCurve(
  state: { current: OhmsLawVisualState },
  leadId: string,
): LeadCurve | undefined {
  return LEAD_BOOKS.get(state)?.curve.get(leadId);
}

/** Keeps `claim.id` on one bench lead with these ends (claimed by no other Lead). No allocation. */
function claimLead(
  book: LeadBook,
  leads: OhmsLawVisualState["leads"],
  claim: { id: string | null },
  from: TerminalId,
  to: TerminalId,
  colour: LeadColour,
): void {
  if (claim.id !== null) {
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      if (l && l.id === claim.id && l.a === from && l.b === to) return;
    }
    releaseLead(book, claim);
  }
  for (let pass = 0; pass < 2 && claim.id === null; pass++) {
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      if (!l || l.a !== from || l.b !== to || book.owner.has(l.id)) continue;
      if (pass === 0 && l.colour !== colour) continue;
      claim.id = l.id;
      book.owner.set(l.id, claim);
      break;
    }
  }
}

function releaseLead(book: LeadBook, claim: { id: string | null }): void {
  if (claim.id === null) return;
  if (book.owner.get(claim.id) === claim) {
    book.owner.delete(claim.id);
    book.curve.delete(claim.id);
  }
  claim.id = null;
}

/** Where along the lead the control points sit (0 = first plug, 1 = second). */
const CTRL_T = [0, 0.04, 0.12, 0.25, 0.4, 0.5, 0.6, 0.75, 0.88, 0.96, 1] as const;
/** The lowest the cable's centre goes: it lies on the desk. */
const FLOOR_Y = LEAD_RADIUS_M + 0.0004;
/** How far the pointer's plug floats above the bench point while she carries it. */
const CARRY_LIFT_M = 0.022;
const HIT_RADIUS_M = 0.007;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _la = new THREE.Vector3();
const _lb = new THREE.Vector3();
const _inv = new THREE.Matrix4();

/** Lifts a sampled world point onto whatever it would sink into (a part's top, or the desk). */
function restOnBench(p: THREE.Vector3): void {
  const y = floorAt(p.x, p.z) + LEAD_RADIUS_M;
  if (p.y < y) p.y = y;
}
const _tan = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _nrm = new THREE.Vector3();
const _bin = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _upY = new THREE.Vector3(0, 1, 0);
const _upX = new THREE.Vector3(1, 0, 0);

/** One tile of the cable's speckle skin along its length, in metres. */
const SKIN_TILE_M = 0.05;

/**
 * Writes a tube of `radius` around the polyline `c` (n + 1 points, xyz packed) into a
 * TubeGeometry's own buffers, with a parallel-transported frame (the same idea as the metre
 * bridge's TubeWire). The uv runs along the cable in metres (SKIN_TILE_M a tile) and once round,
 * so the speckle keeps its size whatever the cable's length. Allocation-free, so it runs on the
 * frame the ends move.
 */
function writeTube(
  geo: THREE.TubeGeometry,
  c: Float32Array,
  n: number,
  radial: number,
  radius: number,
): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const stride = radial + 1;
  let along = 0;
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      along += Math.hypot(
        (c[i * 3] ?? 0) - (c[i * 3 - 3] ?? 0),
        (c[i * 3 + 1] ?? 0) - (c[i * 3 - 2] ?? 0),
        (c[i * 3 + 2] ?? 0) - (c[i * 3 - 1] ?? 0),
      );
    }
    const i0 = Math.max(0, i - 1) * 3;
    const i1 = Math.min(n, i + 1) * 3;
    _tan
      .set(
        (c[i1] ?? 0) - (c[i0] ?? 0),
        (c[i1 + 1] ?? 0) - (c[i0 + 1] ?? 0),
        (c[i1 + 2] ?? 0) - (c[i0 + 2] ?? 0),
      )
      .normalize();
    if (i === 0) {
      const ref = Math.abs(_tan.y) < 0.9 ? _upY : _upX;
      _bin.crossVectors(_tan, ref).normalize();
      _nrm.crossVectors(_bin, _tan).normalize();
    } else {
      _axis.crossVectors(_prev, _tan);
      if (_axis.lengthSq() > 1e-10) {
        _axis.normalize();
        _nrm.applyAxisAngle(_axis, Math.acos(Math.max(-1, Math.min(1, _prev.dot(_tan)))));
      }
      _nrm.addScaledVector(_tan, -_nrm.dot(_tan)).normalize();
      _bin.crossVectors(_tan, _nrm).normalize();
    }
    _prev.copy(_tan);
    const cx = c[i * 3] ?? 0;
    const cy = c[i * 3 + 1] ?? 0;
    const cz = c[i * 3 + 2] ?? 0;
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const u = -Math.cos(ang);
      const v = Math.sin(ang);
      const nx = u * _nrm.x + v * _bin.x;
      const ny = u * _nrm.y + v * _bin.y;
      const nz = u * _nrm.z + v * _bin.z;
      const k = i * stride + j;
      pos.setXYZ(k, cx + radius * nx, cy + radius * ny, cz + radius * nz);
      nor.setXYZ(k, nx, ny, nz);
      uv.setXY(k, along / SKIN_TILE_M, j / radial);
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeBoundingSphere();
}

/**
 * Sets the curve's control points: a drooping cable from plug top `s` to plug top `e`. Exported
 * so the kit's tests use this path, not a copy of it; its shape is frozen with them.
 */
export function shapeCable(
  pts: THREE.Vector3[],
  s: THREE.Vector3,
  e: THREE.Vector3,
  bulge: number,
): void {
  const dx = e.x - s.x;
  const dz = e.z - s.z;
  const d = Math.hypot(dx, dz);
  const nx = d > 1e-5 ? -dz / d : 0;
  const nz = d > 1e-5 ? dx / d : 1;
  // A flexible cable hangs by about a third of its span, but never below the desk.
  const droop = 0.012 + 0.3 * d;
  const side = bulge * Math.min(d, 0.5) * 0.22;
  for (let i = 0; i < CTRL_T.length; i++) {
    const t = CTRL_T[i] ?? 0;
    const belly = 4 * t * (1 - t);
    // The ends leave the plugs a little stiffly before they droop.
    // (zero at the plug itself, so the cable meets it, rising to about a centimetre by t = 0.04).
    const u = Math.min(t, 1 - t) * 26;
    const stiff = 0.03 * u * Math.exp(-u);
    const p = pts[i];
    if (!p) continue;
    p.set(
      s.x + dx * t + nx * side * belly,
      Math.max(FLOOR_Y, s.y + (e.y - s.y) * t - droop * belly + stiff),
      s.z + dz * t + nz * side * belly,
    );
  }
}

/**
 * An insulated flexible lead with a banana plug at each end, sagging between two terminals
 * (a tube on a Catmull-Rom curve). Both ends' world positions are read from the registry
 * every frame; the tube is rebuilt in place only on a frame where an end moved. With
 * `to = "pointer"` the free end follows `state.current.pointer`. The cable is worked out in
 * world space, rests on the bench parts' footprints (`floorAt`), and stacks its plugs on any
 * earlier leads at the same nut. A fatter invisible tube along the middle takes the tap.
 */
export function Lead({ from, to, colour, state, quality, onTap, drawn = 1 }: LeadProps) {
  const registry = useTerminalRegistry();
  const root = useRef<THREE.Group>(null);
  const plugA = useRef<THREE.Group>(null);
  const plugB = useRef<THREE.Group>(null);
  const pinsA = useRef<THREE.Group>(null);
  const pinsB = useRef<THREE.Group>(null);
  const tagged = useRef<THREE.Group>(null);
  const plugs = useRef<THREE.Group>(null);
  const hitMesh = useRef<THREE.Mesh>(null);

  const res = useMemo(() => {
    const low = quality === "low";
    const rng = seeded(hashString(`lead-${from}-${to}-${colour}`));
    const mainN = low ? 28 : 56;
    const radial = low ? 6 : quality === "mid" ? 10 : 12;
    const hitN = low ? 10 : 18;
    const pts = CTRL_T.map((t) => new THREE.Vector3(t, 0, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const tube = new THREE.TubeGeometry(curve, mainN, LEAD_RADIUS_M, radial, false);
    const hit = new THREE.TubeGeometry(curve, hitN, HIT_RADIUS_M, 5, false);
    const plug = makePlugGeometries(quality);
    // The speckled rubber skin is one texture per colour, shared by every lead of that colour.
    // The material's colour only tints it a hair, per lead, so no two leads are quite alike.
    const skin = acquireTexture(`lead-skin:${colour}:${quality}`, () =>
      leadTexture(colour, quality),
    );
    const cableMat = new THREE.MeshStandardMaterial({
      map: skin,
      color: jitterColour("#f6f6f6", rng, 0.05),
      roughness: 0.9,
    });
    const plugMat = new THREE.MeshStandardMaterial({
      map: skin,
      color: jitterColour("#f6f6f6", rng, 0.05),
      roughness: 0.86,
    });
    // The pin's brass: the kit's own, warm and a little rough.
    const pinMat = brassSurface(hashString(`pin-${from}-${to}-${colour}`));
    const hitMat = new THREE.MeshBasicMaterial();
    // A stable, hash-chosen sideways bulge, so two leads between the same neighbours part.
    const bulge = (rng() - 0.5) * 2;
    return {
      curve,
      pts,
      tube,
      hit,
      mainN,
      hitN,
      radial,
      plug,
      skin,
      cableMat,
      plugMat,
      pinMat,
      hitMat,
      bulge,
      main: new Float32Array((mainN + 1) * 3),
      mid: new Float32Array((hitN + 1) * 3),
      last: new Float32Array(9).fill(Number.NaN),
      ink: -1,
      s: new THREE.Vector3(),
      e: new THREE.Vector3(),
    };
  }, [from, to, colour, quality]);
  const curve = useMemo<LeadCurve>(
    () => ({ points: res.main, count: res.mainN + 1, version: 0 }),
    [res],
  );
  const claim = useMemo<{ id: string | null }>(() => ({ id: null }), []);
  useEffect(() => () => releaseLead(bookOf(state), claim), [state, claim]);
  useEffect(
    () => () => {
      res.tube.dispose();
      res.hit.dispose();
      res.plug.body.dispose();
      res.plug.pin.dispose();
      res.cableMat.dispose();
      res.plugMat.dispose();
      res.pinMat.dispose();
      res.hitMat.dispose();
      releaseTexture(res.skin);
    },
    [res],
  );

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const hit = hitMesh.current;
    const dRaw = typeof drawn === "number" ? drawn : drawn.current;
    const d01 = Number.isFinite(dRaw) ? Math.max(0, Math.min(dRaw, 1)) : 1;
    const okA = registry.worldPosition(from, _a);
    let okB = true;
    if (to === "pointer") {
      _b.copy(state.current.pointer);
      _b.y += CARRY_LIFT_M;
    } else okB = registry.worldPosition(to, _b);
    const ok = okA && okB;
    g.visible = ok;
    if (to !== "pointer") {
      const book = bookOf(state);
      claimLead(book, state.current.leads, claim, from, to, colour);
      if (claim.id !== null) {
        if (ok && book.curve.get(claim.id) !== curve) book.curve.set(claim.id, curve);
        else if (!ok && book.curve.get(claim.id) === curve) book.curve.delete(claim.id);
      }
    }
    // A missing end must not leave a stale tap tube behind.
    if (hit) {
      const k = ok && d01 >= 0.999 ? 1 : 0;
      if (hit.scale.x !== k) hit.scale.setScalar(k);
    }
    if (!ok) return;

    // This lead's place among the bench's leads: its ink id, and how many earlier leads share
    // each terminal (their plugs are already in the nut, so this one stacks on top).
    const leads = state.current.leads;
    let mine = -1;
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      if (l && ((l.a === from && l.b === to) || (l.a === to && l.b === from))) {
        mine = i;
        break;
      }
    }
    const upto = mine >= 0 ? mine : leads.length;
    let ka = 0;
    let kb = 0;
    for (let i = 0; i < upto; i++) {
      const l = leads[i];
      if (!l) continue;
      if (l.a === from || l.b === from) ka++;
      if (to !== "pointer" && (l.a === to || l.b === to)) kb++;
    }
    const ink = INK_IDS.leadBase + (upto % 20);
    if (ink !== res.ink) {
      res.ink = ink;
      // The brass pins get another id from the lead block, ten along (leads number seven), so a
      // line is drawn where brass meets sleeve; the cable shares the sleeve's id, no line between.
      const pinInk = INK_IDS.leadBase + ((upto + 10) % 20);
      if (pinsA.current) inkTag(pinsA.current, { id: pinInk, thin: true });
      if (pinsB.current) inkTag(pinsB.current, { id: pinInk, thin: true });
      if (plugs.current) inkTag(plugs.current, { id: ink, thin: true });
      if (tagged.current) inkTag(tagged.current, { id: ink, thin: false });
    }

    const liftA = ka * PLUG_HEIGHT_M * 0.85;
    const liftB = kb * PLUG_HEIGHT_M * 0.85;
    const l = res.last;
    if (
      l[0] === _a.x &&
      l[1] === _a.y &&
      l[2] === _a.z &&
      l[3] === _b.x &&
      l[4] === _b.y &&
      l[5] === _b.z &&
      l[6] === liftA &&
      l[7] === liftB &&
      l[8] === d01
    ) {
      return;
    }
    l[0] = _a.x;
    l[1] = _a.y;
    l[2] = _a.z;
    l[3] = _b.x;
    l[4] = _b.y;
    l[5] = _b.z;
    l[6] = liftA;
    l[7] = liftB;
    l[8] = d01;

    // Everything is worked out in world space (the footprints are world boxes), then moved
    // into the parent's space, so a transformed parent cannot break the lead.
    const par = g.parent;
    if (par) _inv.copy(par.matrixWorld).invert();
    else _inv.identity();
    _la.set(_a.x, _a.y + liftA, _a.z).applyMatrix4(_inv);
    _lb.set(_b.x, _b.y + liftB, _b.z).applyMatrix4(_inv);
    plugA.current?.position.copy(_la);
    plugB.current?.position.copy(_lb);
    // The far plug pops in over the last tenth of the draw; the cable hides until it has length.
    plugB.current?.scale.setScalar(Math.max(0.001, Math.min(1, (d01 - 0.9) * 10)));
    const cable = tagged.current?.children[0];
    if (cable) cable.visible = d01 > 0.002;

    res.s.set(_a.x, _a.y + liftA + CABLE_SEAT_M, _a.z);
    res.e.set(_b.x, _b.y + liftB + CABLE_SEAT_M, _b.z);
    shapeCable(res.pts, res.s, res.e, res.bulge);
    for (let i = 0; i <= res.mainN; i++) {
      res.curve.getPoint((i / res.mainN) * d01, _pt);
      restOnBench(_pt);
      _pt.applyMatrix4(_inv);
      res.main[i * 3] = _pt.x;
      res.main[i * 3 + 1] = _pt.y;
      res.main[i * 3 + 2] = _pt.z;
    }
    writeTube(res.tube, res.main, res.mainN, res.radial, LEAD_RADIUS_M);
    curve.version++;
    if (to !== "pointer") {
      // The tap target covers the middle only, so the ends stay free for tapping the nuts.
      const span = Math.hypot(_b.x - _a.x, _b.z - _a.z);
      const t0 = Math.min(0.4, Math.max(0.14, 0.05 / Math.max(span, 0.05)));
      for (let i = 0; i <= res.hitN; i++) {
        res.curve.getPoint(t0 + ((1 - 2 * t0) * i) / res.hitN, _pt);
        restOnBench(_pt);
        _pt.applyMatrix4(_inv);
        res.mid[i * 3] = _pt.x;
        res.mid[i * 3 + 1] = _pt.y;
        res.mid[i * 3 + 2] = _pt.z;
      }
      writeTube(res.hit, res.mid, res.hitN, 5, HIT_RADIUS_M);
    }
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onTap?.();
  };
  return (
    <group ref={root} visible={false}>
      <group ref={tagged}>
        <mesh geometry={res.tube} material={res.cableMat} frustumCulled={false} castShadow />
        <group ref={plugs}>
          <group ref={plugA}>
            <mesh geometry={res.plug.body} material={res.plugMat} castShadow />
            <group ref={pinsA}>
              <mesh geometry={res.plug.pin} material={res.pinMat} castShadow />
            </group>
          </group>
          <group ref={plugB}>
            <mesh geometry={res.plug.body} material={res.plugMat} castShadow />
            <group ref={pinsB}>
              <mesh geometry={res.plug.pin} material={res.pinMat} castShadow />
            </group>
          </group>
        </group>
      </group>
      {to !== "pointer" ? (
        <mesh
          ref={hitMesh}
          geometry={res.hit}
          material={res.hitMat}
          frustumCulled={false}
          onPointerDown={onDown}
          visible={false}
        />
      ) : null}
    </group>
  );
}
