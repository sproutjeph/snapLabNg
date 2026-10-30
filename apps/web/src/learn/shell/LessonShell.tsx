import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react";
import { CalloutChip, type CalloutChipProps } from "../callouts/Callouts";
import type { IdentifyCard, Lesson, LessonMode, PracticalMode } from "../types";
import Brand from "./Brand";
import GuidePanel, { type GuideState, type ShellTab } from "./GuidePanel";
import IdentifyFrame from "./IdentifyFrame";
import {
  IconAnswers,
  IconBook,
  IconClose,
  IconDiagram,
  IconGraph,
  IconNotebook,
  IconQuestion,
  IconSteps,
  IconTools,
} from "./icons";
import Rail, { NavList, type PopupNavId } from "./Rail";
import Sheet from "./Sheet";
import StatusCard, { type StatusCredit } from "./StatusCard";
import StepBar, { type StepStatus } from "./StepBar";
import { useLayout } from "./useLayout";
import "./shell.css";

export type { CalloutChipProps, GuideState, ShellTab, StatusCredit, StepStatus };

export type PopupId = "question" | "instructions" | "steps" | "graph" | "answers" | "tools";

export { CalloutChip };

/** The tabs in order. Exam keeps Instructions and Examiner asks only; Examiner asks needs content. */
const TAB_ORDER: readonly ShellTab[] = ["instructions", "why", "precautions", "examiner"];

export interface LessonShellProps {
  lesson: Lesson;
  mode: LessonMode;
  /** 0-based index of the current step. */
  stepIndex: number;
  onStepChange(index: number): void;
  /** One entry per step, from the step `done()` checks and the rules. Missing entries read "todo". */
  stepStatus: StepStatus[];
  tab: ShellTab;
  onTabChange(tab: ShellTab): void;
  /**
   * Replaces a tab's default body. Instructions, Why it works and Precautions read the current
   * step; Examiner asks has no default, so its tab shows only when this carries it.
   */
  tabContent?: Partial<Record<ShellTab, ReactNode>>;
  /** Shown in the Notebook sheet (rail > Notebook). */
  notebookSlot?: ReactNode;
  /** Controlled state of the Notebook sheet. Leave both unset and the shell keeps it itself. */
  notebookOpen?: boolean;
  onNotebookOpenChange?(open: boolean): void;
  /** The circuit diagram. Without it, the "Compare with diagram" toggle is hidden. */
  diagramSlot?: ReactNode;
  /** Controlled state of the diagram toggle. Leave both unset and the shell keeps it itself. */
  diagramOpen?: boolean;
  onDiagramOpenChange?(open: boolean): void;
  /** The Identify frame renders only while `card` is set. */
  identify?: { card: IdentifyCard | null; onClose(): void };
  /**
   * The canvas. It fills the stage (the whole shell but the rail), behind every card: the cards
   * float over it and cover only their own corners (docs/plans/page-layout.md).
   */
  children?: ReactNode;

  // ---- Additive (page layout). Every prop below is optional. ----

  /**
   * Which way through the practical is on, for the brand's "WATCH · PRACTISE · EXAM". Without it,
   * `mode` says: "exam", or "practice".
   */
  practical?: PracticalMode;
  /**
   * Laid over the stage in the same coordinate space, above the callouts and the canvas: the
   * Player (its card, caption and clock).
   */
  overlay?: ReactNode;
  /** The stage's sub-steps, shown under the question's words in Instructions (not in Exam). */
  checklist?: ReactNode;
  /** The status card: the paper's source (the credit), and `hideCount` to drop the count (Exam). */
  status?: { credit?: StatusCredit | undefined; hideCount?: boolean | undefined };
  /** Step.key to the URL of its picture. A step with none shows a numbered ink ring. */
  thumbs?: Readonly<Record<string, string>>;
  /** Cards from this index on are locked: shown, but not selectable. Practise: current + 1. */
  lockedFrom?: number | undefined;
  /** The step cards are display only (Practise and Exam). */
  readOnlyTabs?: boolean | undefined;
  /** A phone held upright: the guide open, or folded to a peek (default "peek"). */
  guide?: GuideState;
  onGuideChange?(guide: GuideState): void;
  /** The one line at the guide's foot about this mode. */
  note?: ReactNode;
  /**
   * Watch: plays the demonstration again from its first beat. The practical menu on the strip
   * lists it as Restart.
   */
  onRestart?: (() => void) | undefined;
  /** A div over the canvas and under the cards, for the callout labels (W2-callouts). */
  calloutLayerRef?: RefObject<HTMLDivElement | null>;

