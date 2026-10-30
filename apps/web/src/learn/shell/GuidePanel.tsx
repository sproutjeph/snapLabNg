import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef } from "react";
import type { Step } from "../types";
import { IconChevronDown, IconChevronUp } from "./icons";
import { useSlider } from "./useLayout";

export type ShellTab = "instructions" | "why" | "precautions" | "examiner";

export type GuideState = "open" | "peek";

export const TAB_LABEL: Record<ShellTab, string> = {
  instructions: "Instructions",
  why: "Why it works",
  precautions: "Precautions",
  examiner: "Examiner asks",
};

export interface GuidePanelProps {
  uid: string;
  step: Step;
  /** 1-based, for the panel's name. */
  stepNumber: number;
  exam: boolean;
  tabs: readonly ShellTab[];
  activeTab: ShellTab;
  onTabChange(tab: ShellTab): void;
  /** Replaces a tab's default body. */
  tabContent?: Partial<Record<ShellTab, ReactNode>> | undefined;
  /** The stage's sub-steps, under the question's words (Watch and Practise). */
  checklist?: ReactNode;
  /** The one line at the foot about this mode. */
  note?: ReactNode;
  /** A phone held upright: the guide can fold to a peek. */
  portrait: boolean;
  guide: GuideState;
  onGuideChange(g: GuideState): void;
}

