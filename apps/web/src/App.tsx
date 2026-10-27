import { lazy, Suspense } from "react";

const Scene = lazy(() => import("./scene/Scene"));
const KitPreview = lazy(() => import("./apparatus/meter-bridge/KitPreview"));
const CapturePreview = lazy(() => import("./capture/CapturePreview"));
const DrawerPreview = lazy(() => import("./ai-drawer/DrawerPreview"));
const AudioPreview = lazy(() => import("./audio/AudioPreview"));

export function App() {
  const params = new URLSearchParams(location.search);
  const isMeterBridgeKit = params.get("kit") === "meter-bridge";
  const isCapturePreview = params.get("capture") === "1";
  const isDrawerPreview = params.get("drawer") === "1";
  const isAudioPreview = params.get("audio") === "1";
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Suspense fallback={null}>
        {isAudioPreview ? (
          <AudioPreview />
        ) : isDrawerPreview ? (
          <DrawerPreview />
        ) : isCapturePreview ? (
          <CapturePreview />
        ) : isMeterBridgeKit ? (
          <KitPreview />
        ) : (
          <Scene />
        )}
      </Suspense>
    </div>
  );
}
