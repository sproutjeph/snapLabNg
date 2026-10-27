# Live examiner in the flow (typed answers)

## Goal
After the red ink in `?flow=1`, the examiner console (#33) asks her up to three questions about **her own mistakes** and judges her typed answers with Muse Spark (docs/04 §2 ⑥, docs/06 §5.5, docs/07 §6). Voice capture and `/ws/examiner` come later; this slice is the typed path, which the voice path will reuse.

**The AI judges, the bank decides.** Which questions she gets, and the formal-English model answer for each, come from a fixed bank in `packages/rules`, picked from her MarkSheet. Spark only gives a verdict chip and a short reply in her register. The examiner never changes a mark.

## Out of scope
- Voice (mic worklet, `/ws/examiner`, Voice Transcribe). Titration and glass block questions.
- Examiner comments on each red-ink item (`POST /api/mark`).
- Examiner turns in golden recordings. In `golden-only` mode the endpoint answers 503 and the console shows its retry message.

## Files (owner: lead, branch `claude/examiner-live`)
- `packages/contracts/src/examiner.ts` (+ index, + json-schema):
  - `AnswerLanguage` = `"english" | "pidgin" | "mixed"`; `Verdict` = `"correct" | "partly" | "needs_work"`.
  - `ExaminerQuestion` = `{ id, text, rule: RuleCode | null, model_answer }`.
  - `ExaminerTurnRequest` (strict) = `{ question_id, answer (1–600 chars), language, her_mistake: string (≤300) | null }`.
  - `ExaminerJudgement` (strict, sent to Spark as `text.format`) = `{ verdict, reply (≤300 chars) }`.
  - `ExaminerTurnResponse` = `{ verdict, reply, model_answer }`.
- `packages/rules/src/examiner.ts`:
  - `METER_BRIDGE_QUESTIONS`, a fixed bank from docs/07 §6, each with a model answer in formal English and a cited source.
  - `examinerQuestions(sheet, max = 3)` (pure) puts questions about her lost items first:
    - a PRECAUTIONS item judged `penalised_action` (she slid the jockey) leads to the jockey question;
    - one judged `instruction` or `not_past_tense` leads to the tense question;
    - PHYS-1DP leads to the 1 d.p. question; PHYS-TABLE units lead to the units question; GRAPH-SLOPE leads to the triangle question;
    - then the general bank fills up in a fixed order.
  - It returns `{ question, her_mistake }[]`, where `her_mistake` is her own text for that item (or null).
  - `examinerQuestionById(id)`.
- `apps/api/src/examiner.ts`: `judgeAnswer(cfg, req, signal)`.
  - One Spark call: low effort, `max_output_tokens` 2000 (888 used on the first live turn), `store:false`, strict `examiner_judgement` schema.
  - The prompt holds the bank question, the bank model answer, her mistake and her answer (marked as data, not instructions). It says to read Nigerian English and Pidgin charitably, and to reply in her chosen register.
  - The output is validated with zod and the reply trimmed. `model_answer` is always the bank's.
  - Fixture name: `spark-examiner-<question id>`, one per bank question.
- `apps/api/src/app.ts`: `POST /api/examiner`.
  - The body is JSON (≤ 4 KB) and is validated before anything else (400). An unknown question id gets 400. A per-IP limit of 30 turns per hour gets 429.
  - `golden-only` mode gets 503.
  - Live mode reserves `EXAMINER_RESERVE_USD` (Spark at 2,000 in and 2,000 out ≈ $0.011) and settles to the actual cost, or the reserve on failure.
  - The timeout is 20 s, plus an abort on client disconnect. If Meta fails: 502 `{ error }`.
- `apps/api/src/spend.ts`: `MAX_OUTPUT_TOKENS.examiner`, `EXAMINER_RESERVE_USD`. `apps/api/src/env.ts`: `examinerTurnsPerHourPerIp` (default 30).
- `apps/web/src/examiner/examinerClient.ts` (+ test): `makeAsk(list)` returns the console's `ask`. It POSTs `/api/examiner` with the signal and takes the next question from `list`.
- `apps/web/src/pipeline/FlowPage.tsx`: once `marked` exists, show "Examiner-style questions" below the red ink, as a lazy `ExaminerConsole` with `first` = the first picked question.
- `fixtures/recorded/2026-10-27-examiner/spark-examiner-<question id>.json`: one live recording per bank question (text only, made-up answers, no student data; 11 turns ≈ $0.05).
- `AGENTS.md`: the ownership table (examiner back to the lead), plus the next slices.

## Tests
- rules:
  - On G1, the first question is the jockey question with her own sentence as `her_mistake` (docs/11: G1 says she slid the jockey).
  - On G2 (nothing lost on precautions), there are three general bank questions.
  - On the real note 1 page 1, the first question is the units one (it lost `PHYS-TABLE:units-X`).
  - At most `max` questions are returned, with no repeats.
  - Every bank entry has a model answer and a source.
- api (fixtures):
  - a valid turn returns the verdict and reply from the fixture and the bank's model answer;
  - a bad body or an unknown id gets 400;
  - the 31st turn from one IP gets 429;
  - `golden-only` gets 503;
  - a capped ledger gets 402 and no call.
- contracts: the recorded fixture's output parses as `ExaminerJudgement`.

## Done-criteria
- The four checks pass. A science-verifier pass on the bank texts. A code review.
- `MODE=fixtures`, `?flow=1&golden=note1`: the red ink appears, then the examiner asks the units question, a typed answer gets a verdict, and the model answer comes from the bank. Shots on phone and laptop.
- Nothing claims a human or an official WAEC examiner.

## Implementer
Lead (contracts, rules, API and wiring are lead paths).
