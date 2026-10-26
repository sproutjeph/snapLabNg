import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ReadySignal } from "../../scene/ReadySignal";
import { BRIDGE_BASE } from "./dimensions";
import MeterBridgeKit from "./MeterBridgeKit";
import type { MeterBridgeVisualState } from "./types";

const DEMO_PLUG_LABELS = ["1", "2", "2", "5", "10"];

const BASE_CAM_Y = 0.62;
const BASE_CAM_Z = 0.68;
const BASE_DIST = Math.hypot(BASE_CAM_Y, BASE_CAM_Z);
const DIR_Y = BASE_CAM_Y / BASE_DIST;
const DIR_Z = BASE_CAM_Z / BASE_DIST;
const TARGET_Z = -0.08;

function PreviewCameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const scale = aspect < 1 ? 1 / Math.max(aspect * 1.05, 0.35) : 1;
    const dist = BASE_DIST * scale;
    camera.position.set(0, DIR_Y * dist, TARGET_Z + DIR_Z * dist);
    camera.lookAt(0, 0, TARGET_Z);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}

function PreviewBench() {
  const benchRes = useMemo(() => {
    const geo = new THREE.BoxGeometry(1.6, 0.04, 0.85);
    const mat = new THREE.MeshStandardMaterial({
      color: "#2b2118",
      roughness: 0.78,
      metalness: 0.04,
    });
    return { geo, mat };
  }, []);

  useEffect(() => {
    return () => {
      benchRes.geo.dispose();
      benchRes.mat.dispose();
    };
  }, [benchRes]);

  return (
    <mesh
      geometry={benchRes.geo}
      material={benchRes.mat}
      position={[0, -BRIDGE_BASE.height - 0.02, -0.1]}
      receiveShadow
    />
  );
}

function DemoScene() {
  const stateRef = useRef<MeterBridgeVisualState>({
    jockeyCm: 42,
    jockeyDown: false,
    needleDeg: 0,
    plugsIn: [false, true, true, true, true],
    keyClosed: true,
    scrapesCm: [],
  });

  useFrame((clockState) => {
    // Slow sine sweep over time; ignores jockey position so no fake physics is implied
    stateRef.current.needleDeg = Math.sin(clockState.clock.elapsedTime * 1.2) * 28;
  });

  const handleWireTap = (cm: number) => {
    stateRef.current.jockeyCm = cm;
    stateRef.current.jockeyDown = true;
  };

  const handleWireDrag = (fromCm: number, toCm: number) => {
    stateRef.current.jockeyCm = toCm;
    stateRef.current.jockeyDown = true;
    stateRef.current.scrapesCm.push([fromCm, toCm]);
  };

  const handlePlugToggle = (index: number) => {
    const plugs = stateRef.current.plugsIn;
    if (index >= 0 && index < plugs.length) {
      plugs[index] = !plugs[index];
    }
  };

  const handleKeyToggle = () => {
    stateRef.current.keyClosed = !stateRef.current.keyClosed;
  };

  return (
    <>
      <color attach="background" args={["#11151c"]} />
      <hemisphereLight args={["#fffbeb", "#3f2e21", 0.85]} />
      <directionalLight
        position={[1.2, 2.2, 1.4]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-1}
        shadow-camera-right={1}
        shadow-camera-top={1}
        shadow-camera-bottom={-1}
      />
      <directionalLight position={[-1.0, 1.4, -0.8]} intensity={0.75} />
      <PreviewCameraRig />
      <OrbitControls target={[0, 0, TARGET_Z]} makeDefault />
      <PreviewBench />
      <MeterBridgeKit
        state={stateRef}
        plugLabels={DEMO_PLUG_LABELS}
        unknownLabel="X"
        quality="high"
        onWireTap={handleWireTap}
        onWireDrag={handleWireDrag}
        onPlugToggle={handlePlugToggle}
        onKeyToggle={handleKeyToggle}
      />
      <ReadySignal />
    </>
  );
}

export default function KitPreview() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 40, position: [0, BASE_CAM_Y, TARGET_Z + BASE_CAM_Z], near: 0.02, far: 20 }}
    >
      <DemoScene />
    </Canvas>
  );
}
