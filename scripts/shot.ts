import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const route = arg("route") ?? "/";
const base = arg("base") ?? "http://localhost:5173";
const slug = (s: string) =>
  s
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
const name = arg("name") ?? (slug(route) || "home");

const viewports = [
  { viewport: "phone", width: 390, height: 844 },
  { viewport: "laptop", width: 1440, height: 900 },
];

mkdirSync(".shots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

let failed = false;

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const webglWarnings: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") consoleErrors.push(text);
    if (text.includes("WebGL") || text.includes("GL_")) webglWarnings.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("requestfailed", (req) =>
    failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ""}`),
  );

  let ready = false;
  let fps = 0;
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
  } catch (err) {
    consoleErrors.push(`shot: ${String(err)}`);
  }
  try {
    await page.screenshot({ path: file });
  } catch (err) {
    consoleErrors.push(`screenshot: ${String(err)}`);
  }
  if (!ready) failed = true;
  console.log(
    JSON.stringify({
      viewport: vp.viewport,
      file,
      ready,
      fps: Math.round(fps * 10) / 10,
      consoleErrors,
      webglWarnings,
      failedRequests,
    }),
  );
  await context.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
