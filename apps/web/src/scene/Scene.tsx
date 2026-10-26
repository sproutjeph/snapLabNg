import { ContactShadows } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { CameraRig } from "./CameraRig";
import { Desk } from "./Desk";
import { InkStroke } from "./InkStroke";
import { Page } from "./Page";
import { ReadySignal } from "./ReadySignal";

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#5a4630", 0.6]} />
      <directionalLight
        position={[3, 6, 2]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
    </>
  );
}

export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 40, position: [0, 5.5, 4.5] }}
    >
      <color attach="background" args={["#0b0d12"]} />
      <Lights />
      <Desk />
      <Page />
      <InkStroke />
      <ContactShadows position={[0, 0.005, 0]} opacity={0.5} scale={8} blur={2} far={1} />
      <CameraRig />
      <ReadySignal />
      <EffectComposer>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={1.2} />
      </EffectComposer>
    </Canvas>
  );
}
