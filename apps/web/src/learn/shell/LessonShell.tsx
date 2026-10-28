import {
  type ComponentType,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { IdentifyCard, Lesson, LessonMode, Step } from "../types";
import IdentifyFrame from "./IdentifyFrame";
import {
  IconAbout,
  IconClose,
  IconDiagram,
  IconHome,
  IconMenu,
  IconMetreBridge,
  IconNotebook,
  IconOhm,
  IconTitration,
} from "./icons";
import Sheet from "./Sheet";
import StepBar, { type StepStatus } from "./StepBar";
import { usePhone } from "./usePhone";
import "./shell.css";

export type { StepStatus };

export type ShellTab = "instructions" | "why" | "precautions" | "examiner";

const TABS: { id: ShellTab; label: string; inExam: boolean }[] = [
  { id: "instructions", label: "Instructions", inExam: true },
  { id: "why", label: "Why it works", inExam: false },
  // Precautions are a marked item, so exam mode keeps them hidden.
  { id: "precautions", label: "Precautions", inExam: false },
  { id: "examiner", label: "Examiner asks", inExam: true },
];

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
   * step; Examiner asks has no default (the lesson page passes it in).
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
  /** The canvas. It fills the whole shell, behind the rail, header and panels. */
  children?: ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  /** Short label under the icon in the rail. */
  short: string;
  Icon: ComponentType;
  href?: string;
  current?: boolean;
}

const NAV: NavItem[] = [
  { id: "home", label: "Home", short: "Home", Icon: IconHome, href: "/" },
  {
    id: "meter",
    label: "Metre bridge",
    short: "Metre bridge",
    Icon: IconMetreBridge,
    href: "/?flow=1&golden=note1",
  },
  {
    id: "titration",
    label: "Titration",
    short: "Titration",
    Icon: IconTitration,
    href: "/?kit=titration",
  },
  {
    id: "ohms",
    label: "Ohm's law (V–I)",
    short: "Ohm's law",
    Icon: IconOhm,
    href: "/?learn=ohms-law",
    current: true,
  },
  { id: "notebook", label: "Notebook", short: "Notebook", Icon: IconNotebook },
  { id: "about", label: "About", short: "About", Icon: IconAbout, href: "/?about=1" },
];

