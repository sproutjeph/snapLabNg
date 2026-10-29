import { useEffect, useReducer, useRef, useState } from "react";
import type { DirectorHandle } from "../script/createDirector";
import type { Director } from "../script/types";
import {
  IconHand,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconSpeaker,
  IconSpeakerOff,
  IconSteps,
  IconTick,
} from "./icons";
import "./player.css";
import { humaniseStage, type StageInfo, stageIndexOf, stagesOf } from "./stages";

// The player: the on-screen controls and words of Watch, Practise and Exam
// (docs/plans/exam-redesign.md; target: docs/design/exam-redesign/watch-mode.webp). It is a DOM
// overlay for the page to lay over the canvas: a chip and the stage count at the top, the
// stage's checklist on the right, the caption and the player below. It only talks to the
// director; it never reads the bench.

export interface PlayerProps {
  director: Director;
  /** Stage titles by Step.key ("measure-xy" gives "Measure XY"). Without them the key is tidied up. */
  stageTitles?: Readonly<Record<string, string>>;
}

const SPEEDS = [1, 1.5, 2] as const;
const speedLabel = (s: number) => `${s}x`;

/** createDirector's handle carries the script and the voice; any other Director shows less. */
function handleOf(d: Director): DirectorHandle | null {
  return "script" in d && "voice" in d ? (d as DirectorHandle) : null;
}

const MODE_LABEL = { watch: "Watch", practice: "Practise", exam: "Exam" } as const;
const MODE_NOTE = {
  watch: "Demonstration bench. Your own bench will give different readings.",
  practice: "Your own bench. Do each action yourself; the voice will guide you.",
  exam: "Exam conditions: no guide.",
} as const;

