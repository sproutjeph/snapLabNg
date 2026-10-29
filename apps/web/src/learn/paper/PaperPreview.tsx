import { useEffect, useMemo, useRef, useState } from "react";
import type { PartId, PracticalMode } from "../types";
import { createVoice } from "../voice/createVoice";
import type { VoiceGuide } from "../voice/types";
import "./desk.css";
import "./paper.css";
import { OHMS_LAW_QUESTION } from "./ohmsLawQuestion";
import { QuestionPaper } from "./QuestionPaper";
import { toSpoken } from "./readAloud";

// ?paper=1: the question paper beside a stand-in for the bench, which only shows that each item is
// announced as the voice names it (the real stage lands the 3D parts).
//   &read=1   reads the question with a scripted voice that stops after "a resistance box", so the
//             shot shows the marker, the word and three items landed

const TAGS: Record<string, string> = {
  ammeter: "Ammeter",
  voltmeter: "Voltmeter",
  box: "Resistance box",
  leads: "Connecting wires",
  cells: "Dry cells",
  key: "Plug key",
  wire: "Wire XY",
};

/** A voice for the shot: it says the first instruction up to a word, then waits. */
function scriptedVoice(stopAfter: string): VoiceGuide {
  return {
    say(text, o) {
      const { from } = toSpoken(text);
      const cut = text.indexOf(stopAfter);
      if (cut < 0) return;
      const spoken = toSpoken(text).spoken;
      for (let i = 0; i < spoken.length; i++) {
        const at = from[i] ?? 0;
        if (at > cut) break;
        if (i === 0 || spoken[i - 1] === " ") o?.onWord?.(i);
      }
    },
    stop() {},
    speaking: true,
    muted: false,
    rate: 1,
  };
}

export default function PaperPreview() {
  const read = new URLSearchParams(location.search).get("read") === "1";
  const voice = useMemo(() => (read ? scriptedVoice("a resistance box") : createVoice()), [read]);
  const [landed, setLanded] = useState<PartId[]>([]);
  const [chosen, setChosen] = useState<PracticalMode | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (read) root.current?.querySelector<HTMLButtonElement>(".qp-read")?.click();
    const t = setTimeout(() => {
      window.__SNAPLAB_READY__ = true;
    }, 600);
    return () => clearTimeout(t);
  }, [read]);

  return (
    <div ref={root} className="xp xp-desk pp-page">
      <style>{`
        .pp-page { box-sizing: border-box; width: 100%; height: 100%; padding: 12px 16px 16px; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
        .pp-bench { display: none; }
        @media (min-width: 960px) {
          .pp-page { grid-template-columns: minmax(420px, 38fr) minmax(0, 62fr); padding: 16px 24px 24px; }
          .pp-bench { display: block; }
        }
        .pp-bench { position: relative; box-sizing: border-box; border: 1px solid var(--ink-2); border-radius: 12px; background: var(--card); padding: 18px; }
        .pp-slots { display: flex; flex-wrap: wrap; gap: 14px; margin: 20px 0 0; padding: 0; list-style: none; }
        .pp-slot { min-width: 150px; min-height: 64px; display: flex; align-items: center; justify-content: center; border: 1.5px dashed var(--pencil); border-radius: 8px; color: var(--muted); font-family: var(--f-cond); letter-spacing: .08em; text-transform: uppercase; font-size: 14px; }
        .pp-slot[data-in="1"] { border: 1.5px solid var(--ink); background: var(--paper); color: var(--ink); font-weight: 600; animation: pp-drop .6s cubic-bezier(.3,1.5,.5,1) both; }
        .pp-chosen { margin: 16px 0 0; font-family: var(--f-cond); letter-spacing: .08em; text-transform: uppercase; }
        @keyframes pp-drop { from { transform: translateY(-46px); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .pp-slot[data-in="1"] { animation: none; } }
      `}</style>
      <QuestionPaper
        question={OHMS_LAW_QUESTION}
        voice={voice}
        onItemRead={(p) => setLanded((l) => (l.includes(p) ? l : [...l, p]))}
        onChoose={setChosen}
      />
      <aside className="pp-bench" aria-label="Bench preview">
        <p className="xp-caps">Bench (preview only)</p>
        <ul className="pp-slots">
          {Object.entries(TAGS).map(([part, name]) => {
            const here = landed.includes(part as PartId);
            return (
              <li key={part} className="pp-slot" data-in={here ? "1" : undefined}>
                {here ? `✓ ${name}` : name}
              </li>
            );
          })}
        </ul>
        {chosen && <p className="pp-chosen">She chose: {chosen}</p>}
      </aside>
    </div>
  );
}