function NavList({
  variant,
  onNotebook,
  onNavigate,
}: {
  variant: "rail" | "menu";
  onNotebook(): void;
  onNavigate?(): void;
}) {
  return (
    <ul className={`sh-nav sh-nav-${variant}`}>
      {NAV.map(({ id, label, short, Icon, href, current }) => (
        <li key={id} className={id === "notebook" ? "sh-nav-sep" : undefined}>
          {href ? (
            <a
              className="sh-nav-item"
              href={href}
              aria-current={current ? "page" : undefined}
              aria-label={label}
              onClick={onNavigate}
            >
              <Icon />
              <span>{variant === "rail" ? short : label}</span>
            </a>
          ) : (
            <button
              type="button"
              className="sh-nav-item"
              aria-label={label}
              onClick={() => {
                onNavigate?.();
                onNotebook();
              }}
            >
              <Icon />
              <span>{variant === "rail" ? short : label}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function InstructionsBody({ step, exam }: { step: Step; exam: boolean }) {
  const callouts = exam ? [] : (step.callouts ?? []);
  return (
    <>
      <h2 className="sh-step-title">{step.title}</h2>
      <figure className="sh-quote">
        <figcaption className="sh-label">The question says</figcaption>
        <blockquote>“{step.instruction}”</blockquote>
      </figure>
      {!exam && step.plain && (
        <div className="sh-next">
          <span className="sh-label">Do this next</span>
          <p>{step.plain}</p>
        </div>
      )}
      {callouts.length > 0 && (
        <div className="sh-callouts">
          <h3 className="sh-label">On the bench</h3>
          <ul>
            {callouts.map((c) => (
              <li key={`${c.part}-${c.label}`}>
                <strong>{c.label}</strong>
                {c.sub && <span>{c.sub}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ListBody({ items, empty }: { items: string[] | undefined; empty: string }) {
  if (!items || items.length === 0) return <p className="sh-empty">{empty}</p>;
  return (
    <ul className="sh-bullets">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function defaultBody(tab: ShellTab, step: Step, exam: boolean): ReactNode {
  switch (tab) {
    case "instructions":
      return <InstructionsBody step={step} exam={exam} />;
    case "why":
      return <ListBody items={step.whyItWorks} empty="Nothing to explain for this step yet." />;
    case "precautions":
      return <ListBody items={step.precautions} empty="No precautions for this step." />;
    case "examiner":
      return <p className="sh-empty">No examiner questions for this step yet.</p>;
  }
}

/**
 * The calm ink-and-paper lesson shell around the 3D bench (docs/plans/ohms-law-vi.md, Wave 2).
 * Controlled and data-driven: it holds only layout state (menu, notebook sheet, phone sheet height,
 * and the diagram toggle unless you control it). It computes nothing; ✓/✕ arrive in `stepStatus`.
 *
 * Laptop: dark rail on the left, header across the top, the tabbed panel floating on the right,
 * the step bar along the bottom, the canvas behind all of it. Phone (≤ 640 px): the rail becomes a
 * top bar with a menu, the panel a bottom sheet with a drag handle above the step bar.
 *
 * Exam mode turns every hint off: no "Do this next" line, callouts or Identify card, and no
 * "Why it works" or "Precautions" tabs. The question's own words, the diagram toggle and
 * "Examiner asks" stay.
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
}: LessonShellProps) {
  const phone = usePhone();
  const uid = useId();
  const step = lesson.steps[Math.min(stepIndex, lesson.steps.length - 1)];
  const [menuOpen, setMenuOpen] = useState(false);
  const [ownNotebookOpen, setOwnNotebookOpen] = useState(false);
  const notebookOpen = notebookOpenProp ?? ownNotebookOpen;
  const setNotebookOpen = (open: boolean) => {
    setOwnNotebookOpen(open);
    onNotebookOpenChange?.(open);
  };
  const [expanded, setExpanded] = useState(false);
  const [ownDiagramOpen, setOwnDiagramOpen] = useState(false);
  const diagramShown = diagramSlot !== undefined && (diagramOpen ?? ownDiagramOpen);
  const setDiagram = (open: boolean) => {
    setOwnDiagramOpen(open);
    onDiagramOpenChange?.(open);
  };
  const doneCount = stepStatus.filter((s) => s === "done").length;
  const exam = mode === "exam";
  const card = exam ? null : (identify?.card ?? null);
  const visibleTabs = exam ? TABS.filter((t) => t.inExam) : TABS;
  // A tab hidden by exam mode falls back to Instructions without touching the caller's state.
  const activeTab: ShellTab = visibleTabs.some((t) => t.id === tab) ? tab : "instructions";

  const drag = useRef<number | null>(null);
  const dragged = useRef(false);
  const menuBtn = useRef<HTMLButtonElement>(null);

  // Escape closes the menu from anywhere and hands focus back to the menu button.
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

  if (!step) return null;

  const tabId = (t: ShellTab) => `${uid}-tab-${t}`;
  const panelId = `${uid}-panel`;

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = visibleTabs.findIndex((t) => t.id === activeTab);
    const next =
      e.key === "ArrowRight"
        ? at + 1
        : e.key === "ArrowLeft"
          ? at - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? visibleTabs.length - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    const target = visibleTabs[(next + visibleTabs.length) % visibleTabs.length];
    if (!target) return;
    onTabChange(target.id);
    document.getElementById(tabId(target.id))?.focus();
  };

  const onHandleDown = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = e.clientY;
    dragged.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleUp = (e: PointerEvent<HTMLButtonElement>) => {
    const from = drag.current;
    drag.current = null;
    if (from === null) return;
    const dy = e.clientY - from;
    if (dy < -24) {
      setExpanded(true);
      dragged.current = true;
    } else if (dy > 24) {
      setExpanded(false);
      dragged.current = true;
    }
  };

  const body = tabContent?.[activeTab] ?? defaultBody(activeTab, step, exam);

  return (
    <div className="sh-root">
      <div className="sh-canvas">{children}</div>

      <nav className="sh-rail" aria-label="SnapLab NG">
        <NavList variant="rail" onNotebook={() => setNotebookOpen(true)} />
      </nav>

      <header className="sh-head">
        <button
          ref={menuBtn}
          type="button"
          className="sh-icon-btn sh-menu-btn"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls={`${uid}-menu`}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <IconMenu />
        </button>
        <span className="sh-wordmark">SnapLab NG</span>
        <h1 className="sh-head-title">{lesson.title}</h1>
        <span className="sh-chip">
          Step {stepIndex + 1} of {lesson.steps.length} · {doneCount} done
        </span>
        <span className={`sh-badge is-${mode}`}>{mode === "exam" ? "Exam" : "Practice"}</span>
        {diagramSlot !== undefined && (
          <button
            type="button"
            className="sh-btn sh-compare"
            aria-pressed={diagramShown}
            aria-label="Compare with diagram"
            onClick={() => setDiagram(!diagramShown)}
          >
            <IconDiagram />
            <span>Compare with diagram</span>
          </button>
        )}
        {menuOpen && (
          <div id={`${uid}-menu`} className="sh-menu">
            <NavList
              variant="menu"
              onNotebook={() => setNotebookOpen(true)}
              onNavigate={() => setMenuOpen(false)}
            />
          </div>
        )}
      </header>
      {menuOpen && (
        // Pointer-only outside-tap layer; the keyboard closes the menu with Escape.
        <div className="sh-menu-scrim" onPointerDown={() => setMenuOpen(false)} />
      )}

      <div className="sh-stack">
        {(diagramShown && !phone) || card ? (
          <div className="sh-float">
            {diagramShown && !phone && (
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
            )}
            {card && identify && <IdentifyFrame card={card} onClose={identify.onClose} />}
          </div>
        ) : null}

        <section
          className={`sh-panel${expanded ? " is-expanded" : ""}`}
          aria-label={`Step ${stepIndex + 1}: ${step.title}`}
        >
          <button
            type="button"
            className="sh-handle"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={expanded ? "Collapse instructions" : "Expand instructions"}
            onPointerDown={onHandleDown}
            onPointerUp={onHandleUp}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onClick={() => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              setExpanded((x) => !x);
            }}
          >
            <span className="sh-grabber" />
          </button>
          <div className="sh-peek">
            <p className="sh-peek-title">{step.title}</p>
            {!exam && step.plain && <p className="sh-peek-plain">{step.plain}</p>}
          </div>
          <div
            className="sh-tabs"
            role="tablist"
            aria-label="Step help"
            tabIndex={-1}
            onKeyDown={onTabKeyDown}
          >
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={tabId(t.id)}
                className="sh-tab"
                aria-selected={activeTab === t.id}
                aria-controls={panelId}
                tabIndex={activeTab === t.id ? 0 : -1}
                onClick={() => onTabChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            id={panelId}
            className="sh-panel-body"
            role="tabpanel"
            aria-labelledby={tabId(activeTab)}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable tab panel must be keyboard-focusable (WAI-ARIA tabs pattern)
            tabIndex={0}
          >
            {body}
          </div>
        </section>

        <StepBar
          steps={lesson.steps}
          stepIndex={stepIndex}
          stepStatus={stepStatus}
          onStepChange={onStepChange}
        />
      </div>

      {notebookOpen && (
        <Sheet
          label="Notebook"
          closeLabel="Close notebook"
          onClose={() => setNotebookOpen(false)}
          fallbackFocus={menuBtn}
        >
          {notebookSlot ?? <p className="sh-empty">The notebook is not open in this view.</p>}
        </Sheet>
      )}
      {diagramShown && phone && (
        <Sheet
          label="Diagram"
          closeLabel="Close diagram"
          onClose={() => setDiagram(false)}
          fallbackFocus={menuBtn}
        >
          <div className="sh-diagram-art">{diagramSlot}</div>
          <p className="sh-caption">{lesson.diagram.caption}</p>
        </Sheet>
      )}
    </div>
  );
}
