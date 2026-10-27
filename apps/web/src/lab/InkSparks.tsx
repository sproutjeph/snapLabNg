import { useFrame } from "@react-three/fiber";
import type { Box, ComponentKind } from "@snaplab/contracts";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { KIT_ANCHORS, type pageLayout, pageToWorld } from "./layout";
import { ease, type RevealPhases } from "./reveal";

const SPARK_SIZE_M = 0.0028;
const ARC_HEIGHT_M = 0.22;

/** A fixed pseudo-random sequence: the same page always gets the same sparks. */
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

/**
 * Sparks of ink lift off each part she drew and fly to where that part stands on the bench.
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
    const per = flying.length ? Math.max(4, Math.floor(maxSparks / flying.length)) : 0;
    const count = per * flying.length;
    // Per spark: start xyz, control xyz, end xyz, delay.
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
      geometry: new THREE.IcosahedronGeometry(1, 0),
      material: new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.4, 1.6, 2.4),
        toneMapped: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
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

  const tmp = useMemo(() => ({ m: new THREE.Matrix4() }), []);

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
      const size = SPARK_SIZE_M * Math.sin(Math.PI * local);
      tmp.m.makeScale(size, size, size);
      tmp.m.setPosition(
        a * (d[o] ?? 0) + b * (d[o + 3] ?? 0) + c * (d[o + 6] ?? 0),
        a * (d[o + 1] ?? 0) + b * (d[o + 4] ?? 0) + c * (d[o + 7] ?? 0),
        a * (d[o + 2] ?? 0) + b * (d[o + 5] ?? 0) + c * (d[o + 8] ?? 0),
      );
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
    />
  );
}
