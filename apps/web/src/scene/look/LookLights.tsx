import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { lookFor } from "../../quality/tier";
import { PAPER_HEX } from "../ink/palette";
import { useLookTier } from "./lookTier";
import type { LookLightsProps } from "./types";

// The look's light rig (docs/plans/exam-redesign.md, "The look": light; numbers from
// Backcountry 101, research report 2). Hemisphere #fff6e8 / #5a4a3c ×1.45, a key #fff0dc ×3.9
// from the upper left-front with real soft shadows, and a fill #fff4e8 ×.45. No tone mapping
// (the ink composer turns it off). The shadow map is rendered only when `shadowsDirty` is set
// (autoUpdate off). The room reflection goes only on glossy materials (meter glass, brass), never
// on scene.environment, so matte wood and bakelite stay matte.

export const HEMI_SKY = "#fff6e8";
export const HEMI_GROUND = "#5a4a3c";
export const HEMI_INTENSITY = 1.45;
export const KEY_COLOUR = "#fff0dc";
export const KEY_INTENSITY = 3.9;
export const FILL_COLOUR = "#fff4e8";
export const FILL_INTENSITY = 0.45;
/** Light directions (from the bench toward the light), Backcountry 101's positions. */
const KEY_DIR = new THREE.Vector3(-5, 11, 4).normalize();
const FILL_DIR = new THREE.Vector3(6, 3, 1).normalize();
const LIGHT_DISTANCE_M = 3;
/** The shadow box covers the largest bench (the hero's 2.2 × 1.2 m desk). */
const SHADOW_HALF_M = 1.25;
const SHADOW_RADIUS = 4;
const SHADOW_BIAS = -6e-4;
/** BC101's 0.025 is in its own units (about 10 cm each); ours are metres. */
const SHADOW_NORMAL_BIAS = 0.0025;
/** Frames after mount that re-render shadows anyway, while parts are still mounting. */
const WARM_FRAMES = 30;
/** How often new glossy materials are looked for. */
const SCAN_S = 0.5;
const ENV_BLUR = 0.04;

type Glossy = THREE.MeshStandardMaterial & {
  transmission?: number;
  clearcoat?: number;
};

/** Metal (brass), polished, or glass: the parts that should show a reflection. */
export function isGlossy(m: THREE.Material): boolean {
  const s = m as Glossy;
  if (!(s as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial) return false;
  return (
    s.metalness >= 0.5 || s.roughness <= 0.35 || (s.transmission ?? 0) > 0 || (s.clearcoat ?? 0) > 0
  );
}

/** Puts the room reflection on glossy materials only, as they mount; takes it off on unmount. */
function GlossyEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const env = useRef<{
    target: THREE.WebGLRenderTarget;
    given: Set<THREE.MeshStandardMaterial>;
  } | null>(null);
  const timer = useRef(0);

  const visit = useMemo(
    () => (o: THREE.Object3D) => {
      const e = env.current;
      const slot = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!e || !slot || !(o as THREE.Mesh).isMesh) return;
      const list = Array.isArray(slot) ? slot : [slot];
      for (const m of list) {
        if (!isGlossy(m)) continue;
        const s = m as THREE.MeshStandardMaterial;
        if (s.envMap || e.given.has(s)) continue;
        s.envMap = e.target.texture;
        s.needsUpdate = true;
        e.given.add(s);
      }
    },
    [],
  );

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, ENV_BLUR);
    room.dispose();
    pmrem.dispose();
    const e = { target, given: new Set<THREE.MeshStandardMaterial>() };
    env.current = e;
    timer.current = 0;
    // The look never sets scene.environment; any earlier one is kept off while it is mounted.
    const prev = scene.environment;
    scene.environment = null;
    return () => {
      env.current = null;
      scene.environment = prev;
      for (const m of e.given) {
        if (m.envMap === target.texture) {
          m.envMap = null;
          m.needsUpdate = true;
        }
      }
      e.given.clear();
      target.dispose();
    };
  }, [gl, scene]);

  useFrame((_, delta) => {
    timer.current -= delta;
    if (timer.current > 0 || !env.current) return;
    timer.current = SCAN_S;
    scene.traverse(visit);
  });
  return null;
}

/** The look's lights. Props are the frozen LookLightsProps; the tier comes from LookTier. */
export function LookLights({ shadowsDirty }: LookLightsProps) {
  const tier = useLookTier();
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const { shadowMapSize } = lookFor(tier);
  const shadows = shadowMapSize > 0 && gl.shadowMap.enabled;

  const rig = useMemo(() => {
    const key = new THREE.DirectionalLight(KEY_COLOUR, KEY_INTENSITY);
    key.name = "LookKey";
    const fill = new THREE.DirectionalLight(FILL_COLOUR, FILL_INTENSITY);
    fill.name = "LookFill";
    const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY);
    hemi.name = "LookHemi";
    key.position.copy(KEY_DIR).multiplyScalar(LIGHT_DISTANCE_M);
    fill.position.copy(FILL_DIR).multiplyScalar(LIGHT_DISTANCE_M);
    const cam = key.shadow.camera;
    cam.left = -SHADOW_HALF_M;
    cam.right = SHADOW_HALF_M;
    cam.top = SHADOW_HALF_M;
    cam.bottom = -SHADOW_HALF_M;
    cam.near = 0.5;
    cam.far = LIGHT_DISTANCE_M * 2;
    cam.updateProjectionMatrix();
    key.shadow.radius = SHADOW_RADIUS;
    key.shadow.bias = SHADOW_BIAS;
    key.shadow.normalBias = SHADOW_NORMAL_BIAS;
    return { key, fill, hemi, warm: WARM_FRAMES };
  }, []);

  useEffect(() => {
    rig.key.castShadow = shadows;
    if (shadows) {
      rig.key.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      // A new size needs a new map.
      rig.key.shadow.map?.dispose();
      rig.key.shadow.map = null;
    }
    rig.warm = WARM_FRAMES;
  }, [rig, shadows, shadowMapSize]);

  useEffect(() => {
    const prevAuto = gl.shadowMap.autoUpdate;
    const prevBackground = scene.background;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    scene.background = new THREE.Color(PAPER_HEX);
    return () => {
      gl.shadowMap.autoUpdate = prevAuto;
      scene.background = prevBackground;
      rig.key.dispose();
      rig.fill.dispose();
      rig.hemi.dispose();
    };
  }, [gl, scene, rig]);

  useFrame(() => {
    if (rig.warm > 0) {
      rig.warm -= 1;
      gl.shadowMap.needsUpdate = true;
    }
    if (shadowsDirty.current) {
      shadowsDirty.current = false;
      gl.shadowMap.needsUpdate = true;
    }
  });

  return (
    <>
      <primitive object={rig.hemi} />
      <primitive object={rig.key} />
      <primitive object={rig.key.target} />
      <primitive object={rig.fill} />
      {tier !== "low" && <GlossyEnvironment />}
    </>
  );
}
