import { type ComponentType, type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { PartId, Step } from "../types";
import {
  IconAmmeter,
  IconBook,
  IconCells,
  IconChevronLeft,
  IconChevronRight,
  IconGraph,
  IconKey,
  IconLeads,
  IconLock,
  IconNotebook,
  IconResistanceBox,
  IconRule,
  IconSteps,
  IconVoltmeter,
  IconWire,
  MarkCross,
  MarkTick,
} from "./icons";
import PracticalMenu from "./PracticalMenu";
import { useSlider } from "./useLayout";

export type StepStatus = "todo" | "done" | "lost";

interface StepBarProps {
  steps: Step[];
  stepIndex: number;
  stepStatus: StepStatus[];
  onStepChange(index: number): void;
  /** The practical's name, for the selector at the strip's left. */
  title: string;
  /** Step.key to the URL of its picture. A step with none shows its ink-outline part icon. */
  thumbs?: Readonly<Record<string, string>> | undefined;
  /** Cards from this index on are locked: shown, but not selectable yet. */
  lockedFrom?: number | undefined;
  /** The cards are display only: she goes through the stages in order, not by tapping them. */
  readOnly?: boolean | undefined;
  /** Watch: plays the demonstration again from the start; the practical menu lists it. */
  onRestart?: (() => void) | undefined;
}

const STATUS_WORD: Record<StepStatus, string> = {
  todo: "not done yet",
  done: "done",
  lost: "lost",
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The ink icon a step card shows: the part that step uses, by step key then by its first callout. */
export type StepIconId =
  | "cells"
  | "key"
  | "ammeter"
  | "voltmeter"
  | "box"
  | "wire"
  | "leads"
  | "graph"
  | "rule"
  | "book"
  | "notebook"
  | "steps";

const PART_ICON: Partial<Record<PartId, StepIconId>> = {
  cells: "cells",
  key: "key",
  ammeter: "ammeter",
  voltmeter: "voltmeter",
  box: "box",
  wire: "wire",
  leads: "leads",
};

const KEY_ICON: Record<string, StepIconId> = {
  "measure-xy": "wire",
  connect: "leads",
  plot: "graph",
  slope: "graph",
  precautions: "notebook",
  law: "book",
  length: "rule",
};

export function stepIconId(step: Step): StepIconId {
  const part = step.callouts?.[0]?.part;
  return KEY_ICON[step.key] ?? (part ? PART_ICON[part] : undefined) ?? "steps";
}

const STEP_ICONS: Record<StepIconId, ComponentType> = {
  cells: IconCells,
  key: IconKey,
  ammeter: IconAmmeter,
  voltmeter: IconVoltmeter,
  box: IconResistanceBox,
  wire: IconWire,
  leads: IconLeads,
  graph: IconGraph,
  rule: IconRule,
  book: IconBook,
  notebook: IconNotebook,
  steps: IconSteps,
};

/**
 * The step strip along the foot: the practical selector on a raised tab, then one card per
 * stage (a picture or a numbered ink ring, and the stage's name), a cursor in the accent that
 * slides to the current card, and previous and next buttons. The row scrolls sideways and keeps
 * the current card in view.
 *
 * State is never colour alone: done carries a ✓ and lost a ✕ (a disc each), locked a padlock and
 * muted words, a ring that is not done yet is dashed pencil and a done one solid ink.
 *
 * It is a toolbar with a roving tab stop. Left/Right/Home/End only move focus; Enter or Space
 * selects the step. (Selecting runs a camera move and the step's reveal, so arrowing across the
 * bar must not do that.) Cards that cannot be selected stay focusable and say so (`aria-disabled`).
 */
export default function StepBar({
  steps,
  stepIndex,
  stepStatus,
  onStepChange,
  title,
  thumbs,
  lockedFrom,
  readOnly,
  onRestart,
}: StepBarProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(stepIndex);

  useSlider(scroller, cursor, '.sh-step[aria-current="step"]', `${stepIndex}|${steps.length}`);

  // Keep the current step in view (the row scrolls sideways) and put the tab stop back on it
  // whenever the step changes.
  useEffect(() => {
    setFocusIndex(stepIndex);
    const box = scroller.current;
    const el = buttons.current[stepIndex];
    if (!box || !el) return;
    const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? "auto" : "smooth" });
  }, [stepIndex]);

  const move = (i: number) => {
    const next = Math.min(steps.length - 1, Math.max(0, i));
    setFocusIndex(next);
    buttons.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: focusIndex + 1,
      ArrowLeft: focusIndex - 1,
      Home: 0,
      End: steps.length - 1,
    };
    const target = keys[e.key];
    if (target === undefined) return;
    e.preventDefault();
    move(target);
  };

  const lockedAt = (i: number) => lockedFrom !== undefined && i >= lockedFrom;
  const canSelect = (i: number) => !readOnly && !lockedAt(i);
  const prevOk = stepIndex > 0 && canSelect(stepIndex - 1);
  const nextOk = stepIndex < steps.length - 1 && canSelect(stepIndex + 1);

  return (
    <nav className="sh-strip" data-region="strip" aria-label="Steps">
      <div className="sh-plate-body" aria-hidden="true" />
      <div className="sh-plate-tab">
        <PracticalMenu title={title} stageCount={steps.length} onRestart={onRestart} />
        <svg className="sh-ear" viewBox="0 0 74 26" aria-hidden="true" focusable="false">
          <path className="sh-ear-fill" d="M0 .75C30 .75 40 25.75 74 25.75V30H0z" />
          <path className="sh-ear-line" d="M0 .75C30 .75 40 25.75 74 25.75" />
        </svg>
      </div>

      <div className="sh-track">
        <div ref={scroller} className="sh-cards">
          <ol
            className="sh-steps"
            role="toolbar"
            aria-label="Lesson steps"
            aria-orientation="horizontal"
            onKeyDown={onKeyDown}
          >
            {steps.map((s, i) => {
              const status = stepStatus[i] ?? "todo";
              const current = i === stepIndex;
              const locked = lockedAt(i);
              const selectable = canSelect(i);
              const thumb = thumbs?.[s.key];
              const iconId = stepIconId(s);
              const StepIcon = STEP_ICONS[iconId];
              const word = locked ? "locked" : STATUS_WORD[status];
              return (
                <li
                  key={s.key}
                  className={`sh-step-item is-${status}${locked ? " is-locked" : ""}`}
                  role="presentation"
                >
                  <button
                    type="button"
                    ref={(el) => {
                      buttons.current[i] = el;
                    }}
                    className="sh-step"
                    data-status={status}
                    data-region={i === 0 ? "stageCard" : undefined}
                    aria-current={current ? "step" : undefined}
                    aria-disabled={selectable ? undefined : true}
                    aria-label={`Step ${i + 1}, ${s.title}, ${word}`}
                    tabIndex={i === focusIndex ? 0 : -1}
                    onFocus={() => setFocusIndex(i)}
                    onClick={() => {
                      if (selectable) onStepChange(i);
                    }}
                  >
                    <span className="sh-step-pic" data-step-icon={iconId} aria-hidden="true">
                      {thumb ? (
                        <img src={thumb} alt="" draggable={false} />
                      ) : (
                        <span className="sh-step-icon">
                          <StepIcon />
                        </span>
                      )}
                    </span>
                    <span className="sh-step-label sh-txt" aria-hidden="true">
                      <b>{i + 1}.</b>
                      <span>{s.title}</span>
                    </span>
                    {status === "done" && (
                      <span className="sh-step-mark is-done" aria-hidden="true">
                        <MarkTick />
                      </span>
                    )}
                    {status === "lost" && (
                      <span className="sh-step-mark is-lost" aria-hidden="true">
                        <MarkCross />
                      </span>
                    )}
                    {locked && (
                      <span className="sh-step-lock" aria-hidden="true">
                        <IconLock />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          <span ref={cursor} className="sh-cursor" aria-hidden="true">
            <IconChevronRight />
          </span>
        </div>
        <button
          type="button"
          className="sh-nav-btn"
          data-region="prev"
          aria-label="Previous stage"
          disabled={!prevOk}
          onClick={() => onStepChange(stepIndex - 1)}
        >
          <IconChevronLeft />
        </button>
        <button
          type="button"
          className="sh-nav-btn sh-nav-primary"
          data-region="next"
          aria-label="Next stage"
          disabled={!nextOk}
          onClick={() => onStepChange(stepIndex + 1)}
        >
          <IconChevronRight />
        </button>
      </div>
    </nav>
  );
}
