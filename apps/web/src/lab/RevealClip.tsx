import { useFrame } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { setInkSweep } from "../scene/ink/inkSweep";
import { PAPER_HEX } from "../scene/ink/palette";
import { inkFillsOf, inkLinesOf, type RevealPhases } from "./reveal";

/** How much later the farthest part's fill starts than the nearest one's (share of the fade). */
const FILL_SPREAD = 0.5;

/** A material's own values, kept while the reveal fades it in, and put back at the end. */
interface FillState {
  /** 0 at her page, 1 at the farthest part: when this material's fill starts. */
  delay: number;
  /** Not faded: no colour to fade (shader materials). */
  skip: boolean;
  /** Faded through its opacity (glass, labels, hidden hit boxes stay at 0). */
  transparent: boolean;
  opacity: number;
  color: THREE.Color | null;
  /** Lit materials fade through their emissive (paper) and colour (theirs); null for basic. */
  emissive: THREE.Color | null;
  emissiveIntensity: number;
  envMapIntensity: number | null;
}

type Fadeable = THREE.Material & {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  envMapIntensity?: number;
};

interface MeshState {
  castShadow: boolean;
  /** Its centre's distance from her page, over the sweep's reach (0–1). */
  delay: number;
}

/**
 * The kit's reveal on every quality tier (docs/plans/ink-look.md, Wave 3 slot 3). Its pen
 * outlines draw on from her page outward: this writes `lines` (InkComposer's `reveal`) and points
 * the sweep at her page. A little behind, each part's fill fades in from the paper colour, the
 * nearest first. A part casts its shadow once it is half filled. At the end every material is
 * put back exactly, so the live bench pays nothing. Allocates only the first time it sees a
 * material or a mesh.
 */
