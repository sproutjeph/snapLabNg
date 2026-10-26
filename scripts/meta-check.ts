// Day-1 Meta API check (docs/12 §0, docs/06 §6): one live call per model on a
// test photo, timed, with every raw response saved under fixtures/spike/ so later
// work can run offline. Run from the repo root so Bun loads the server env:
//   bun scripts/meta-check.ts <photo.jpg>
// The key is read from MODEL_API_KEY and is never printed or written.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { blueprintJsonSchema, readingsJsonSchema } from "../packages/contracts/src/index";

const BASE = "https://api.meta.ai/v1";
const key = process.env.MODEL_API_KEY;
if (!key) {
  console.error("MODEL_API_KEY is not set in the server env (.env at the repo root).");
  process.exit(1);
}
const photoPath = process.argv[2] ?? "";
if (!photoPath) {
  console.error("usage: bun scripts/meta-check.ts <photo.jpg>");
  process.exit(1);
}
const photo = readFileSync(photoPath);
const dataUrl = `data:image/jpeg;base64,${photo.toString("base64")}`;
const outDir = join("fixtures", "spike", new Date().toISOString().slice(0, 10));
mkdirSync(outDir, { recursive: true });

/** Replaces the inline image with a size note, so fixtures stay small and hold no photo. */
function forRecord(body: unknown): unknown {
  return JSON.parse(
    JSON.stringify(body, (_k, v) =>
      typeof v === "string" && v.startsWith("data:")
        ? `[image ${Math.round(photo.length / 1024)} KB: ${basename(photoPath)}]`
        : v,
    ),
  );
}

/** The schema as Meta's strict mode wants it: the root `$schema` key removed. */
function strictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _drop, ...rest } = schema;
  return rest;
}

async function call(name: string, body: Record<string, unknown>) {
  const t0 = performance.now();
  let status = 0;
  let response: unknown = null;
  try {
    const res = await fetch(`${BASE}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    status = res.status;
    const text = await res.text();
    try {
      response = JSON.parse(text);
    } catch {
      response = text;
    }
  } catch (e) {
    response = { fetchError: String(e) };
  }
  const latencyMs = Math.round(performance.now() - t0);
  writeFileSync(
    join(outDir, `${name}.json`),
    `${JSON.stringify({ name, status, latencyMs, request: forRecord(body), response }, null, 2)}\n`,
  );
  return { name, status, latencyMs };
}

const image = { type: "input_image", image_url: dataUrl };
const results = await Promise.all([
  call("spark-hello", {
    model: "muse-spark-1.3",
    input: "Reply with the single word: ready",
    reasoning: { effort: "minimal" },
  }),
  call("spark-blueprint", {
    model: "muse-spark-1.3",
    reasoning: { effort: "low" },
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "This is a photo of a Nigerian student's WAEC physics practical notebook page. Identify the experiment, the apparatus drawn, and the values written. Copy every value exactly as written.",
          },
          image,
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "lab_blueprint",
        schema: strictSchema(blueprintJsonSchema as Record<string, unknown>),
        strict: true,
      },
    },
  }),
  call("wonder-readings", {
    model: "muse-wonder-1.0",
    reasoning: { effort: "medium" },
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Read the results table, graph and precautions on this WAEC practical page. Copy every number exactly as written (keep '57' as '57'). Boxes are 0–1 page coordinates.",
          },
          image,
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "page_readings",
        schema: strictSchema(readingsJsonSchema as Record<string, unknown>),
        strict: true,
      },
    },
  }),
  call("sam-table", {
    model: "sam-3.1",
    input: [{ role: "user", content: [{ type: "input_text", text: "table" }, image] }],
  }),
]);

console.table(results);
console.log(`Saved to ${outDir}`);
