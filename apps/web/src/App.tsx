import { lazy, Suspense } from "react";
import type { PracticalMode } from "./learn/types";

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
const ReadingsPreview = lazy(() => import("./learn/readings/ReadingsPreview"));
const LearnPage = lazy(() => import("./learn/LearnPage"));
const WiringPreview = lazy(() => import("./learn/wiring/WiringPreview"));
const ShellPreview = lazy(() => import("./learn/shell/ShellPreview"));
const GraphPreview = lazy(() => import("./learn/graph/GraphPreview"));
const PracticalPage = lazy(() => import("./learn/PracticalPage"));
const LookPreview = lazy(() => import("./scene/look/LookPreview"));
const DirectorPreview = lazy(() => import("./learn/script/DirectorPreview"));
const PaperPreview = lazy(() => import("./learn/paper/PaperPreview"));
const ResultsPreview = lazy(() => import("./learn/results/ResultsPreview"));

// ?practical=ohms-law[&mode=watch|practice|exam][&seed=N]
function practicalProps(params: URLSearchParams) {
  const m = params.get("mode");
  const mode: PracticalMode | null = m === "watch" || m === "practice" || m === "exam" ? m : null;
  const raw = params.get("seed");
  const n = raw === null || raw === "" ? Number.NaN : Number(raw);
  return { mode, seed: Number.isFinite(n) ? n : null };
}

export function App() {
  const params = new URLSearchParams(location.search);
  const isLitePreview = params.get("lite") === "1";
  const isHomePreview = params.get("home") === "1";
  const isMeterBridgeKit = params.get("kit") === "meter-bridge";
  const isTitrationKit = params.get("kit") === "titration";
  const isOhmsLawKit = params.get("kit") === "ohms-law";
  const isReadingsPreview = params.get("readings") === "1";
  const isPractical = params.get("practical") === "ohms-law";
  const isLookPreview = params.get("look") === "ohms-law" || params.get("look") === "meter-bridge";
  const isDirectorPreview = params.get("director") === "1";
  const isPaperPreview = params.get("paper") === "1";
  const isResultsPreview = params.get("results") === "1";
  const isLearnOhmsLaw = params.get("learn") === "ohms-law";
  const isWiringPreview = params.get("wiring") === "1";
  const isShellPreview = params.get("shell") === "1";
  const isGraphPreview = params.get("graph") === "1";
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
        {isPractical ? (
          <PracticalPage {...practicalProps(params)} />
        ) : isLookPreview ? (
          <LookPreview />
        ) : isDirectorPreview ? (
          <DirectorPreview />
        ) : isPaperPreview ? (
          <PaperPreview />
        ) : isResultsPreview ? (
          <ResultsPreview />
        ) : isShellPreview ? (
          <ShellPreview />
        ) : isGraphPreview ? (
          <GraphPreview />
        ) : isLearnOhmsLaw ? (
          <LearnPage />
        ) : isReadingsPreview ? (
          <ReadingsPreview />
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
