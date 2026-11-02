import { createHash, randomUUID } from "node:crypto";
import { buildObjectPrompt, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import {
  type Box,
  type ModelLane,
  type QuestionEvent,
  QuestionRead,
  questionJsonSchema,
} from "@snaplab/contracts";
import type { Config } from "./env";
import { callResponses, eventsFromResponse, outputText, redactImages } from "./meta";
import { errorText, MODELS, strict, toPageBox } from "./snap";
import { costUsd, MAX_OUTPUT_TOKENS } from "./spend";

/** SAM takes at most 16 objects per request (dev.meta.ai/docs/sam/segmenting). */
const SAM_MAX_OBJECTS = 16;

export const QUESTION_PROMPT = [
  "The attached photo or photos show a printed WAEC/WASSCE practical question and/or its diagram (one page may hold both). Photos are in the order sent, numbered from 0.",
  "experiment: ohms_law_vi means V against I for a wire, with an ammeter, voltmeter, resistance box or rheostat, key and cells; also meter_bridge, titration, glass_block; anything else is unknown.",
  "source_as_printed and title_as_printed: copy the examination line and the heading exactly as printed, or null if none is printed.",
  "apparatus: every item the question lists, in the order it names them, with its exact words in text_as_printed.",
  "instructions: copy every numbered instruction word for word, with its printed label exactly as printed, including parts such as (b)(i).",
  "diagram: present is true only if a diagram is drawn; photo is the 0-based number of the photo the diagram is on; parts lists every drawn part with its printed letter label (E, K, A, V, R, X, Y ...) or null, and its box in 0 to 1 coordinates of that photo (x0, y0 top-left; x1, y1 bottom-right).",
  "Copy only what is printed. Never compute or invent values, answers or readings.",
].join(" ");

/** Pixel size of a JPEG from its first SOF marker, or null when the bytes are not a readable JPEG. */
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] ?? 0;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    const len = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = ((b[i + 5] ?? 0) << 8) | (b[i + 6] ?? 0);
      const width = ((b[i + 7] ?? 0) << 8) | (b[i + 8] ?? 0);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    i += 2 + len;
  }
  return null;
}

/**
 * Box prompts for the diagram's parts: Spark's 0–1 boxes in source pixels, ids 1…n, and the
 * index into `diagram.parts` each id stands for. Null when nothing usable.
 */
export function partBoxPrompt(
  parts: QuestionRead["diagram"]["parts"],
  width: number,
  height: number,
): { text: string; partIndex: number[] } | null {
  const objects: Array<{
    id: number;
    prompts: Array<{ box: { left: number; top: number; right: number; bottom: number } }>;
  }> = [];
  const partIndex: number[] = [];
  for (const [i, p] of parts.entries()) {
    if (objects.length >= SAM_MAX_OBJECTS) break;
    const left = Math.max(0, Math.floor(p.box.x0 * width));
    const top = Math.max(0, Math.floor(p.box.y0 * height));
    const right = Math.min(width, Math.ceil(p.box.x1 * width));
    const bottom = Math.min(height, Math.ceil(p.box.y1 * height));
    if (right - left < 2 || bottom - top < 2) continue;
    partIndex.push(i);
    objects.push({ id: partIndex.length, prompts: [{ box: { left, top, right, bottom } }] });
  }
  if (!objects.length) return null;
  return { text: buildObjectPrompt({ size: { width, height }, objects }), partIndex };
}

export interface QuestionResult {
  events: QuestionEvent[];
  costUsd: number;
}

/**
 * Snap your question (docs/plans/snap-question.md): Spark reads the paper into `practical_question`
 * (validated), then SAM refines each drawn part's box. Nothing here computes a value; a failed
 * read sends `error{read}` then `done`; a failed SAM call sends `error{sam}` and the stream goes on.
 */
