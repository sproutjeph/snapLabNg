// Shared runner for the Ohm's law E2E scripts (docs/plans/integration.md, slice I2).
// Playwright Chromium, the same launch as scripts/shot.ts. Each script drives the live page
// through window.__snaplab (the e2e=1 hook in learn/e2e.ts) and the DOM data-testids, at phone
// 390x844 and laptop 1440x900. Run against `bun run dev`, never a preview build: the hook
// exists only in dev. Usage: bun apps/web/scripts/e2e/<script>.mjs [--base http://localhost:5173]
// [--only phone|laptop]. Exit code 1 with a one-line reason on failure; any console error fails.

import { chromium } from "playwright";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const base = (arg("base") ?? "http://localhost:5173").replace(/\/+$/, "");
const only = arg("only");
if (process.argv.includes("--only") && only !== "phone" && only !== "laptop") {
  console.error(`--only must be phone or laptop, got ${only === undefined ? "nothing" : only}.`);
  process.exit(2);
}

const ALL_VIEWPORTS = [
  { viewport: "phone", width: 390, height: 844 },
  { viewport: "laptop", width: 1440, height: 900 },
];
const viewports = only ? ALL_VIEWPORTS.filter((vp) => vp.viewport === only) : ALL_VIEWPORTS;

/** One failed check: the script stops this viewport with `message` as its reason. */
export function fail(message) {
  throw new Error(message);
}

export function check(cond, message) {
  if (!cond) fail(message);
}

/** Polls `fn` until it returns a truthy value, or fails after `timeoutMs`. */
export async function waitFor(what, fn, { timeoutMs = 30000, intervalMs = 200 } = {}) {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) fail(`timed out after ${timeoutMs} ms waiting for ${what}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Calls one window.__snaplab method on the page. */
export function snap(page, method, ...args) {
  return page.evaluate(
    ([m, a]) => {
      const hook = window.__snaplab;
      if (!hook) throw new Error("window.__snaplab is missing (is this a dev build with e2e=1?)");
      return hook[m](...a);
    },
    [method, args],
  );
}

/** Waits until the e2e hook is installed and answers. */
export async function waitHook(page) {
  await page.waitForFunction(() => typeof window.__snaplab?.screen === "function", undefined, {
    timeout: 60000,
  });
}

/**
 * Runs `fn(page, vp)` at each size against `route`, with a fresh browser context per size.
 * Console errors and page errors fail the size, as does anything `fn` throws. Prints one line
 * per size; the process exit code is 1 when any size failed.
 */
export async function run(name, route, fn, { initScript } = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  let failed = false;
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));
    try {
      if (initScript) await page.addInitScript(initScript);
      await page.goto(base + route, { timeout: 60000 });
      await waitHook(page);
      await fn(page, vp);
      if (errors.length > 0) fail(`console errors: ${errors.join(" | ").slice(0, 300)}`);
      console.log(`ok ${name} ${vp.viewport}`);
    } catch (err) {
      failed = true;
      const reason = String(err instanceof Error ? err.message : err)
        .replace(/\s+/g, " ")
        .trim();
      console.log(`FAIL ${name} ${vp.viewport}: ${reason.slice(0, 300)}`);
    } finally {
      await context.close();
    }
  }
  await browser.close();
  if (failed) process.exit(1);
}