function mmss(totalS: number): string {
  const m = Math.floor(totalS / 60);
  const s = Math.floor(totalS % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Elapsed time since the exam began, ticking each second. */
function useElapsed(running: boolean): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return s;
}

export function Player({ director, stageTitles }: PlayerProps) {
  const handle = handleOf(director);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [muted, setMuted] = useState(() => handle?.voice.muted ?? false);
  const fillRef = useRef<HTMLDivElement>(null);
  const s = director.state;
  const elapsed = useElapsed(s.mode === "exam");

  useEffect(() => director.subscribe(bump), [director]);

  const beats = handle?.script.beats ?? [];
  const stages = handle ? stagesOf(handle.script) : [];
  const stageIx = stageIndexOf(stages, s.beat);
  const stage: StageInfo | undefined = stages[stageIx];
  const titleOf = (key: string) => stageTitles?.[key] ?? humaniseStage(key);

  /** Progress through the stages, 0..1, drawn evenly like the design's eleven ticks. */
  const progress = () => {
    if (!stage || stages.length === 0) return 0;
    if (s.finished) return 1;
    const within = (s.beat - stage.first + (handle?.beatProgress() ?? 0)) / stage.count;
    return Math.min(1, (stageIx + within) / stages.length);
  };

  // The bar's fill follows the live state each frame while playing, outside React's renders.
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const playing = s.playing;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const el = fillRef.current;
      if (el) el.style.transform = `scaleX(${progressRef.current()})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggleMute = () => {
    if (!handle) return;
    handle.voice.muted = !handle.voice.muted;
    setMuted(handle.voice.muted);
  };
  const cycleSpeed = () => {
    const i = SPEEDS.indexOf(s.speed);
    director.setSpeed(SPEEDS[(i + 1) % SPEEDS.length] ?? 1);
  };
  const playPause = () => (s.playing ? director.pause() : director.play());
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (s.mode !== "watch" || (e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "ArrowRight") director.next();
    else if (e.key === "ArrowLeft") director.prev();
    else return;
    e.preventDefault();
  };

  const rootClass = `dp dp-${s.mode}`;
  const MuteIcon = muted ? IconSpeakerOff : IconSpeaker;
  const muteButton = handle ? (
    <button
      type="button"
      className="dp-btn dp-btn-icon"
      aria-pressed={muted}
      aria-label={muted ? "Unmute the voice and sounds" : "Mute the voice and sounds"}
      onClick={toggleMute}
    >
      <MuteIcon />
    </button>
  ) : null;

  // ---- Exam: a chip and the clock, nothing else ----
  if (s.mode === "exam") {
    return (
      <div className={rootClass}>
        <div className="dp-chip">
          <span className="dp-chip-mode">{MODE_LABEL.exam}</span>
          <span className="dp-chip-note">{MODE_NOTE.exam}</span>
        </div>
        <div className="dp-stage" role="timer" aria-label="Time used">
          {mmss(elapsed)}
        </div>
        <div className="dp-dock">
          <div className="dp-pill dp-pill-solo">{muteButton}</div>
        </div>
      </div>
    );
  }

  const stageBeats = stage ? beats.slice(stage.first, stage.first + stage.count) : [];
  const beatNow = beats[s.beat];
  const canShowMe = s.mode === "practice" && beatNow?.showMe === true && beatNow.act !== undefined;
  const atStart = !s.playing && s.beat === 0 && !s.finished;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: arrow keys step the demonstration while a control has focus
    <div className={rootClass} onKeyDown={onKeyDown}>
      <div className="dp-chip">
        <span className="dp-chip-mode">{MODE_LABEL[s.mode]}</span>
        <span className="dp-chip-note">{MODE_NOTE[s.mode]}</span>
      </div>

      {stages.length > 0 ? (
        <div className="dp-stage">
          Stage {stageIx + 1} of {stages.length}
        </div>
      ) : null}

      {stage ? (
        <>
          <aside className={`dp-panel${sheetOpen ? " dp-panel-open" : ""}`} aria-label="This stage">
            <h2 className="dp-panel-title">{titleOf(stage.key)}</h2>
            <ol className="dp-list">
              {stageBeats.map((b, k) => {
                const i = stage.first + k;
                const done = i < s.beat || s.finished;
                const now = i === s.beat && !s.finished;
                return (
                  <li
                    key={b.id}
                    className={`dp-item${done ? " dp-done" : ""}${now ? " dp-now" : ""}`}
                    aria-current={now ? "step" : undefined}
                  >
                    <span className="dp-mark" aria-hidden="true">
                      {done ? <IconTick /> : null}
                    </span>
                    <span className="dp-item-text">{b.instruct}</span>
                  </li>
                );
              })}
            </ol>
          </aside>
          <button
            type="button"
            className="dp-btn dp-steps"
            aria-expanded={sheetOpen}
            aria-label="Show this stage's steps"
            onClick={() => setSheetOpen((o) => !o)}
          >
            <IconSteps />
          </button>
        </>
      ) : null}

      <div className="dp-dock">
        {s.caption ? (
          <p className="dp-caption" aria-live="polite">
            {s.caption}
          </p>
        ) : null}

        <div className="dp-pill">
          {s.mode === "watch" ? (
            <>
              <button type="button" className="dp-btn" onClick={() => director.prev()}>
                <IconPrev />
                <span className="dp-label">Previous</span>
              </button>
              <button type="button" className="dp-btn dp-btn-main" onClick={playPause}>
                {s.playing ? <IconPause /> : <IconPlay />}
                <span className="dp-label">
                  {s.playing ? "Pause" : s.finished ? "Replay" : atStart ? "Start" : "Play"}
                </span>
              </button>
              <button type="button" className="dp-btn" onClick={() => director.next()}>
                <IconNext />
                <span className="dp-label">Next</span>
              </button>
              <button
                type="button"
                className="dp-btn dp-btn-speed"
                aria-label={`Speed ${speedLabel(s.speed)}; tap to change`}
                onClick={cycleSpeed}
              >
                {speedLabel(s.speed)}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="dp-btn dp-btn-main" onClick={playPause}>
                {s.playing ? <IconPause /> : <IconPlay />}
                <span className="dp-label">
                  {s.playing ? "Pause guide" : atStart ? "Start the guide" : "Resume guide"}
                </span>
              </button>
              <button
                type="button"
                className="dp-btn"
                disabled={!s.playing}
                onClick={() => {
                  handle?.voice.stop();
                  if (s.caption) handle?.voice.say(s.caption);
                }}
              >
                <IconRepeat />
                <span className="dp-label">Say it again</span>
              </button>
              {canShowMe ? (
                <button
                  type="button"
                  className="dp-btn dp-btn-accent"
                  disabled={!s.playing || s.hint === 3}
                  onClick={() => director.showMe()}
                >
                  <IconHand />
                  <span className="dp-label">Show me</span>
                </button>
              ) : null}
            </>
          )}
          {muteButton}
        </div>

        {stages.length > 0 && s.mode === "watch" ? (
          <div className="dp-track">
            <div className="dp-bar" aria-hidden="true">
              <div
                className="dp-fill"
                ref={fillRef}
                style={{ transform: `scaleX(${progress()})` }}
              />
            </div>
            <div className="dp-ticks">
              {stages.map((st, i) => (
                <button
                  type="button"
                  key={st.key}
                  className={`dp-tick${i <= stageIx ? " dp-tick-on" : ""}`}
                  aria-label={`Stage ${i + 1}: ${titleOf(st.key)}`}
                  aria-current={i === stageIx ? "step" : undefined}
                  onClick={() => director.seek(st.first)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
