import { type CSSProperties, useEffect, useReducer, useRef } from "react";
import type { Director } from "../script/types";
import { ActGlyph, IconChevron, IconTick } from "./icons";
import "./player.css";
import { handleOf, humaniseStage, stageIndexOf, stagesOf } from "./stages";

// The stage's checklist, for the shell's guide (docs/plans/page-layout.md, "Guide"): the beats of
// the stage the director is on, as rows. A row has a mark (a green tick once it is done, an
// accent ring for the one she is on), a ring with a glyph for what the beat does, and the words
// she hears. The row she is on is highlighted and has a chevron, and its ring fills as the beat
// goes. Exam has no guide, so no checklist. It only talks to the director.

export interface StageChecklistProps {
  director: Director;
  /** Stage titles by Step.key ("measure-xy" gives "Measure XY"), for the list's name. */
  stageTitles?: Readonly<Record<string, string>>;
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function StageChecklist({ director, stageTitles }: StageChecklistProps) {
  const handle = handleOf(director);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const nowRow = useRef<HTMLLIElement>(null);
  const nowRing = useRef<HTMLSpanElement>(null);
  const s = director.state;
  const playing = s.playing;
  const beat = s.beat;
  const finished = s.finished;

  useEffect(() => director.subscribe(bump), [director]);

  // The ring on the current row fills as its beat goes: written straight onto the element each
  // frame while playing, never through React state. A new beat is a new ring, so it runs again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: beat and finished pick the current ring.
  useEffect(() => {
    if (!handle) return;
    const write = () => nowRing.current?.style.setProperty("--p", String(handle.beatProgress()));
    write();
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      write();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [handle, playing, beat, finished]);

  // A long stage keeps the row she is on in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: beat and finished are what moves the current row.
  useEffect(() => {
    nowRow.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }, [beat, finished]);

  if (!handle || s.mode === "exam") return null;
  const stages = stagesOf(handle.script);
  const stage = stages[stageIndexOf(stages, beat)];
  if (!stage) return null;
  const beats = handle.script.beats.slice(stage.first, stage.first + stage.count);
  const at = finished ? beats.length : Math.max(0, beat - stage.first);
  const title = stageTitles?.[stage.key] ?? humaniseStage(stage.key);

  return (
    <ol
      className="sc-list"
      aria-label={`Steps for ${title}`}
      style={{ "--i": Math.min(at, beats.length - 1) } as CSSProperties}
    >
      {beats.map((b, k) => {
        const i = stage.first + k;
        const done = i < beat || finished;
        const now = i === beat && !finished;
        return (
          <li
            key={b.id}
            ref={now ? nowRow : undefined}
            className={`sc-row${done ? " sc-done" : ""}${now ? " sc-now" : ""}`}
            aria-current={now ? "step" : undefined}
          >
            <span className="sc-mark" aria-hidden="true">
              {done ? <IconTick /> : null}
            </span>
            <span
              ref={now ? nowRing : undefined}
              className="sc-ico"
              style={{ "--p": done ? 1 : 0 } as CSSProperties}
              aria-hidden="true"
            >
              <svg className="sc-ring" viewBox="0 0 46 46" aria-hidden="true" focusable="false">
                <circle className="sc-ring-track" cx="23" cy="23" r="20.5" />
                <circle className="sc-ring-arc" cx="23" cy="23" r="20.5" pathLength="1" />
              </svg>
              <ActGlyph kind={b.act?.kind} />
            </span>
            <span className="sc-text">
              {done ? <span className="sc-sr">Done. </span> : null}
              {b.instruct}
            </span>
          </li>
        );
      })}
      <li className="sc-cursor" aria-hidden="true">
        <IconChevron />
      </li>
    </ol>
  );
}