  // ---- Pop-up layout (docs/plans/wave-2-lean.md) ----

  /** Optional tools slot (Compare, Notebook, Undo, Reset) that the Tools pop-up shows. */
  tools?: ReactNode;
  /** Optional custom slot for the Question Paper pop-up. */
  questionSlot?: ReactNode;
  /** Optional custom slot for the Graph Sheet pop-up. */
  graphSlot?: ReactNode;
  /** Optional custom slot for the Answer Sheet pop-up. */
  answersSlot?: ReactNode;
  /** Controlled active pop-up. */
  activePopup?: PopupId | null;
  onPopupChange?(popup: PopupId | null): void;
  /** Initial pop-up on mount (defaults to null, or "question" at start). */
  defaultPopup?: PopupId | null;
  /** Optional callout chip to render on the stage. */
  callout?: { label: string; x: number; y: number; visible: boolean };
}

/**
 * The page shell around the 3D bench in the pop-up layout (docs/plans/wave-2-lean.md):
 * - Always on screen: full-bleed stage, slim top bar (brand, player pill, progress badge),
 *   and bottom caption pill.
 * - Pop-ups: Question, Instructions, Steps, Graph, Answers, and Tools.
 *   On phone: bottom sheets. On laptop: cards that slide in from the right.
 * - CalloutChip with BC101 spring, text swap, and first-show pop animations.
 */
