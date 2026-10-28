import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { parseOverride } from "../../quality/tier";
import { InkComposer } from "../../scene/ink/InkComposer";
import { InkLights } from "../../scene/ink/InkLights";
import { PaperDesk } from "../../scene/ink/PaperDesk";
import { ReadySignal } from "../../scene/ReadySignal";
import { BRIDGE_BASE } from "./dimensions";
import MeterBridgeKit from "./MeterBridgeKit";
import type { QualityTier } from "./types";
import { useMeterBridgeEngine } from "./useMeterBridgeEngine";

const DEMO_PLUG_LABELS = ["1", "2", "2", "5", "10"];

const BASE_CAM_Y = 0.68;
const BASE_CAM_Z = 0.78;
const BASE_DIST = Math.hypot(BASE_CAM_Y, BASE_CAM_Z);
const DIR_Y = BASE_CAM_Y / BASE_DIST;
const DIR_Z = BASE_CAM_Z / BASE_DIST;
const TARGET_Z = -0.08;

function PreviewCameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const scale = aspect < 1 ? 1.52 / Math.max(aspect, 0.25) : 1.08;
    const dist = BASE_DIST * scale;
    camera.position.set(0, DIR_Y * dist, TARGET_Z + DIR_Z * dist);
    camera.lookAt(0, 0, TARGET_Z);
    camera.updateProjectionMatrix();
    if (controls && "update" in controls && typeof controls.update === "function") {
      controls.update();
    }
  }, [camera, controls, size.width, size.height]);

  return null;
}

// The plug box of the golden question: coils 1, 2, 2, 5 and 10 Ω, starting with only the
// 1 Ω plug out (R = 1 Ω). X is the unknown and is never shown.
const BENCH = { boxValuesOhm: [1, 2, 2, 5, 10], plugsIn: [false, true, true, true, true], xOhm: 3 };

function DemoScene({ quality }: { quality: QualityTier }) {
  const { visual, handlers } = useMeterBridgeEngine(BENCH);

  return (
    <>
      <InkLights quality={quality} />
      <PreviewCameraRig />
      <OrbitControls target={[0, 0, TARGET_Z]} makeDefault />
      <PaperDesk quality={quality} size={[2.2, 1.2]} y={-BRIDGE_BASE.height} />
      <MeterBridgeKit
        state={visual}
        plugLabels={DEMO_PLUG_LABELS}
        unknownLabel="X"
        quality="high"
        onWireTap={handlers.onWireTap}
        onWireDrag={handlers.onWireDrag}
        onPlugToggle={handlers.onPlugToggle}
        onKeyToggle={handlers.onKeyToggle}
      />
      <InkComposer quality={quality} />
      <ReadySignal />
    </>
  );
}

export default function KitPreview() {
  const quality: QualityTier = parseOverride(location.search) ?? "high";
  return (
    <Canvas
      shadows="percentage"
      dpr={quality === "low" ? 1 : [1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 40, position: [0, BASE_CAM_Y, TARGET_Z + BASE_CAM_Z], near: 0.02, far: 20 }}
    >
      <DemoScene quality={quality} />
    </Canvas>
  );
}
