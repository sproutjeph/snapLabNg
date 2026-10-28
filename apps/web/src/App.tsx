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
const QualityPreview = lazy(() => import("./quality/QualityPreview"));
const MicPreview = lazy(() => import("./examiner/voice/MicPreview"));
const PwaPreview = lazy(() => import("./pwa/PwaPreview"));
const HomePreview = lazy(() => import("./home/HomePreview"));
const AboutPreview = lazy(() => import("./about/AboutPreview"));
const LitePreview = lazy(() => import("./lite/LitePreview"));
const OhmsLawKitPreview = lazy(() => import("./apparatus/ohms-law/KitPreview"));
const LearnPage = lazy(() => import("./learn/LearnPage"));
const WiringPreview = lazy(() => import("./learn/wiring/WiringPreview"));
const ShellPreview = lazy(() => import("./learn/shell/ShellPreview"));

export function App() {
  const params = new URLSearchParams(location.search);
  const isLitePreview = params.get("lite") === "1";
  const isHomePreview = params.get("home") === "1";
  const isMeterBridgeKit = params.get("kit") === "meter-bridge";
  const isTitrationKit = params.get("kit") === "titration";
  const isOhmsLawKit = params.get("kit") === "ohms-law";
  const isLearnOhmsLaw = params.get("learn") === "ohms-law";
  const isWiringPreview = params.get("wiring") === "1";
  const isShellPreview = params.get("shell") === "1";
  const isCapturePreview = params.get("capture") === "1";
  const isDrawerPreview = params.get("drawer") === "1";
  const isAudioPreview = params.get("audio") === "1";
  const isNotebookPreview = params.get("notebook") === "1";
  const isFlow = params.get("flow") === "1";
  const isGoldenPreview = params.get("golden-preview") === "1";
  const isMarkingPreview = params.get("marking") === "1";
  const isExaminerPreview = params.get("examiner") === "1";
  const isTeacherPreview = params.get("teacher") === "1";
  const isQualityPreview = params.get("quality") === "1";
  const isMicPreview = params.get("mic") === "1";
  const isPwaPreview = params.get("pwa") === "1";
  const isAboutPreview = params.get("about") === "1";
  const isScene = params.get("scene") === "1";
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Suspense fallback={null}>
        {isShellPreview ? (
          <ShellPreview />
        ) : isLearnOhmsLaw ? (
          <LearnPage />
        ) : isWiringPreview ? (
          <WiringPreview />
        ) : isLitePreview ? (
          <LitePreview />
        ) : isPwaPreview ? (
          <PwaPreview />
        ) : isAboutPreview ? (
          <AboutPreview />
        ) : isMicPreview ? (
          <MicPreview />
        ) : isHomePreview ? (
          <HomePreview />
        ) : isQualityPreview ? (
          <QualityPreview />
        ) : isExaminerPreview ? (
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
        ) : isOhmsLawKit ? (
          <OhmsLawKitPreview />
        ) : isScene ? (
          <Scene />
        ) : (
          // The home page is the first screen (docs/plans/home-page.md).
          <HomePreview />
        )}
      </Suspense>
    </div>
  );
}