function InstructionsBody({
  step,
  exam,
  checklist,
}: {
  step: Step;
  exam: boolean;
  checklist: ReactNode;
}) {
  // The stage's own sub-steps say what to do next, so "Do this next" and the callout list step
  // aside when they are there.
  const withList = checklist !== undefined && checklist !== null && checklist !== false;
  const callouts = exam || withList ? [] : (step.callouts ?? []);
  return (
    <>
      <figure className="sh-quote">
        <figcaption className="sh-label">The question says</figcaption>
        <blockquote>“{step.instruction}”</blockquote>
      </figure>
      {!exam && !withList && step.plain && (
        <div className="sh-next">
          <span className="sh-label">Do this next</span>
          <p>{step.plain}</p>
        </div>
      )}
      {withList ? checklist : null}
      {callouts.length > 0 && (
        <div className="sh-callouts">
          <h3 className="sh-label">On the bench</h3>
          <ul>
            {callouts.map((c) => (
              <li key={`${c.part}-${c.label}`}>
                <strong>{c.label}</strong>
                {c.sub && <span className="sh-sub">{c.sub}</span>}
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

function defaultBody(tab: ShellTab, step: Step, exam: boolean, checklist: ReactNode): ReactNode {
  switch (tab) {
    case "instructions":
      return <InstructionsBody step={step} exam={exam} checklist={checklist} />;
    case "why":
      return <ListBody items={step.whyItWorks} empty="Nothing to explain for this step yet." />;
    case "precautions":
      return <ListBody items={step.precautions} empty="No precautions for this step." />;
    case "examiner":
      return <p className="sh-empty">No examiner questions for this step yet.</p>;
  }
}

/** A drag this far, up or down, opens or folds the phone's guide. */
const DRAG_PX = 24;
/** The click a mouse sends right after a drag ends on a tab is ignored: it came within this long (ms). */
const CLICK_AFTER_DRAG_MS = 50;

/**
 * The guide: tabs with a sliding accent underline, and the step's card (its title, the
 * question's words, the stage's sub-steps, the mode's note). On a laptop it is a card on the
 * right. On a phone held upright it fills the foot of the screen and has two states: open (all
 * of it) and a peek (the tab row, the step's title and one line), so the bench keeps most of
 * the screen. A tap on the active tab, the fold button or a drag up or down changes the state.
 */
export default function GuidePanel({
  uid,
  step,
  stepNumber,
  exam,
  tabs,
  activeTab,
  onTabChange,
  tabContent,
  checklist,
  note,
  portrait,
  guide,
  onGuideChange,
}: GuidePanelProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  /** When the last drag on the tab row ended (an event's timeStamp), so its click can be ignored. */
  const dragEndedAt = useRef(Number.NEGATIVE_INFINITY);
  useSlider(
    tabsRef,
    inkRef,
    '.sh-tab[aria-selected="true"]',
    `${activeTab}|${tabs.length}|${portrait}`,
  );

  const peek = portrait && guide === "peek";
  const tabId = (t: ShellTab) => `${uid}-tab-${t}`;
  const panelId = `${uid}-panel`;

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = tabs.indexOf(activeTab);
    const next =
      e.key === "ArrowRight"
        ? at + 1
        : e.key === "ArrowLeft"
          ? at - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    const target = tabs[(next + tabs.length) % tabs.length];
    if (!target) return;
    pick(target);
    document.getElementById(tabId(target))?.focus();
  };

  /** Choosing another tab opens a folded guide (only the first tab has a peek); the active tab folds it. */
  function pick(t: ShellTab) {
    if (t === activeTab) return;
    onTabChange(t);
    if (portrait && t !== "instructions") onGuideChange("open");
  }

  // A drag on the tab row, up or down, opens or folds the phone's guide. The release is listened
  // for on the window, so a finger that has left the row still ends the drag.
  const onRowDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!portrait || !e.isPrimary) return;
    stopDrag.current?.();
    const from = e.clientY;
    const end = (ev: globalThis.PointerEvent) => {
      stopDrag.current?.();
      const dy = ev.clientY - from;
      if (dy < -DRAG_PX) {
        dragEndedAt.current = ev.timeStamp;
        onGuideChange("open");
      } else if (dy > DRAG_PX) {
        dragEndedAt.current = ev.timeStamp;
        if (activeTab === "instructions") onGuideChange("peek");
      }
    };
    const cancel = () => stopDrag.current?.();
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
    stopDrag.current = () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      stopDrag.current = null;
    };
  };
  useEffect(() => () => stopDrag.current?.(), []);

  const body = tabContent?.[activeTab] ?? defaultBody(activeTab, step, exam, checklist);
  const line = exam ? step.instruction : step.plain || step.instruction;
  // The fold button at the title's right (a phone): the guide's open or folded state, by tap.
  const fold = portrait ? (
    <button
      type="button"
      className="sh-fold"
      aria-expanded={!peek}
      aria-controls={panelId}
      aria-label={peek ? "Show the whole guide" : "Fold the guide"}
      disabled={activeTab !== "instructions"}
      onClick={() => onGuideChange(peek ? "open" : "peek")}
    >
      {peek ? <IconChevronUp /> : <IconChevronDown />}
    </button>
  ) : null;

  return (
    <section
      className="sh-guide"
      data-region="guide"
      data-state={peek ? "peek" : "open"}
      aria-label={`Step ${stepNumber}: ${step.title}`}
    >
      {/* The drag is a pointer-only shortcut; the fold button and the tabs do the same by keyboard. */}
      <div className="sh-tabs-row" data-region="tabs" role="presentation" onPointerDown={onRowDown}>
        <div
          ref={tabsRef}
          className="sh-tabs"
          role="tablist"
          aria-label="Step help"
          data-n={tabs.length}
          onKeyDown={onTabKeyDown}
        >
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={tabId(t)}
              className="sh-tab"
              aria-selected={activeTab === t}
              aria-controls={panelId}
              tabIndex={activeTab === t ? 0 : -1}
              onClick={(e) => {
                if (e.timeStamp - dragEndedAt.current < CLICK_AFTER_DRAG_MS) return;
                if (t === activeTab) {
                  if (portrait && activeTab === "instructions") {
                    onGuideChange(guide === "open" ? "peek" : "open");
                  }
                  return;
                }
                pick(t);
              }}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
          <span ref={inkRef} className="sh-tab-ink" aria-hidden="true" />
        </div>
      </div>

      <div
        id={panelId}
        className="sh-card sh-guide-card"
        data-region="card"
        role="tabpanel"
        aria-labelledby={tabId(activeTab)}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable tab panel must be keyboard-focusable (WAI-ARIA tabs pattern)
        tabIndex={0}
      >
        {peek ? (
          <div className="sh-peek">
            <div className="sh-guide-head">
              <p className="sh-peek-title">{step.title}</p>
              {fold}
            </div>
            {line ? <p className="sh-peek-line">{line}</p> : null}
          </div>
        ) : (
          <>
            <div className="sh-guide-head">
              <h2 className="sh-guide-title">{step.title}</h2>
              {fold}
            </div>
            {body}
            {note ? <p className="sh-note">{note}</p> : null}
          </>
        )}
      </div>
    </section>
  );
}
