import { lazy, Suspense } from "react";

const Scene = lazy(() => import("./scene/Scene"));

export function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </div>
  );
}
