// Turns a recorded /api/snap stream (the SSE text saved by curl) into a golden replay:
//   bun scripts/golden-from-stream.ts <stream.txt> <page.jpg> <id> "<title>"
// Writes apps/web/public/golden/<id>.json and <id>.jpg, served at /golden/ by Vite.
// Arrival times are rebuilt from the server's own timing events: a stage's events arrive
// together just before its `timing` (snap.ts), so each takes that timing's end_ms.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoldenRecording, SnapEvent } from "../packages/contracts/src/index";

const [streamPath, pagePath, id, title] = process.argv.slice(2);
if (!streamPath || !pagePath || !id || !title) {
  console.error('usage: bun scripts/golden-from-stream.ts <stream.txt> <page.jpg> <id> "<title>"');
  process.exit(1);
}

const events = readFileSync(streamPath, "utf8")
  .split(/\n\n/)
  .map((block) => block.split("\n").find((l) => l.startsWith("data: ")))
  .filter((l): l is string => l !== undefined)
  .map((l) => SnapEvent.parse(JSON.parse(l.slice(6))));

const timed: Array<{ at_ms: number; event: SnapEvent }> = [];
let last = 0;
for (let i = 0; i < events.length; i++) {
  const e = events[i] as SnapEvent;
  let at: number;
  if (e.type === "accepted") at = 0;
  else if (e.type === "timing") at = e.end_ms;
  else if (e.type === "done") at = e.total_ms;
  else {
    const next = events.slice(i + 1).find((x) => x.type === "timing" || x.type === "done");
    at = next?.type === "timing" ? next.end_ms : next?.type === "done" ? next.total_ms : last;
  }
  last = Math.max(last, at);
  timed.push({ at_ms: last, event: e });
}

// The page size comes from the JPEG header (SOF0/SOF2 marker).
const jpg = readFileSync(pagePath);
let width = 0;
let height = 0;
for (let i = 2; i < jpg.length - 9; ) {
  if (jpg[i] !== 0xff) break;
  const marker = jpg[i + 1] ?? 0;
  const len = jpg.readUInt16BE(i + 2);
  if (marker === 0xc0 || marker === 0xc2) {
    height = jpg.readUInt16BE(i + 5);
    width = jpg.readUInt16BE(i + 7);
    break;
  }
  i += 2 + len;
}

const rec = GoldenRecording.parse({
  version: 1,
  id,
  title,
  page: { file: `${id}.jpg`, width, height },
  events: timed,
});
const out = join("apps", "web", "public", "golden");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `${id}.json`), `${JSON.stringify(rec)}\n`);
copyFileSync(pagePath, join(out, `${id}.jpg`));
console.log(`golden ${id}: ${timed.length} events over ${last} ms, page ${width}×${height}`);
