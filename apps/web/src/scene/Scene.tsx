import { Canvas } from "@react-three/fiber";
import type { QualityTier } from "../apparatus/meter-bridge/types";
import { parseOverride } from "../quality/tier";
import { CameraRig } from "./CameraRig";
import { Desk } from "./Desk";
import { InkStroke } from "./InkStroke";
import { InkComposer } from "./ink/InkComposer";
import { InkLights } from "./ink/InkLights";
import { Page } from "./Page";
import { ReadySignal } from "./ReadySignal";

export default function Scene() {
  const quality: QualityTier = parseOverride(location.search) ?? "high";
  return (
    <Canvas
      shadows="percentage"
      dpr={quality === "low" ? 1 : [1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 40, position: [0, 5.5, 4.5] }}
    >
      <InkLights quality={quality} />
      <Desk quality={quality} />
      <Page />
      <InkStroke />
      <CameraRig />
      <ReadySignal />
      <InkComposer quality={quality} />
    </Canvas>
  );
}
