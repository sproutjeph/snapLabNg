import { useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BENCH_TOP_Y } from "./layout";
import type { RevealPhases } from "./reveal";

/** The kit rises from the bench top to above its tallest part (the Leclanché cell). */
const RISE_TO_Y = 0.24;

type Clippable = THREE.Material & { clippingPlanes: THREE.Plane[] | null };

/**
 * Reveals its children from the bench top upwards behind a glowing line: a clipping plane on
 * their materials only (the page and the bench are not clipped). Works the same on every
 * quality tier. The planes come off when the reveal ends, so the live bench pays nothing.
 */
export function RevealClip({
  phases,
  children,
}: {
  phases: { current: RevealPhases };
  children: ReactNode;
}) {
  const gl = useThree((s) => s.gl);
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.LineLoop>(null);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), BENCH_TOP_Y), []);
  const planes = useMemo(() => [plane], [plane]);
  const state = useRef({ clipped: false });

  const { lineGeometry, lineMaterial } = useMemo(() => {
    // A rectangle around the kit's footprint: reads as a laser line sweeping upwards.
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.64, 0, -0.34),
      new THREE.Vector3(0.64, 0, -0.34),
      new THREE.Vector3(0.64, 0, 0.1),
      new THREE.Vector3(-0.64, 0, 0.1),
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.4, 1.6, 2.4),
      toneMapped: false,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { lineGeometry, lineMaterial };
  }, []);
  useEffect(
    () => () => {
      lineGeometry.dispose();
      lineMaterial.dispose();
    },
    [lineGeometry, lineMaterial],
  );

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  // One visitor, made once, so the render loop allocates nothing.
  const setPlanes = useMemo(() => {
    let target: THREE.Plane[] | null = null;
    const visit = (o: THREE.Object3D) => {
      const m = (o as THREE.Mesh).material as Clippable | Clippable[] | undefined;
      if (!m) return;
      if (Array.isArray(m)) {
        for (const x of m) {
          if (x.clippingPlanes !== target) {
            x.clippingPlanes = target;
            // Without this the shadow pass ignores the planes and the hidden kit casts shadows.
            x.clipShadows = target !== null;
            x.needsUpdate = true;
          }
        }
      } else if (m.clippingPlanes !== target) {
        m.clippingPlanes = target;
        m.clipShadows = target !== null;
        m.needsUpdate = true;
      }
    };
    return (root: THREE.Object3D, to: THREE.Plane[] | null) => {
      target = to;
      root.traverse(visit);
    };
  }, []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const rise = phases.current.rise;
    const line = lineRef.current;
    if (rise < 1) {
      plane.constant = BENCH_TOP_Y + rise * (RISE_TO_Y - BENCH_TOP_Y);
      // Materials can be rebuilt (a quality change), so keep every one clipped while rising.
      setPlanes(group, planes);
      state.current.clipped = true;
      if (line) {
        line.visible = rise > 0;
        line.position.y = plane.constant;
      }
    } else {
      if (state.current.clipped) {
        setPlanes(group, null);
        state.current.clipped = false;
      }
      if (line) line.visible = false;
    }
  });

  return (
    <>
      <group ref={groupRef}>{children}</group>
      <lineLoop ref={lineRef} geometry={lineGeometry} material={lineMaterial} />
    </>
  );
}
