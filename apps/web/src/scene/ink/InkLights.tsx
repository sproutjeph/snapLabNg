import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { PAPER_HEX } from "./palette";

export interface InkLightsProps {
  quality: QualityTier;
}

/** A soft room reflection, kept low so matte parts stay matte. */
const ENV_INTENSITY = 0.55;

/**
 * Builds the RoomEnvironment PMREM (blur 0.04) once per renderer and sets it as the scene
 * environment; disposed on unmount. Skipped on the low tier, where the fill light does its job.
 */
function RoomEnv() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    const prevEnv = scene.environment;
    const prevIntensity = scene.environmentIntensity;
    scene.environment = target.texture;
    scene.environmentIntensity = ENV_INTENSITY;
    return () => {
      scene.environment = prevEnv;
      scene.environmentIntensity = prevIntensity;
      target.dispose();
    };
  }, [gl, scene]);
  return null;
}

/**
 * The shared lighting and background for the ink look (docs/plans/ink-look.md): paper
 * background, a soft-shadow sun, the RoomEnvironment PMREM at 0.04 and a hemisphere fill toned
 * to the paper. The shadow box covers the largest bench (2.4 × 1.6 m). Props frozen.
 */
export function InkLights({ quality }: InkLightsProps) {
  const shadows = quality !== "low";
  const mapSize = quality === "high" ? 2048 : 1024;
  return (
    <>
      <color attach="background" args={[PAPER_HEX]} />
      {quality !== "low" && <RoomEnv />}
      <hemisphereLight args={["#fffaf0", "#cbbd9f", quality === "low" ? 1.5 : 1.0]} />
      <directionalLight
        position={[1.1, 2.4, 1.5]}
        color="#fff6e6"
        intensity={quality === "low" ? 1.7 : 1.5}
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-radius={6}
        shadow-intensity={1}
        shadow-bias={-0.0004}
        shadow-normalBias={0.004}
        shadow-camera-near={0.5}
        shadow-camera-far={6}
        shadow-camera-left={-1.4}
        shadow-camera-right={1.4}
        shadow-camera-top={1.4}
        shadow-camera-bottom={-1.4}
      />
      {/* A weak back light so the far faces of the parts are not black. */}
      <directionalLight position={[-1.2, 1.2, -1.0]} color="#f3eee6" intensity={0.35} />
    </>
  );
}
