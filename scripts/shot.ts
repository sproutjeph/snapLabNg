import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { TERMINAL_IDS } from "../packages/engine/src/index";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const route = arg("route") ?? "/";
const base = arg("base") ?? "http://localhost:5173";

type Terminals = Record<string, [number, number, number] | null>;

/**
 * The line `?kit=ohms-law&dump=1` logs: one JSON object, each of the twelve terminal ids (and no
 * other key) mapped to its world position [x, y, z] in metres, or null for a nut that is not
 * mounted. Any other console text gives null.
 */
function parseTerminalDump(text: string): Terminals | null {
  if (!text.startsWith("{")) return null;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const dump = v as Record<string, unknown>;
  const keys = Object.keys(dump);
  if (keys.length !== TERMINAL_IDS.length || !TERMINAL_IDS.every((id) => keys.includes(id))) {
    return null;
  }
  for (const at of Object.values(dump)) {
    if (at === null) continue;
    if (!Array.isArray(at) || at.length !== 3 || !at.every((n) => Number.isFinite(n))) return null;
  }
  return dump as Terminals;
}

// A route with dump=1 asks for the terminal dump: it is waited for, and reported missing if lost.
const asksForDump = new URL(route, "http://x").searchParams.get("dump") === "1";
const slug = (s: string) =>
  s
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
const name = arg("name") ?? (slug(route) || "home");
// --dpr 2: the device pixel ratio (deviceScaleFactor) of both viewports; 1 by default.
const dprArg = Number(arg("dpr") ?? "1");
const deviceScaleFactor = Number.isFinite(dprArg) && dprArg >= 1 && dprArg <= 4 ? dprArg : 1;
// The fps loop runs, and its number is printed, only at DPR 1: a DPR 2 or 3 frame in software GL
// is too slow for fps to mean anything.
const readFps = deviceScaleFactor === 1;
// Every shot, at every DPR, waits for the fonts and this many animation frames after the ready
// signal, so the 0.3 s ink-focus fade has ended and the wire board has repainted its labels once
// Barlow Condensed has loaded. Without it a DPR 2 or 3 shot is taken at frame 2.
const SETTLE_FRAMES = 30;

const allViewports = [
  { viewport: "phone", width: 390, height: 844 },
  { viewport: "laptop", width: 1440, height: 900 },
];
// --only phone|laptop: shoot just that viewport; both by default.
const only = arg("only");
if (process.argv.includes("--only") && only !== "phone" && only !== "laptop") {
  console.error(`--only must be phone or laptop, got ${only === undefined ? "nothing" : only}.`);
  process.exit(2);
}
const viewports = only ? allViewports.filter((vp) => vp.viewport === only) : allViewports;

mkdirSync(".shots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

let failed = false;

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor,
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const webglWarnings: string[] = [];
  const failedRequests: string[] = [];
  // The last terminal dump the page logged. It sits on an object because a console handler sets
  // it, which TypeScript's flow analysis does not follow.
  const dumped: { terminals: Terminals | null } = { terminals: null };

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") consoleErrors.push(text);
    if (text.includes("WebGL") || text.includes("GL_")) webglWarnings.push(text);
    dumped.terminals = parseTerminalDump(text) ?? dumped.terminals;
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("requestfailed", (req) =>
    failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ""}`),
  );

  let ready = false;
  let fps = 0;
  let canvasDpr: number | null = null;
  const file = `.shots/${name}-${vp.viewport}.png`;
  try {
    await page.goto(base + route);
    await page.waitForFunction(
      () => (window as { __SNAPLAB_READY__?: boolean }).__SNAPLAB_READY__ === true,
      undefined,
      {
        timeout: 15000,
      },
    );
    ready = true;
    await page.evaluate(async (frames) => {
      await document.fonts.ready;
      for (let i = 0; i < frames; i++) await new Promise((r) => requestAnimationFrame(r));
    }, SETTLE_FRAMES);
    // The dump is logged a few frames after the ready signal and the console event may still be on
    // its way: give it up to 5 s rather than print a shot that has lost it.
    for (let i = 0; asksForDump && i < 50 && dumped.terminals === null; i++) {
      await page.waitForTimeout(100);
    }
    if (readFps) {
      fps = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let n = 0;
            const start = performance.now();
            const tick = () => {
              n += 1;
              const elapsed = performance.now() - start;
              if (elapsed >= 2000) resolve((n * 1000) / elapsed);
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
      );
    }
  } catch (err) {
    consoleErrors.push(`shot: ${String(err)}`);
  }
  try {
    // The canvas's real pixel ratio at capture (backing width / CSS width), null without one.
    canvasDpr = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      return c && c.clientWidth > 0 ? Math.round((c.width / c.clientWidth) * 100) / 100 : null;
    });
    await page.screenshot({ path: file });
  } catch (err) {
    consoleErrors.push(`screenshot: ${String(err)}`);
  }
  if (!ready) failed = true;
  if (asksForDump && dumped.terminals === null) {
    consoleErrors.push("shot: dump=1 asked for the terminal dump, but the page logged none");
  }
  console.log(
    JSON.stringify({
      viewport: vp.viewport,
      file,
      ready,
      ...(readFps ? { fps: Math.round(fps * 10) / 10 } : {}),
      dpr: deviceScaleFactor,
      canvasDpr,
      consoleErrors,
      webglWarnings,
      failedRequests,
      ...(asksForDump || dumped.terminals ? { terminals: dumped.terminals } : {}),
    }),
  );
  await context.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
