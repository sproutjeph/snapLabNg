import { lazy, Suspense } from "react";

const Scene = lazy(() => import("./scene/Scene"));
const KitPreview = lazy(() => import("./apparatus/meter-bridge/KitPreview"));

export function App() {
  const isMeterBridgeKit = new URLSearchParams(location.search).get("kit") === "meter-bridge";
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Suspense fallback={null}>{isMeterBridgeKit ? <KitPreview /> : <Scene />}</Suspense>
    </div>
  );
}