export default function LessonShell({
  lesson,
  mode,
  stepIndex,
  onStepChange,
  stepStatus,
  tab,
  onTabChange,
  tabContent,
  notebookSlot,
  notebookOpen: notebookOpenProp,
  onNotebookOpenChange,
  diagramSlot,
  diagramOpen,
  onDiagramOpenChange,
  identify,
  children,
  practical,
  overlay,
  checklist,
  status,
  thumbs,
  lockedFrom,
  readOnlyTabs,
  guide: guideProp,
  onGuideChange,
  note,
  onRestart,
  calloutLayerRef,
  tools,
  questionSlot,
  graphSlot,
  answersSlot,
  activePopup,
  onPopupChange,
  defaultPopup = null,
  callout,
}: LessonShellProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const ownCalloutLayer = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const layout = useLayout(rootRef);

  const portrait = layout === "portrait";
  const phone = portrait || layout === "short";

  const step = lesson.steps[Math.min(stepIndex, lesson.steps.length - 1)];

  // Pop-up management
  const [ownPopup, setOwnPopup] = useState<PopupId | null>(defaultPopup);
  const popup = activePopup !== undefined ? activePopup : ownPopup;
  const setPopup = (p: PopupId | null) => {
    setOwnPopup(p);
    onPopupChange?.(p);
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [ownNotebookOpen, setOwnNotebookOpen] = useState(false);
  const notebookOpen = notebookOpenProp ?? ownNotebookOpen;
  const setNotebookOpen = (open: boolean) => {
    setOwnNotebookOpen(open);
    onNotebookOpenChange?.(open);
  };

  const [ownDiagramOpen, setOwnDiagramOpen] = useState(false);
  const diagramShown = diagramSlot !== undefined && (diagramOpen ?? ownDiagramOpen);
  const setDiagram = (open: boolean) => {
    setOwnDiagramOpen(open);
    onDiagramOpenChange?.(open);
  };

  const [ownGuide, setOwnGuide] = useState<GuideState>("peek");
  const guide = guideProp ?? ownGuide;
  const setGuide = (g: GuideState) => {
    setOwnGuide(g);
    onGuideChange?.(g);
  };

  const exam = mode === "exam";
  const card = exam ? null : (identify?.card ?? null);
  const hasExaminer = tabContent?.examiner !== undefined;
  const tabs = TAB_ORDER.filter((t) =>
    t === "instructions" ? true : t === "examiner" ? hasExaminer : !exam,
  );
  const activeTab: ShellTab = tabs.includes(tab) ? tab : "instructions";
  const guideNow: GuideState = portrait && activeTab === "instructions" ? guide : "open";
  const practicalMode: PracticalMode = practical ?? (exam ? "exam" : "practice");
  const doneCount = stepStatus.filter((s) => s === "done").length;

  // Escape closes the phone menu from anywhere and hands focus back to the mark that opened it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuBtn.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!phone) setMenuOpen(false);
  }, [phone]);

  if (!step) return null;

  const compare =
    diagramSlot !== undefined ? (
      <button
        type="button"
        className="sh-btn sh-compare"
        aria-pressed={diagramShown}
        aria-label="Compare with diagram"
        onClick={() => setDiagram(!diagramShown)}
      >
        <IconDiagram />
        <span className="sh-txt">Compare with diagram</span>
      </button>
    ) : null;
  const diagramOnStage = diagramShown && !phone;
  const showFloat = !phone && (compare !== null || diagramOnStage || card !== null);

  const guidePanelNode = (
    <GuidePanel
      uid={uid}
      step={step}
      stepNumber={stepIndex + 1}
      exam={exam}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabContent={tabContent}
      checklist={exam ? undefined : checklist}
      note={note}
      portrait={portrait}
      guide={guideNow}
      onGuideChange={setGuide}
    />
  );

  const stepBarNode = (
    <StepBar
      steps={lesson.steps}
      stepIndex={stepIndex}
      stepStatus={stepStatus}
      onStepChange={onStepChange}
      title={lesson.title}
      thumbs={thumbs}
      lockedFrom={lockedFrom}
      readOnly={readOnlyTabs}
      onRestart={onRestart}
    />
  );

  const questionPaperNode = (
    <div className="sh-question-content">
      <h3 className="sh-label">{lesson.title}</h3>
      <div className="sh-question-lead">
        <blockquote>“{step.instruction}”</blockquote>
      </div>
      {lesson.diagram ? (
        <div className="sh-diagram-art">
          {diagramSlot}
          <p className="sh-caption">{lesson.diagram.caption}</p>
        </div>
      ) : null}
    </div>
  );

  const toolsPanelNode = (
    <div className="sh-tools-panel">
      {tools}
      {diagramSlot !== undefined ? (
        <button
          type="button"
          className="sh-btn sh-compare"
          aria-pressed={diagramShown}
          aria-label="Compare with diagram"
          onClick={() => setDiagram(!diagramShown)}
        >
          <IconDiagram />
          <span className="sh-txt">Compare with diagram</span>
        </button>
      ) : null}
      {notebookSlot !== undefined ? (
        <button
          type="button"
          className="sh-btn"
          aria-label="Open notebook"
          onClick={() => {
            setPopup(null);
            setNotebookOpen(true);
          }}
        >
          <IconNotebook />
          <span className="sh-txt">Notebook</span>
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="sh-root"
      data-guide={guideNow}
      data-status={status?.credit ? "credit" : "plain"}
      data-popup={popup ?? "none"}
    >
      <div className="sh-stage">
        <div className="sh-canvas">{children}</div>
        <div ref={calloutLayerRef ?? ownCalloutLayer} className="sh-callout-layer">
          {callout && <CalloutChip {...callout} />}
        </div>

        <div className="sh-band" aria-hidden="true" />

        {/* Slim Top Bar: Brand, Player Pill (overlay), Progress Badge & Pop-up buttons */}
        <header className="sh-top-bar" data-region="top-bar">
          <Brand
            practical={practicalMode}
            menuRef={menuBtn}
            {...(phone
              ? {
                  menu: {
                    open: menuOpen,
                    controls: `${uid}-menu`,
                    onToggle: () => setMenuOpen((o) => !o),
                  },
                }
              : {})}
          />

          <StatusCard
            title={lesson.title}
            done={doneCount}
            total={lesson.steps.length}
            hideCount={status?.hideCount}
            credit={status?.credit}
          />

          <nav className="sh-top-actions" aria-label="Practical pop-ups">
            <button
              type="button"
              className={`sh-pop-btn${popup === "question" ? " is-active" : ""}`}
              aria-label="Question paper"
              title="Question paper"
              aria-pressed={popup === "question"}
              onClick={() => setPopup(popup === "question" ? null : "question")}
            >
              <IconQuestion />
              <span className="sh-txt">Question</span>
            </button>
            <button
              type="button"
              className={`sh-pop-btn${popup === "instructions" ? " is-active" : ""}`}
              aria-label="Instructions"
              title="Instructions"
              aria-pressed={popup === "instructions"}
              onClick={() => setPopup(popup === "instructions" ? null : "instructions")}
            >
              <IconBook />
              <span className="sh-txt">Instructions</span>
            </button>
            <button
              type="button"
              className={`sh-pop-btn sh-pop-btn-steps${popup === "steps" ? " is-active" : ""}`}
              aria-label="Steps"
              title="Steps"
              aria-pressed={popup === "steps"}
              onClick={() => setPopup(popup === "steps" ? null : "steps")}
            >
              <IconSteps />
              <span className="sh-txt">Steps</span>
            </button>
            <button
              type="button"
              className={`sh-pop-btn${popup === "graph" ? " is-active" : ""}`}
              aria-label="Graph sheet"
              title="Graph sheet"
              aria-pressed={popup === "graph"}
              onClick={() => setPopup(popup === "graph" ? null : "graph")}
            >
              <IconGraph />
              <span className="sh-txt">Graph</span>
            </button>
            <button
              type="button"
              className={`sh-pop-btn${popup === "answers" ? " is-active" : ""}`}
              aria-label="Answer sheet"
              title="Answer sheet"
              aria-pressed={popup === "answers"}
              onClick={() => setPopup(popup === "answers" ? null : "answers")}
            >
              <IconAnswers />
              <span className="sh-txt">Answers</span>
            </button>
            <button
              type="button"
              className={`sh-pop-btn${popup === "tools" ? " is-active" : ""}`}
              aria-label="Tools"
              title="Tools"
              aria-pressed={popup === "tools"}
              onClick={() => setPopup(popup === "tools" ? null : "tools")}
            >
              <IconTools />
              <span className="sh-txt">Tools</span>
            </button>
          </nav>
        </header>

        {phone && menuOpen ? (
          <>
            <div id={`${uid}-menu`} className="sh-menu">
              <NavList
                variant="menu"
                onNotebook={() => {
                  setMenuOpen(false);
                  setNotebookOpen(true);
                }}
                onNavigate={() => setMenuOpen(false)}
                onPopup={(p: PopupNavId) => {
                  setMenuOpen(false);
                  setPopup(p);
                }}
              />
            </div>
            <div className="sh-menu-scrim" onPointerDown={() => setMenuOpen(false)} />
          </>
        ) : null}

        {showFloat ? (
          <div className="sh-float">
            {compare}
            {diagramOnStage ? (
              <section className="sh-card sh-diagram" aria-label="Circuit diagram">
                <div className="sh-card-head">
                  <span className="sh-label">Diagram</span>
                  <button
                    type="button"
                    className="sh-icon-btn"
                    aria-label="Close diagram"
                    onClick={() => setDiagram(false)}
                  >
                    <IconClose />
                  </button>
                </div>
                <div className="sh-card-body">
                  <div className="sh-diagram-art">{diagramSlot}</div>
                  <p className="sh-caption">{lesson.diagram.caption}</p>
                </div>
              </section>
            ) : null}
            {card && identify ? <IdentifyFrame card={card} onClose={identify.onClose} /> : null}
          </div>
        ) : phone ? (
          compare
        ) : null}

        {/* Player overlay (card in top row, caption at the bottom) */}
        {overlay}

        {/* Active Modal Pop-ups (slide-in card on laptop, bottom sheet on phone) */}
        {popup === "question" && (
          <Sheet
            label="Question paper"
            closeLabel="Close question paper"
            onClose={() => setPopup(null)}
            fallbackFocus={menuBtn}
            className="sh-sheet-question"
          >
            {questionSlot ?? questionPaperNode}
          </Sheet>
        )}

        {popup === "instructions" && (
          <Sheet
            label="Instructions"
            closeLabel="Close instructions"
            onClose={() => setPopup(null)}
            fallbackFocus={menuBtn}
            className="sh-sheet-instructions"
          >
            {guidePanelNode}
          </Sheet>
        )}

        {popup === "steps" && (
          <Sheet
            label="Steps"
            closeLabel="Close steps"
            onClose={() => setPopup(null)}
            fallbackFocus={menuBtn}
            className="sh-sheet-steps"
          >
            {stepBarNode}
          </Sheet>
        )}

        {popup === "graph" && (
          <Sheet
            label="Graph sheet"
            closeLabel="Close graph sheet"
            onClose={() => setPopup(null)}
            fallbackFocus={menuBtn}
            className="sh-sheet-graph"
          >
            {graphSlot ?? <p className="sh-empty">Graph paper will appear here when available.</p>}
          </Sheet>
        )}

        {popup === "answers" && (
          <Sheet
            label="Answer sheet"
            closeLabel="Close answer sheet"
            onClose={() => setPopup(null)}
            fallbackFocus={menuBtn}
            className="sh-sheet-answers"
          >
            {answersSlot ?? (
              <p className="sh-empty">Your answers and marked results will appear here.</p>
            )}
          </Sheet>
        )}

        {popup === "tools" && (
          <Sheet
            label="Tools"
            closeLabel="Close tools"
            onClose={() => setPopup(null)}
            fallbackFocus={menuBtn}
            className="sh-sheet-tools"
          >
            {toolsPanelNode}
          </Sheet>
        )}

        {/* Shelf for static markup and accessibility inspection */}
        <div className="sh-popups-shelf" hidden aria-hidden="true">
          {popup !== "instructions" && guidePanelNode}
          {popup !== "steps" && stepBarNode}
        </div>
      </div>

      {phone ? null : <Rail onNotebook={() => setNotebookOpen(true)} />}

      {notebookOpen ? (
        <Sheet
          label="Notebook"
          closeLabel="Close notebook"
          onClose={() => setNotebookOpen(false)}
          fallbackFocus={menuBtn}
        >
          {notebookSlot ?? <p className="sh-empty">The notebook is not open in this view.</p>}
        </Sheet>
      ) : null}
      {diagramShown && phone ? (
        <Sheet
          label="Diagram"
          closeLabel="Close diagram"
          onClose={() => setDiagram(false)}
          fallbackFocus={menuBtn}
        >
          <div className="sh-diagram-art">{diagramSlot}</div>
          <p className="sh-caption">{lesson.diagram.caption}</p>
        </Sheet>
      ) : null}
      {card && identify && phone ? (
        <Sheet
          label={`Identify: ${card.name}`}
          closeLabel="Close identify card"
          onClose={identify.onClose}
          fallbackFocus={menuBtn}
        >
          <IdentifyFrame card={card} onClose={identify.onClose} bare />
        </Sheet>
      ) : null}
    </div>
  );
}
