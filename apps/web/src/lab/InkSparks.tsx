import { useFrame } from "@react-three/fiber";
import type { Box, ComponentKind } from "@snaplab/contracts";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { NO_INK } from "../scene/ink/inkPass";
import { INK_HEX } from "../scene/ink/palette";
import { KIT_ANCHORS, type pageLayout, pageToWorld } from "./layout";
import { ease, type RevealPhases } from "./reveal";

/** A pen stroke in flight: its longest length and its width, in metres. */
const STROKE_LENGTH_M = 0.016;
const STROKE_WIDTH_M = 0.0011;
const ARC_HEIGHT_M = 0.22;
/** A few strokes per part read as pen work; many read as spatter. */
const MAX_PER_PART = 9;

/** A fixed pseudo-random sequence: the same page always gets the same strokes. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface DrawnPart {
  kind: ComponentKind;
  box: Box;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Short pen strokes lift off each part she drew and arc to where that part stands on the
 * bench, where its outline is drawing on: each one lies along its path, stretches out in
 * flight and shrinks into the part. Flat ink, opaque and unlit, kept out of the ink pass.
 * Every path is laid out once; the render loop only writes instance matrices.
 */
export function InkSparks({
  parts,
  page,
  maxSparks,
  phases,
}: {
  parts: DrawnPart[];
  page: ReturnType<typeof pageLayout>;
  maxSparks: number;
  phases: { current: RevealPhases };
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const paths = useMemo(() => {
    const flying = parts.filter((p) => KIT_ANCHORS[p.kind]);
    const per = flying.length
      ? Math.min(MAX_PER_PART, Math.max(3, Math.floor(maxSparks / flying.length)))
      : 0;
    const count = per * flying.length;
    // Per stroke: start xyz, control xyz, end xyz, delay.
    const data = new Float32Array(count * 10);
    const rand = seeded(7);
    let k = 0;
    for (const part of flying) {
      const anchor = KIT_ANCHORS[part.kind] ?? [0, 0, 0];
      for (let i = 0; i < per; i++, k++) {
        const u = part.box.x0 + rand() * (part.box.x1 - part.box.x0);
        const v = part.box.y0 + rand() * (part.box.y1 - part.box.y0);
        const [sx, sy, sz] = pageToWorld(u, v, page);
        const ex = anchor[0] + (rand() - 0.5) * 0.06;
        const ey = anchor[1] + (rand() - 0.5) * 0.03;
        const ez = anchor[2] + (rand() - 0.5) * 0.04;
        const o = k * 10;
        data[o] = sx;
        data[o + 1] = sy;
        data[o + 2] = sz;
        data[o + 3] = (sx + ex) / 2 + (rand() - 0.5) * 0.08;
        data[o + 4] = Math.max(sy, ey) + ARC_HEIGHT_M * (0.6 + rand() * 0.6);
        data[o + 5] = (sz + ez) / 2;
        data[o + 6] = ex;
        data[o + 7] = ey;
        data[o + 8] = ez;
        data[o + 9] = rand() * 0.4;
      }
    }
    return { data, count };
  }, [parts, page, maxSparks]);

  const { geometry, material } = useMemo(
    () => ({
      geometry: new THREE.BoxGeometry(1, 1, 1),
      // Flat pen ink, opaque: a stroke of ink, not a light.
      material: new THREE.MeshBasicMaterial({ color: new THREE.Color(INK_HEX) }),
    }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      pos: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      q: new THREE.Quaternion(),
    }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    tmp.m.makeScale(0, 0, 0);
    for (let i = 0; i < paths.count; i++) mesh.setMatrixAt(i, tmp.m);
    mesh.instanceMatrix.needsUpdate = true;
  }, [paths, tmp]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const s = phases.current.sparks;
    mesh.visible = s > 0 && s < 1;
    if (!mesh.visible) return;
    const d = paths.data;
    for (let i = 0; i < paths.count; i++) {
      const o = i * 10;
      const local = Math.min(1, Math.max(0, (s - (d[o + 9] ?? 0)) / 0.6));
      const t = ease(local);
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      const x0 = d[o] ?? 0;
      const y0 = d[o + 1] ?? 0;
      const z0 = d[o + 2] ?? 0;
      const x1 = d[o + 3] ?? 0;
      const y1 = d[o + 4] ?? 0;
      const z1 = d[o + 5] ?? 0;
      const x2 = d[o + 6] ?? 0;
      const y2 = d[o + 7] ?? 0;
      const z2 = d[o + 8] ?? 0;
      tmp.pos.set(a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2, a * z0 + b * z1 + c * z2);
      // The path's tangent: the stroke lies along its flight.
      tmp.dir.set(
        (1 - t) * (x1 - x0) + t * (x2 - x1),
        (1 - t) * (y1 - y0) + t * (y2 - y1),
        (1 - t) * (z1 - z0) + t * (z2 - z1),
      );
      if (tmp.dir.lengthSq() < 1e-12) tmp.dir.copy(UP);
      else tmp.dir.normalize();
      tmp.q.setFromUnitVectors(UP, tmp.dir);
      const env = Math.sin(Math.PI * local);
      const w = STROKE_WIDTH_M * Math.min(1, env * 3);
      tmp.scale.set(w, STROKE_LENGTH_M * env, w);
      tmp.m.compose(tmp.pos, tmp.q, tmp.scale);
      mesh.setMatrixAt(i, tmp.m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (paths.count === 0) return null;
  return (
    <instancedMesh
      key={paths.count}
      ref={meshRef}
      args={[geometry, material, paths.count]}
      frustumCulled={false}
      userData={{ [NO_INK]: true }}
    />
  );
}