export async function runQuestion(
  cfgIn: Config,
  photos: Uint8Array[],
  emit: (e: QuestionEvent) => void,
  signal: AbortSignal,
): Promise<QuestionResult> {
  // Replay and recording use the question's own fixture folder.
  const cfg: Config = {
    ...cfgIn,
    fixtureDir: cfgIn.questionFixtureDir,
    recordDir: cfgIn.questionFixtureDir,
  };
  const events: QuestionEvent[] = [];
  const send = (e: QuestionEvent) => {
    events.push(e);
    emit(e);
  };
  let spent = 0;
  const t0 = performance.now();
  const sinceStart = () => Math.round(performance.now() - t0);

  send({
    type: "accepted",
    request_id: randomUUID(),
    image_sha256: photos.map((p) => createHash("sha256").update(p).digest("hex")),
  });

  const images = photos.map((p) => ({
    type: "input_image",
    image_url: `data:image/jpeg;base64,${Buffer.from(p).toString("base64")}`,
  }));
  const timing = (
    id: string,
    lane: ModelLane,
    model: string,
    label: string,
    startMs: number,
    status: "ok" | "fallback" | "error",
    request: unknown,
    response: unknown,
    note: string | null,
  ) =>
    send({
      type: "timing",
      id,
      lane,
      model,
      label,
      start_ms: startMs,
      end_ms: sinceStart(),
      status,
      request: redactImages(request),
      response,
      note,
    });

  // --- Read the paper (Spark) --------------------------------------------------------
  const sparkBody = {
    model: MODELS.spark,
    reasoning: { effort: "low" },
    max_output_tokens: MAX_OUTPUT_TOKENS.spark,
    store: false,
    input: [{ role: "user", content: [{ type: "input_text", text: QUESTION_PROMPT }, ...images] }],
    text: {
      format: {
        type: "json_schema",
        name: "practical_question",
        schema: strict(questionJsonSchema),
        strict: true,
      },
    },
  };
  const sparkStart = sinceStart();
  let question: QuestionRead;
  try {
    const r = await callResponses(cfg, "spark-question", sparkBody, signal);
    spent += costUsd(MODELS.spark, r.response.usage);
    const parsed = QuestionRead.parse(JSON.parse(outputText(r.response)));
    // One photo means the diagram, if any, is on it.
    question =
      photos.length === 1 ? { ...parsed, diagram: { ...parsed.diagram, photo: 0 } } : parsed;
  } catch (e) {
    send({ type: "error", stage: "read", message: errorText(e), fallback: "app_question" });
    timing(
      "spark-question",
      "spark",
      MODELS.spark,
      "Read the question",
      sparkStart,
      "error",
      sparkBody,
      null,
      errorText(e),
    );
    send({ type: "done", total_ms: sinceStart() });
    return { events, costUsd: spent };
  }
  send({ type: "question", question });
  timing(
    "spark-question",
    "spark",
    MODELS.spark,
    "Read the question",
    sparkStart,
    "ok",
    sparkBody,
    question,
    null,
  );

  // --- Outline the drawn parts (SAM, box prompts) -------------------------------------
  const photoBytes = photos[question.diagram.photo] ?? photos[0];
  const image = images[question.diagram.photo] ?? images[0];
  // Fixtures mode replays for any bytes, so an unreadable size only has to be self-consistent.
  const size = (photoBytes && jpegSize(photoBytes)) ?? { width: 1000, height: 1000 };
  const prompt = question.diagram.present
    ? partBoxPrompt(question.diagram.parts, size.width, size.height)
    : null;
  if (prompt && image) {
    const samBody = {
      model: MODELS.sam,
      stream: true,
      metadata: { include_confidence: "true" },
      input: [{ role: "user", content: [{ type: "input_text", text: prompt.text }, image] }],
    };
    const label = `Outline: ${prompt.partIndex.length} drawn parts (box prompts)`;
    const start = sinceStart();
    try {
      const r = await callResponses(cfg, "sam-question", samBody, signal);
      spent += costUsd(MODELS.sam, r.response.usage ?? { images_processed: 1 });
      const source = r.events.length ? r.events : eventsFromResponse(r.response);
      const parsed = await parseImageStream(
        (async function* () {
          yield* source;
        })(),
      ).finalResult;
      const outlines: Array<{ part: number; box: Box; score: number | null }> = [];
      for (const b of recordsOfKind(parsed.records, "box")) {
        const part = prompt.partIndex[Number(b.objectId) - 1];
        if (part === undefined) continue;
        outlines.push({
          part,
          box: toPageBox(b, size.width, size.height),
          score: b.confidence ?? null,
        });
      }
      for (const o of outlines) send({ type: "part_outline", ...o });
      timing(
        "sam-question",
        "sam",
        MODELS.sam,
        label,
        start,
        outlines.length ? "ok" : "fallback",
        samBody,
        outlines,
        outlines.length ? null : "no detections; outlines stay on Spark's boxes",
      );
    } catch (e) {
      send({ type: "error", stage: "sam", message: errorText(e), fallback: "none" });
      timing("sam-question", "sam", MODELS.sam, label, start, "error", samBody, null, errorText(e));
    }
  }

  send({ type: "done", total_ms: sinceStart() });
  return { events, costUsd: spent };
}
