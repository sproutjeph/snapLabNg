import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react";
import type { IdentifyCard, Lesson, LessonMode, PracticalMode } from "../types";
import Brand from "./Brand";
import GuidePanel, { type GuideState, type ShellTab } from "./GuidePanel";
import IdentifyFrame from "./IdentifyFrame";
import { IconClose, IconDiagram } from "./icons";
import Rail, { NavList } from "./Rail";
import Sheet from "./Sheet";
import StatusCard, { type StatusCredit } from "./StatusCard";
import StepBar, { type StepStatus } from "./StepBar";
import { useLayout } from "./useLayout";
import "./shell.css";

export type { GuideState, ShellTab, StatusCredit, StepStatus };

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
  /** A div over the canvas and under the cards, for the callout labels (W2-callouts). */
  calloutLayerRef?: RefObject<HTMLDivElement | null>;
}

/**
 * The page shell around the 3D bench (docs/plans/page-layout.md): the canvas full-bleed behind
 * Backcountry-style cards in paper and ink. A dark rail on the left (laptop), the brand and a
 * status card across the top, the guide (tabs, the step's card) down the right, the step strip
 * along the foot, and the Player's card and caption laid over the stage by `overlay`.
 *
 * One layout (layout.ts) drives it: four modes by screen size, every size drawn in design px and
 * scaled with `--ui`. On a phone held upright there is no rail (the brand mark opens the menu),
 * the strip sits above a guide that folds to a peek, and the diagram and Identify card open as
 * sheets.
 *
 * Controlled and data-driven: it holds only layout state (menus, sheets, the phone's guide, the
 * diagram toggle unless you control it). It computes nothing; ✓/✕ arrive in `stepStatus`.
 *
 * Exam mode turns every hint off: no "Do this next" line, callouts or Identify card, no "Why it
 * works" or "Precautions" tab, and the status card can drop its count. The question's own words,
 * the diagram toggle and "Examiner asks" stay.
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
  calloutLayerRef,
}: LessonShellProps) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const ownCalloutLayer = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const layout = useLayout(rootRef);
  // A phone (upright or sideways) has no rail, and shows the diagram and Identify card as sheets.
  const portrait = layout === "portrait";
  const phone = portrait || layout === "short";

  const step = lesson.steps[Math.min(stepIndex, lesson.steps.length - 1)];
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
  // A tab hidden by exam mode (or missing its content) falls back to Instructions without
  // touching the caller's state.
  const activeTab: ShellTab = tabs.includes(tab) ? tab : "instructions";
  // Only Instructions has a peek: any other tab shows in full.
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
  // Turning the phone sideways, or onto a laptop, closes a menu left open.
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

  return (
    <div
      ref={rootRef}
      className="sh-root"
      data-guide={guideNow}
      data-status={status?.credit ? "credit" : "plain"}
      data-compare={compare !== null ? "on" : undefined}
    >
      <div className="sh-stage">
        <div className="sh-canvas">{children}</div>
        <div ref={calloutLayerRef ?? ownCalloutLayer} className="sh-callout-layer" />

        <div className="sh-band" aria-hidden="true" />
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
        {phone && menuOpen ? (
          <>
            <div id={`${uid}-menu`} className="sh-menu">
              <NavList
                variant="menu"
                onNotebook={() => setNotebookOpen(true)}
                onNavigate={() => setMenuOpen(false)}
              />
            </div>
            {/* Pointer-only outside-tap layer; the keyboard closes the menu with Escape. */}
            <div className="sh-menu-scrim" onPointerDown={() => setMenuOpen(false)} />
          </>
        ) : null}

        <StatusCard
          title={lesson.title}
          done={doneCount}
          total={lesson.steps.length}
          hideCount={status?.hideCount}
          credit={status?.credit}
        />

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

        {overlay}

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

        <StepBar
          steps={lesson.steps}
          stepIndex={stepIndex}
          stepStatus={stepStatus}
          onStepChange={onStepChange}
          title={lesson.title}
          thumbs={thumbs}
          lockedFrom={lockedFrom}
          readOnly={readOnlyTabs}
        />
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
