import { lazy, Suspense } from "react";

const Scene = lazy(() => import("./scene/Scene"));
const KitPreview = lazy(() => import("./apparatus/meter-bridge/KitPreview"));
const TitrationKitPreview = lazy(() => import("./apparatus/titration/KitPreview"));
const CapturePreview = lazy(() => import("./capture/CapturePreview"));
const DrawerPreview = lazy(() => import("./ai-drawer/DrawerPreview"));
const AudioPreview = lazy(() => import("./audio/AudioPreview"));
const NotebookPreview = lazy(() => import("./notebook/NotebookPreview"));
const FlowPage = lazy(() => import("./pipeline/FlowPage"));
const GoldenPreview = lazy(() => import("./golden/GoldenPreview"));
const MarkingPreview = lazy(() => import("./marking/MarkingPreview"));
const ExaminerPreview = lazy(() => import("./examiner/ExaminerPreview"));
const TeacherPreview = lazy(() => import("./teacher/TeacherPreview"));

export function App() {
  const params = new URLSearchParams(location.search);
  const isMeterBridgeKit = params.get("kit") === "meter-bridge";
  const isTitrationKit = params.get("kit") === "titration";
  const isCapturePreview = params.get("capture") === "1";
  const isDrawerPreview = params.get("drawer") === "1";
  const isAudioPreview = params.get("audio") === "1";
  const isNotebookPreview = params.get("notebook") === "1";
  const isFlow = params.get("flow") === "1";
  const isGoldenPreview = params.get("golden-preview") === "1";
  const isMarkingPreview = params.get("marking") === "1";
  const isExaminerPreview = params.get("examiner") === "1";
  const isTeacherPreview = params.get("teacher") === "1";
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Suspense fallback={null}>
        {isExaminerPreview ? (
          <ExaminerPreview />
        ) : isTeacherPreview ? (
          <TeacherPreview />
        ) : isMarkingPreview ? (
          <MarkingPreview />
        ) : isGoldenPreview ? (
          <GoldenPreview />
        ) : isNotebookPreview ? (
          <NotebookPreview />
        ) : isFlow ? (
          <FlowPage />
        ) : isAudioPreview ? (
          <AudioPreview />
        ) : isDrawerPreview ? (
          <DrawerPreview />
        ) : isCapturePreview ? (
          <CapturePreview />
        ) : isMeterBridgeKit ? (
          <KitPreview />
        ) : isTitrationKit ? (
          <TitrationKitPreview />
        ) : (
          <Scene />
        )}
      </Suspense>
    </div>
  );
}
