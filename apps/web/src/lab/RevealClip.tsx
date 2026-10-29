import { useFrame } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { setInkSweep } from "../scene/ink/inkSweep";
import { PAPER_HEX } from "../scene/ink/palette";
import { inkFillsOf, inkLinesOf, type RevealPhases } from "./reveal";

/** How much later the farthest part's fill starts than the nearest one's (share of the fade). */
const FILL_SPREAD = 0.5;

/** The paper colour (linear), shared by every patched material. */
const PAPER = new THREE.Uniform(new THREE.Color(PAPER_HEX));

/** Where a patched material keeps its own fill uniform (1 = itself, 0 = flat paper). */
const FILL_KEY = "revealFill";

const FILL_CHUNK = `#include <opaque_fragment>
gl_FragColor.rgb = mix(revealPaper, gl_FragColor.rgb, revealFill);`;

/**
 * Patches a built-in material once so its final colour (before tone mapping and colour-space
 * output) blends from the paper to itself. Exact on every material type (specular, clearcoat
 * and the environment included), and the same program for every material, so it is compiled
 * with the kit and never again: the patch stays, at 1, after the reveal.
 */
function fillUniform(material: THREE.Material): THREE.Uniform<number> | null {
  const held = material.userData[FILL_KEY] as THREE.Uniform<number> | undefined;
  if (held) return held;
  if ((material as THREE.ShaderMaterial).isShaderMaterial) return null;
  const fill = new THREE.Uniform(1);
  material.userData[FILL_KEY] = fill;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.uniforms.revealFill = fill;
    shader.uniforms.revealPaper = PAPER;
    shader.fragmentShader = `uniform float revealFill;\nuniform vec3 revealPaper;\n${shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      FILL_CHUNK,
    )}`;
  };
  material.needsUpdate = true;
  return fill;
}

/** A material while the reveal fades it in. */
interface FillState {
  /** 0 at her page, 1 at the farthest part: when this material's fill starts. */
  delay: number;
  /** See-through parts (glass, labels; hit boxes stay at 0) fade through their opacity. */
  transparent: boolean;
  opacity: number;
  fill: THREE.Uniform<number> | null;
}

interface MeshState {
  castShadow: boolean;
  /** Its centre's distance from her page, over the sweep's reach (0–1). */
  delay: number;
}

/**
 * The kit's reveal on every quality tier (docs/plans/ink-look.md, Wave 3 slot 3). Its pen
 * outlines draw on from her page outward: this writes `lines` (InkComposer's `reveal`) and points
 * the sweep at her page. A little behind, each part's fill fades in from the paper colour, the
 * nearest first; a part casts its shadow once it is half filled. At the end every value is put
 * back, so the live bench pays nothing. Allocates only the first time it sees a material or a
 * mesh.
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
    const origin = new THREE.Vector3();
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    const fills = new Map<THREE.Material, FillState>();
    const meshes = new Map<THREE.Mesh, MeshState>();
    const s = { active: false, reach: 1, fill: 0 };

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

    const fillState = (material: THREE.Material, delay: number): FillState => {
      let f = fills.get(material);
      if (!f) {
        f = {
          delay,
          transparent: material.transparent,
          opacity: material.opacity,
          fill: material.transparent ? null : fillUniform(material),
        };
        fills.set(material, f);
      } else if (delay < f.delay) {
        // Shared by several parts: it fades in with the nearest.
        f.delay = delay;
      }
      return f;
    };

    const fade = (material: THREE.Material, delay: number): number => {
      const f = fillState(material, delay);
      const k = Math.min(1, Math.max(0, s.fill * (1 + FILL_SPREAD) - f.delay * FILL_SPREAD));
      if (f.transparent) material.opacity = f.opacity * k;
      else if (f.fill) f.fill.value = k;
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
        for (const x of mesh.material) k = Math.min(k, fade(x, m.delay));
      } else {
        k = fade(mesh.material, m.delay);
      }
      mesh.castShadow = m.castShadow && k > 0.5;
    };

    const restoreFill = (f: FillState, material: THREE.Material) => {
      if (f.transparent) material.opacity = f.opacity;
      else if (f.fill) f.fill.value = 1;
    };
    const restoreMesh = (m: MeshState, mesh: THREE.Mesh) => {
      mesh.castShadow = m.castShadow;
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

  // Unmounted mid-reveal (the lite view, a new bench): leave the kit's values as they were.
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