export function RevealClip({
  phases,
  lines,
  from,
  children,
}: {
  phases: { current: RevealPhases };
  /** Written every frame: 0 → 1 as the outlines draw on. */
  lines: { current: number };
  /** Where the sweep starts: the centre of her page. */
  from: readonly [number, number, number];
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const st = useMemo(() => {
    const paper = new THREE.Color(PAPER_HEX);
    const origin = new THREE.Vector3();
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    const tmp = new THREE.Color();
    const fills = new Map<THREE.Material, FillState>();
    const meshes = new Map<THREE.Mesh, MeshState>();
    const s = { active: false, reach: 1, fill: 0, paper, origin, box, v, tmp, fills, meshes };

    const meshState = (mesh: THREE.Mesh): MeshState => {
      let m = meshes.get(mesh);
      if (!m) {
        const geometry = mesh.geometry;
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
        const centre = geometry.boundingSphere?.center;
        if (centre) v.copy(centre);
        else v.set(0, 0, 0);
        v.applyMatrix4(mesh.matrixWorld);
        const delay = Math.min(1, v.distanceTo(origin) / Math.max(s.reach, 1e-3));
        m = { castShadow: mesh.castShadow, delay };
        meshes.set(mesh, m);
      }
      return m;
    };

    const fillState = (material: Fadeable, delay: number): FillState => {
      let f = fills.get(material);
      if (!f) {
        const lit = material.emissive instanceof THREE.Color;
        f = {
          delay,
          skip: !(material.color instanceof THREE.Color),
          transparent: material.transparent,
          opacity: material.opacity,
          color: material.color instanceof THREE.Color ? material.color.clone() : null,
          emissive: lit ? (material.emissive as THREE.Color).clone() : null,
          emissiveIntensity: material.emissiveIntensity ?? 1,
          envMapIntensity:
            typeof material.envMapIntensity === "number" ? material.envMapIntensity : null,
        };
        fills.set(material, f);
      } else if (delay < f.delay) {
        // Shared by several parts: it fades in with the nearest.
        f.delay = delay;
      }
      return f;
    };

    const applyFill = (material: Fadeable, f: FillState, k: number) => {
      if (f.skip) return;
      if (f.transparent) {
        material.opacity = f.opacity * k;
        return;
      }
      if (f.emissive && f.color && material.color && material.emissive) {
        // Lit: its own colour scaled in, the paper as emissive scaled out, so the part goes
        // from flat paper to itself (a straight blend, with no program change).
        material.color.copy(f.color).multiplyScalar(k);
        material.emissive.copy(paper).multiplyScalar(1 - k);
        tmp.copy(f.emissive).multiplyScalar(f.emissiveIntensity * k);
        material.emissive.add(tmp);
        material.emissiveIntensity = 1;
        if (f.envMapIntensity !== null) material.envMapIntensity = f.envMapIntensity * k;
      } else if (f.color && material.color) {
        material.color.copy(f.color).lerp(paper, 1 - k);
      }
    };

    const restoreFill = (f: FillState, material: THREE.Material) => {
      const m = material as Fadeable;
      if (f.skip) return;
      m.opacity = f.opacity;
      if (f.color && m.color) m.color.copy(f.color);
      if (f.emissive && m.emissive) m.emissive.copy(f.emissive);
      if (f.emissive) m.emissiveIntensity = f.emissiveIntensity;
      if (f.envMapIntensity !== null) m.envMapIntensity = f.envMapIntensity;
    };
    const restoreMesh = (m: MeshState, mesh: THREE.Mesh) => {
      mesh.castShadow = m.castShadow;
    };

    const fade = (material: Fadeable, delay: number): number => {
      const f = fillState(material, delay);
      const k = Math.min(1, Math.max(0, s.fill * (1 + FILL_SPREAD) - f.delay * FILL_SPREAD));
      applyFill(material, f, k);
      return k;
    };

    // One visitor, made once, so the render loop allocates nothing after the first frame.
    const visit = (o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const m = meshState(mesh);
      let k: number;
      if (Array.isArray(mesh.material)) {
        k = 1;
        for (const x of mesh.material) k = Math.min(k, fade(x as Fadeable, m.delay));
      } else {
        k = fade(mesh.material as Fadeable, m.delay);
      }
      mesh.castShadow = m.castShadow && k > 0.5;
    };

    const corner = (x: number, y: number, z: number) => v.set(x, y, z).distanceTo(origin);

    return {
      start(root: THREE.Object3D, at: readonly [number, number, number]) {
        origin.set(at[0], at[1], at[2]);
        box.setFromObject(root);
        let reach = 0.5;
        if (!box.isEmpty()) {
          const { min: a, max: b } = box;
          reach = Math.max(
            corner(a.x, a.y, a.z),
            corner(b.x, a.y, a.z),
            corner(a.x, b.y, a.z),
            corner(b.x, b.y, a.z),
            corner(a.x, a.y, b.z),
            corner(b.x, a.y, b.z),
            corner(a.x, b.y, b.z),
            corner(b.x, b.y, b.z),
          );
        }
        s.reach = reach;
        setInkSweep(origin.x, origin.y, origin.z, reach);
        s.active = true;
      },
      step(root: THREE.Object3D, fill: number) {
        s.fill = fill;
        root.traverse(visit);
      },
      restore() {
        fills.forEach(restoreFill);
        meshes.forEach(restoreMesh);
        fills.clear();
        meshes.clear();
        s.active = false;
      },
      get active() {
        return s.active;
      },
    };
  }, []);

  // Unmounted mid-reveal (the lite view, a new bench): leave the kit's materials as they were.
  useEffect(() => () => st.restore(), [st]);

  useFrame(() => {
    const group = groupRef.current;
    const p = phases.current;
    lines.current = inkLinesOf(p);
    if (!group) return;
    const fill = inkFillsOf(p);
    if (fill >= 1) {
      if (st.active) st.restore();
      return;
    }
    if (!st.active) st.start(group, from);
    st.step(group, fill);
  });

  return <group ref={groupRef}>{children}</group>;
}
