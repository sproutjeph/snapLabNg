import { createHash, randomUUID } from "node:crypto";
import { buildObjectPrompt, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import {
  type Blueprint,
  BlueprintSchema,
  type Box,
  blueprintJsonSchema,
  type ModelLane,
  type Readings,
  ReadingsSchema,
  readingsJsonSchema,
  type SnapEvent,
} from "@snaplab/contracts";
import type { Config } from "./env";
import { callResponses, eventsFromResponse, outputText, redactImages } from "./meta";
import { costUsd, MAX_OUTPUT_TOKENS } from "./spend";

export const MODELS = {
  spark: "muse-spark-1.3",
  wonder: "muse-wonder-1.0",
  sam: "sam-3.1",
} as const;

/** One noun phrase per SAM request (docs/06 §5.2, Plan A). */
export const SAM_PHRASES: Record<string, string[]> = {
  meter_bridge: ["table", "graph"],
};

/** SAM takes at most 16 objects per request (dev.meta.ai/docs/sam/segmenting). */
const SAM_MAX_OBJECTS = 16;

/**
 * Box prompts for the drawn parts the blueprint found: Spark's 0–1 boxes in source
 * pixels, ids 1…n, and the component name each id stands for. Null when nothing usable.
 */
export function componentBoxPrompt(
  components: Blueprint["components"],
  width: number,
  height: number,
): { text: string; names: string[] } | null {
  const objects: Array<{
    id: number;
    prompts: Array<{ box: { left: number; top: number; right: number; bottom: number } }>;
  }> = [];
  const names: string[] = [];
  for (const c of components) {
    if (objects.length >= SAM_MAX_OBJECTS) break;
    const left = Math.max(0, Math.floor(c.approx_box.x0 * width));
    const top = Math.max(0, Math.floor(c.approx_box.y0 * height));
    const right = Math.min(width, Math.ceil(c.approx_box.x1 * width));
    const bottom = Math.min(height, Math.ceil(c.approx_box.y1 * height));
    if (right - left < 2 || bottom - top < 2) continue;
    names.push(c.kind);
    objects.push({ id: names.length, prompts: [{ box: { left, top, right, bottom } }] });
  }
  if (!objects.length) return null;
  return { text: buildObjectPrompt({ size: { width, height }, objects }), names };
}

export interface SnapInput {
  photo: Uint8Array;
  /** Pixel size of the uploaded (flattened, header-blurred) page. */
  width: number;
  height: number;
  /** The experiment the student picked, if any; picks SAM's phrases. */
  hint: "meter_bridge" | null;
}

export interface SnapResult {
  events: SnapEvent[];
  costUsd: number;
}

const BLUEPRINT_PROMPT =
  "This is a photo of a Nigerian student's WAEC science practical notebook page. Identify the experiment, the apparatus drawn and the values written. Copy every value exactly as written. Use Nigerian naming (e.g. trioxocarbonate(IV)). Boxes are 0–1 page coordinates. Leave notes empty.";
// Tightened after the Oct 27 live read of a real notebook: Wonder gave every cell of a
// column the same box, left rows unnumbered and invented a graph for a page without one.
const READINGS_PROMPT = [
  "Read the results table, graph and precautions on this WAEC practical page.",
  "Copy every number exactly as written: keep '57' as '57', '24.5' as '24.5', and a raised decimal point '33·30' exactly as '33·30'.",
  "row: the row's S/N or number as written ('1', '2', …); if none is written, number the rows from 1 in order. Use 'header' for the heading row.",
  "box: a tight 0–1 page box around that one number only, never the whole column.",
  "If the table has columns that are not in the column list, use 'other' and keep the heading in column_header_as_written.",
  "graph: null unless a graph is actually drawn on this page; never invent points, labels or a triangle.",
  "average_as_written: her mean or average line (e.g. 'Mean X = 4·00 ohms') if one is written.",
  "Precautions word for word; an empty list if none are written.",
].join(" ");

function strict(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _drop, ...rest } = schema;
  return rest;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** SAM boxes are half-open source pixels; the page is 0–1. The one place they convert. */
export function toPageBox(
  b: { left: number; top: number; right: number; bottom: number },
  width: number,
  height: number,
): Box {
  const c = (v: number) => Math.min(1, Math.max(0, v));
  return {
    x0: c(b.left / width),
    y0: c(b.top / height),
    x1: c(b.right / width),
    y1: c(b.bottom / height),
  };
}

/** Physical clamps (docs/04 §2 ③): implausible numbers lose their parsed value; the text stays. */
export function clampReadings(r: Readings): Readings {
  const ranges: Partial<Record<string, [number, number]>> = {
    l: [0, 100],
    R: [0, 10_000],
    R_inv: [0, 1_000],
    l_inv: [0, 10],
  };
  return {
    ...r,
    cells: r.cells.map((cell) => {
      const range = ranges[cell.column];
      if (!range || cell.value === null) return cell;
      return cell.value < range[0] || cell.value > range[1] ? { ...cell, value: null } : cell;
    }),
  };
}

const IDENTITY = /\b(name|school|candidate|index\s*(no|number)|class|identity)\b/i;

/**
 * Second guard for minors' privacy (the first is the client blurring the header band):
 * drop any extra mark that reads like the NAME/SCHOOL header, e.g. Wonder's
 * "Identity header" on Oct 26.
 */
export function scrubIdentity(r: Readings): Readings {
  return {
    ...r,
    other_marks: r.other_marks.filter(
      (m) => !IDENTITY.test(m.description) && !IDENTITY.test(m.text_as_written ?? ""),
    ),
  };
}

/**
 * Stage ② of docs/04 §2: Spark (blueprint), Wonder (readings) and SAM (outlines) start
 * together. Each answer is validated against packages/contracts before anything reaches
 * the client. Events follow docs/04 §4.3: nothing after `accepted` is sent until `mode`
 * (or the blueprint's error) is out, a failed stage sends `error` and the rest go on,
 * and `done` is last.
 */
export async function runSnap(
  cfg: Config,
  input: SnapInput,
  emit: (e: SnapEvent) => void,
  signal: AbortSignal,
): Promise<SnapResult> {
  const events: SnapEvent[] = [];
  const send = (e: SnapEvent) => {
    events.push(e);
    emit(e);
  };
  let spent = 0;
  const t0 = performance.now();
  const sinceStart = () => Math.round(performance.now() - t0);

  const sha = createHash("sha256").update(input.photo).digest("hex");
  send({ type: "accepted", request_id: randomUUID(), image_sha256: sha });

  const image = {
    type: "input_image",
    image_url: `data:image/jpeg;base64,${Buffer.from(input.photo).toString("base64")}`,
  };
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

  // --- Blueprint (Spark) -------------------------------------------------------------
  const blueprintBody = {
    model: MODELS.spark,
    reasoning: { effort: "low" },
    max_output_tokens: MAX_OUTPUT_TOKENS.spark,
    store: false,
    input: [{ role: "user", content: [{ type: "input_text", text: BLUEPRINT_PROMPT }, image] }],
    text: {
      format: {
        type: "json_schema",
        name: "lab_blueprint",
        schema: strict(blueprintJsonSchema),
        strict: true,
      },
    },
  };
  let blueprint: Blueprint | null = null;
  const blueprintDone = (async () => {
    const start = sinceStart();
    try {
      const r = await callResponses(cfg, "spark-blueprint", blueprintBody, signal);
      spent += costUsd(MODELS.spark, r.response.usage);
      const parsed = BlueprintSchema.parse(JSON.parse(outputText(r.response)));
      blueprint = { ...parsed, notes: "" }; // notes can echo the NAME/SCHOOL header
      send({ type: "mode", experiment: blueprint.experiment, confidence: blueprint.confidence });
      for (const component of blueprint.components) send({ type: "component", component });
      send({ type: "values", values: blueprint.values });
      send({ type: "setup_issues", setup_issues: blueprint.setup_issues });
      timing(
        "spark-blueprint",
        "spark",
        MODELS.spark,
        "Blueprint compile",
        start,
        "ok",
        blueprintBody,
        blueprint,
        null,
      );
    } catch (e) {
      send({ type: "error", stage: "blueprint", message: errorText(e), fallback: "golden" });
      timing(
        "spark-blueprint",
        "spark",
        MODELS.spark,
        "Blueprint compile",
        start,
        "error",
        blueprintBody,
        null,
        errorText(e),
      );
    }
  })();

  // --- Readings (Wonder) -------------------------------------------------------------
  const readingsBody = {
    model: MODELS.wonder,
    reasoning: { effort: "medium" },
    max_output_tokens: MAX_OUTPUT_TOKENS.wonder,
    store: false,
    input: [{ role: "user", content: [{ type: "input_text", text: READINGS_PROMPT }, image] }],
    text: {
      format: {
        type: "json_schema",
        name: "page_readings",
        schema: strict(readingsJsonSchema),
        strict: true,
      },
    },
  };
  const readingsDone = (async () => {
    const start = sinceStart();
    try {
      const r = await callResponses(cfg, "wonder-readings", readingsBody, signal);
      spent += costUsd(MODELS.wonder, r.response.usage);
      const readings = scrubIdentity(
        clampReadings(ReadingsSchema.parse(JSON.parse(outputText(r.response)))),
      );
      await blueprintDone;
      send({ type: "readings", readings });
      timing(
        "wonder-readings",
        "wonder",
        MODELS.wonder,
        "Page readings",
        start,
        "ok",
        readingsBody,
        readings,
        null,
      );
    } catch (e) {
      await blueprintDone;
      send({ type: "error", stage: "readings", message: errorText(e), fallback: "retry_later" });
      timing(
        "wonder-readings",
        "wonder",
        MODELS.wonder,
        "Page readings",
        start,
        "error",
        readingsBody,
        null,
        errorText(e),
      );
    }
  })();

  // --- Outlines (SAM) ------------------------------------------------------------------
  // Text prompts find printed-like things (the table worked on a real page, Oct 27) but
  // nothing in hand-drawn apparatus, so the drawn parts use docs/06 §5.2 Plan B: once
  // the blueprint is in, Spark's boxes go to SAM as box prompts in one request.
  const runSam = async (
    name: string,
    label: string,
    body: Record<string, unknown>,
    phraseOf: (objectId: string) => string | null,
  ) => {
    const start = sinceStart();
    try {
      const r = await callResponses(cfg, name, body, signal);
      spent += costUsd(MODELS.sam, r.response.usage ?? { images_processed: 1 });
      const source = r.events.length ? r.events : eventsFromResponse(r.response);
      const parsed = await parseImageStream(
        (async function* () {
          yield* source;
        })(),
      ).finalResult;
      const boxes = recordsOfKind(parsed.records, "box").flatMap((b) => {
        const phrase = phraseOf(b.objectId);
        return phrase
          ? [{ phrase, box: toPageBox(b, input.width, input.height), score: b.confidence ?? null }]
          : [];
      });
      await blueprintDone;
      for (const b of boxes) send({ type: "sam_box", ...b });
      timing(
        name,
        "sam",
        MODELS.sam,
        label,
        start,
        boxes.length ? "ok" : "fallback",
        body,
        boxes,
        boxes.length ? null : "no detections; outline from the blueprint's box",
      );
    } catch (e) {
      await blueprintDone;
      timing(
        name,
        "sam",
        MODELS.sam,
        label,
        start,
        "fallback",
        body,
        null,
        `${errorText(e)}; outline from the blueprint's box`,
      );
    }
  };

  const textSam = (SAM_PHRASES[input.hint ?? "meter_bridge"] ?? []).map((phrase) =>
    runSam(
      `sam-${slug(phrase)}`,
      `Outline: ${phrase}`,
      {
        model: MODELS.sam,
        stream: true,
        metadata: { include_confidence: "true" },
        input: [{ role: "user", content: [{ type: "input_text", text: phrase }, image] }],
      },
      () => phrase,
    ),
  );

  const boxSam = (async () => {
    await blueprintDone;
    // Assigned inside the blueprint stage; TypeScript can't see that across the closure.
    const bp = blueprint as Blueprint | null;
    const prompt = bp ? componentBoxPrompt(bp.components, input.width, input.height) : null;
    if (!prompt) return;
    await runSam(
      "sam-components",
      `Outline: ${prompt.names.length} drawn parts (box prompts)`,
      {
        model: MODELS.sam,
        stream: true,
        metadata: { include_confidence: "true" },
        input: [{ role: "user", content: [{ type: "input_text", text: prompt.text }, image] }],
      },
      (id) => prompt.names[Number(id) - 1] ?? null,
    );
  })();

  const samDone = Promise.all([...textSam, boxSam]);

  await Promise.all([blueprintDone, readingsDone, samDone]);
  send({ type: "done", total_ms: sinceStart() });
  return { events, costUsd: spent };
}

/** A short, safe message for the client: never model text, never server paths. */
function errorText(e: unknown): string {
  if (!(e instanceof Error)) return "the stage failed";
  if (e.name === "ZodError") return "the model's answer failed validation";
  if (e.name === "SyntaxError") return "the model's answer was not valid JSON";
  if (e.name === "AbortError" || e.name === "TimeoutError") return "timed out or cancelled";
  if ((e as { code?: string }).code === "ENOENT") return "no recorded answer for this stage";
  if (e.message.startsWith("Meta ")) return e.message; // "Meta <stage> failed with HTTP <status>"
  return "the stage failed";
}
