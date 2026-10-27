# Examiner console (typed answers, captions, browser voice)

## Goal
After the red ink, an examiner asks her up to three short questions about **her own mistakes** (docs/04 §2 ⑥, docs/06 §5.5, docs/10 shot 1:50). She can answer by typing, or (later) by push-to-talk. The examiner's reply appears as a caption and is read aloud with the browser's own voice (there is no Meta TTS). For each answer it shows a verdict chip (correct / partly / needs work), a short reply and the model answer in clear formal English. Pidgin answers are welcome.

## Out of scope
- Calling any model, the WebSocket relay and voice capture: the lead builds `/api/examiner` and `/ws/examiner`. Here the console gets an `ask` function as a prop, and the preview uses a scripted mock.
- Marking: marks never change from the examiner's verdict.
- New dependencies.

## Files
All under `apps/web/src/examiner/`. Owner: **Gemini**, branch `gemini/examiner-console`, worktree `~/Desktop/SnapLabNG-gemini`.
- `types.ts`, exactly:
  ```ts
  export type AnswerLanguage = "english" | "pidgin" | "mixed";
  export type Verdict = "correct" | "partly" | "needs_work";
  export interface ExaminerQuestion { id: string; text: string; /** e.g. "PRECAUTIONS" – which of her mistakes it probes */ rule: string | null }
  export interface ExaminerReply { verdict: Verdict; reply: string; modelAnswer: string; next: ExaminerQuestion | null }
  export interface ExaminerConsoleProps {
    first: ExaminerQuestion;
    /** The lead wires this to the server; the console never calls a model itself. */
    ask(input: { question: ExaminerQuestion; answer: string; language: AnswerLanguage }, signal: AbortSignal): Promise<ExaminerReply>;
    maxTurns?: number; // default 3
    voice?: boolean;   // read examiner text aloud with speechSynthesis; default true
  }
  ```
- `speak.ts`: `speak(text, opts)` uses `window.speechSynthesis`. It prefers an `en-NG` voice, then `en-GB`, then any English voice, and is a no-op when speech synthesis is unavailable. `cancelSpeech()`. `pickVoice(voices: SpeechSynthesisVoice[])` is a pure, unit-tested function.
- `ExaminerConsole.tsx`, the default export. It shows the examiner's question as a caption bubble, labelled "Examiner (computer voice)" so it never pretends to be human.
  - An answer box (always visible) with a language toggle: English / Pidgin / Mixed.
  - "Send", disabled while waiting or when the box is empty.
  - The verdict chip, reply and "Model answer" (formal English) for each turn, then the next question until `maxTurns` or `next === null`. Ends with "That's all. Well done for practising."
  - A "Hold to speak" button, shown disabled with "coming soon". The lead wires it later.
  - Behaviour: keyboard first (Enter sends, Shift+Enter makes a new line); `aria-live="polite"` for new examiner text; aborts `ask` on unmount; a friendly retry message if `ask` rejects.
  - Reads aloud only after a user gesture (Send), never on load.
- `mockExaminer.ts`: a scripted `ask` for G1. It grounds three questions in docs/07 §6:
  1. the jockey she slid ("Why must you not slide the jockey along the wire?");
  2. the precaution tense;
  3. "Does a weakening cell change the balance point?".
  It gives a verdict from simple keyword checks (scratch / wear / uniform; past tense; no) and a model answer in formal English. It accepts Pidgin keywords too ("scratch am", "e go spoil"). The comments must say it's a stand-in for the real model.
- `ExaminerPreview.tsx`: a page for `?examiner=1` with the mock and a "Restart" button.
- `examiner.test.ts`.
- `apps/web/src/App.tsx`: add only a lazy `?examiner=1` switch, keeping all the others.

## Tests
- `pickVoice`: picks `en-NG` over `en-GB` over `en-US`, and returns null for no English voice.
- The mock: "E go scratch am, the wire no go dey uniform" gets "correct" or "partly" for the jockey question, not "needs_work". "I don't know" gets "needs_work". Its model answer is in English and mentions the wire being scratched or losing uniformity.
- It asks no more than `maxTurns` questions.

## Done-criteria
- `bun run typecheck`, `bun run lint`, `bun run test` and `bun run build` pass, after `bun install` following any merge of `main`. The console is lazy.
- On port 5174, `bun run shot -- --route "/?examiner=1" --base http://localhost:5174` renders on phone and laptop with no console errors. A headless run can answer all three questions by typing.
- Nothing claims the examiner is human or an official WAEC examiner. The label says "Examiner (computer voice)", and the heading is "Examiner-style questions".
- The PR body describes only what is in the branch, with counts checked, and has no AI attribution.

## Implementer
Gemini (fresh session). The lead adds `/api/examiner` (Spark turns that know her deductions) and later the voice relay.

## Risks
- Some phones have no English voice → captions are always shown, and voice is a bonus.
- Long model answers on phones → collapse the model answer behind "Show model answer" on narrow screens.
