import { useEffect, useReducer, useRef, useState } from "react";
import type { Director, DirectorSpeed } from "../script/types";
import { useLayout } from "../shell/useLayout";
import {
  IconHand,
  IconHandIn,
  IconPause,
  IconPlay,
  IconRepeat,
  IconRestart,
  IconSkipBack,
  IconSkipNext,
  IconSpeaker,
  IconSpeakerOff,
} from "./icons";
import "./player.css";
import { handleOf } from "./stages";

// The player: the on-screen controls and words of Watch, Practise and Exam, as a card on the
// stage (docs/plans/page-layout.md, "Player card" and "Caption"). The card sits in the top row
// left of the status card (centred on a phone); the caption is an ink pill centred in the free
// stage, just above the step strip. The stage's checklist, the count and the step strip belong to
// the shell (StageChecklist, StatusCard, StepBar). It is a DOM overlay for the shell's `overlay`
// slot, or for a page to lay over its canvas; it positions itself with the shell's own layout
// (shell/layout.ts). It only talks to the director; it never reads the bench.

export interface PlayerProps {
  director: Director;
  /** Stage titles by Step.key. The Player no longer shows them (the shell does); kept for callers. */
  stageTitles?: Readonly<Record<string, string>>;
  /** Practise and Exam: hand her notebook in for marking (the page shows the results). */
  onHandIn?: (() => void) | undefined;
}

/** The speeds the button cycles through (E2E runs may also set 4 and 8; the button then goes to 1). */
const SPEEDS: readonly DirectorSpeed[] = [1, 1.5, 2];
const speedLabel = (s: number) => `${s}x`;

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

export function Player({ director, onHandIn }: PlayerProps) {
  const handle = handleOf(director);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [muted, setMuted] = useState(() => handle?.voice.muted ?? false);
  const root = useRef<HTMLDivElement>(null);
  useLayout(root);
  const s = director.state;
  const elapsed = useElapsed(s.mode === "exam");

  useEffect(() => director.subscribe(bump), [director]);

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
      className="dp-btn dp-mute"
      aria-pressed={muted}
      aria-label={muted ? "Unmute the voice and sounds" : "Mute the voice and sounds"}
      onClick={toggleMute}
    >
      <MuteIcon />
    </button>
  ) : null;
  const handInButton =
    onHandIn && s.mode !== "watch" ? (
      <button
        type="button"
        className="dp-btn dp-btn-text dp-handin"
        data-testid="hand-in"
        onClick={onHandIn}
      >
        <IconHandIn />
        <span className="dp-label">Hand in</span>
      </button>
    ) : null;

  // ---- Exam: the clock, hand-in and the mute button, nothing else ----
  if (s.mode === "exam") {
    return (
      <div ref={root} className={rootClass}>
        <div className="dp-card" data-region="player">
          <div className="dp-clock" role="timer" aria-label="Time used">
            {mmss(elapsed)}
          </div>
          {handInButton}
          {muteButton}
        </div>
      </div>
    );
  }

  const beatNow = handle?.script.beats[s.beat];
  const canShowMe = s.mode === "practice" && beatNow?.showMe === true && beatNow.act !== undefined;
  const atStart = !s.playing && s.beat === 0 && !s.finished;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: arrow keys step the demonstration while a control has focus
    <div ref={root} className={rootClass} onKeyDown={onKeyDown}>
      <div className="dp-card" data-region="player">
        {s.mode === "watch" ? (
          <>
            {/* Restart, previous, play, next and the speed, then mute: the order the plan lists
                them in. Six 44 px targets are 264 px, wider than a phone's pill, so on a touch
                screen (and on a phone held upright) Restart is not in the card: the practical menu
                has it (player.css hides `dp-restart`; the page passes `onRestart` to the shell).
                It stays in the markup, so a laptop with a mouse keeps all six. */}
            <div className="dp-group">
              <button type="button" className="dp-btn dp-restart" onClick={() => director.seek(0)}>
                <IconRestart />
                <span className="dp-label">Restart</span>
              </button>
              <button type="button" className="dp-btn" onClick={() => director.prev()}>
                <IconSkipBack />
                <span className="dp-label">Previous</span>
              </button>
              <button type="button" className="dp-btn dp-btn-main" onClick={playPause}>
                {s.playing ? <IconPause /> : <IconPlay />}
                <span className="dp-label">
                  {s.playing ? "Pause" : s.finished ? "Replay" : atStart ? "Start" : "Play"}
                </span>
              </button>
              <button type="button" className="dp-btn" onClick={() => director.next()}>
                <IconSkipNext />
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
            </div>
            {muteButton ? (
              <>
                <span className="dp-divider" aria-hidden="true" />
                {muteButton}
              </>
            ) : null}
          </>
        ) : (
          <div className="dp-group">
            <button type="button" className="dp-btn dp-btn-main dp-btn-text" onClick={playPause}>
              {s.playing ? <IconPause /> : <IconPlay />}
              <span className="dp-label">
                {s.playing ? "Pause guide" : atStart ? "Start the guide" : "Resume guide"}
              </span>
            </button>
            <button
              type="button"
              className="dp-btn dp-btn-text dp-again"
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
                className="dp-btn dp-btn-accent dp-btn-text"
                data-testid="show-me"
                disabled={!s.playing || s.hint === 3}
                onClick={() => director.showMe()}
              >
                <IconHand />
                <span className="dp-label">Show me</span>
              </button>
            ) : null}
            {handInButton}
            {muteButton}
          </div>
        )}
      </div>

      <div className="dp-dock">
        {/* Always mounted, so a screen reader is already listening when the first words arrive. */}
        <p className="dp-caption" aria-live="polite" data-region="caption">
          {s.caption
            ? `${(s.beatIndex ?? s.beat) + 1}/${s.beatCount ?? 0} · ${s.caption}`
            : s.caption}
        </p>
      </div>
    </div>
  );
}
