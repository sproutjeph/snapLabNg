import {
  type ComponentType,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
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

const TABS: { id: ShellTab; label: string }[] = [
  { id: "instructions", label: "Instructions" },
  { id: "why", label: "Why it works" },
  { id: "precautions", label: "Precautions" },
  { id: "examiner", label: "Examiner asks" },
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

function InstructionsBody({ step }: { step: Step }) {
  const callouts = step.callouts ?? [];
  return (
    <>
      <h2 className="sh-step-title">{step.title}</h2>
      <figure className="sh-quote">
        <figcaption className="sh-label">The question says</figcaption>
        <blockquote>“{step.instruction}”</blockquote>
      </figure>
      {step.plain && (
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

function defaultBody(tab: ShellTab, step: Step): ReactNode {
  switch (tab) {
    case "instructions":
      return <InstructionsBody step={step} />;
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
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ownDiagramOpen, setOwnDiagramOpen] = useState(false);
  const diagramShown = diagramSlot !== undefined && (diagramOpen ?? ownDiagramOpen);
  const setDiagram = (open: boolean) => {
    setOwnDiagramOpen(open);
    onDiagramOpenChange?.(open);
  };
  const doneCount = stepStatus.filter((s) => s === "done").length;
  const card = identify?.card ?? null;

  const drag = useRef<number | null>(null);
  const dragged = useRef(false);

  if (!step) return null;

  const tabId = (t: ShellTab) => `${uid}-tab-${t}`;
  const panelId = `${uid}-panel`;

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = TABS.findIndex((t) => t.id === tab);
    const next =
      e.key === "ArrowRight"
        ? at + 1
        : e.key === "ArrowLeft"
          ? at - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? TABS.length - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    const target = TABS[(next + TABS.length) % TABS.length];
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

  const body = tabContent?.[tab] ?? defaultBody(tab, step);

  return (
    <div className="sh-root">
      <div className="sh-canvas">{children}</div>

      <nav className="sh-rail" aria-label="SnapLab NG">
        <NavList variant="rail" onNotebook={() => setNotebookOpen(true)} />
      </nav>

      <header className="sh-head">
        <button
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
        // biome-ignore lint/a11y/noStaticElementInteractions: outside-tap dismiss; Escape and the menu button also close it
        <div
          className="sh-menu-scrim"
          onPointerDown={() => setMenuOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}
        />
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
            {step.plain && <p className="sh-peek-plain">{step.plain}</p>}
          </div>
          <div
            className="sh-tabs"
            role="tablist"
            aria-label="Step help"
            tabIndex={-1}
            onKeyDown={onTabKeyDown}
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={tabId(t.id)}
                className="sh-tab"
                aria-selected={tab === t.id}
                aria-controls={panelId}
                tabIndex={tab === t.id ? 0 : -1}
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
            aria-labelledby={tabId(tab)}
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
        <Sheet label="Notebook" closeLabel="Close notebook" onClose={() => setNotebookOpen(false)}>
          {notebookSlot ?? <p className="sh-empty">The notebook is not open in this view.</p>}
        </Sheet>
      )}
      {diagramShown && phone && (
        <Sheet label="Diagram" closeLabel="Close diagram" onClose={() => setDiagram(false)}>
          <div className="sh-diagram-art">{diagramSlot}</div>
          <p className="sh-caption">{lesson.diagram.caption}</p>
        </Sheet>
      )}
    </div>
  );
}
