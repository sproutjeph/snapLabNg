// Interaction proof for the wiring slice (not a Vitest test): drives ?wiring=1 in Chromium with
// real mouse taps on the nuts and leads, and checks what the bench controller did.
//   bun apps/web/src/learn/wiring/interact.ts --base http://localhost:5177
// Writes .shots/wiring-interact-*.png and exits non-zero if a check fails.
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

type Pt = [number, number] | null;
interface Hook {
  bench: {
    visual: {
      current: {
        pendingFrom: string | null;
        leads: { id: string; a: string; b: string }[];
        readout: { ammeterDeg: number; voltmeterDeg: number };
        keyClosed: boolean;
      };
    };
    comparison: { matches: boolean };
  };
  nut(id: string): Pt;
  leadMid(id: string): Pt;
  drawn(name: string): number;
}
type W = Window & { __SNAPLAB_WIRING__?: Hook; __SNAPLAB_READY__?: boolean };

const i = process.argv.indexOf("--base");
const base = i >= 0 ? process.argv[i + 1] : "http://localhost:5177";
const DIAGRAM: [string, string][] = [
  ["E+", "K1"],
  ["K2", "A+"],
  ["A-", "R1"],
  ["R2", "X"],
  ["Y", "E-"],
  ["V+", "X"],
  ["V-", "Y"],
];
/** Meter zero on the dial (METER_ZERO_DEG). */
const ZERO_DEG = -40;

const results: { check: string; ok: boolean; detail?: unknown }[] = [];
const check = (name: string, ok: boolean, detail?: unknown) =>
  results.push({ check: name, ok, detail });

async function state(page: Page) {
  return page.evaluate(() => {
    const h = (window as W).__SNAPLAB_WIRING__;
    if (!h) throw new Error("no hook");
    const v = h.bench.visual.current;
    return {
      pending: v.pendingFrom,
      leads: v.leads.map((l) => l.id),
      matches: h.bench.comparison.matches,
      ammeterDeg: v.readout.ammeterDeg,
      voltmeterDeg: v.readout.voltmeterDeg,
      dots: h.drawn("lead-flow-dots"),
      ghosts: h.drawn("ghost-leads"),
    };
  });
}

async function tapNut(page: Page, id: string) {
  const p = await page.evaluate((t) => (window as W).__SNAPLAB_WIRING__?.nut(t) ?? null, id);
  if (!p) throw new Error(`nut ${id} not on screen`);
  await page.mouse.click(p[0], p[1]);
  await page.waitForTimeout(60);
}

mkdirSync(".shots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${base}/?wiring=1`);
  await page.waitForFunction(() => (window as W).__SNAPLAB_READY__ === true, undefined, {
    timeout: 20000,
  });
  await page.waitForTimeout(300);

  let s = await state(page);
  check("starts with no leads and all seven ghosts", s.leads.length === 0 && s.ghosts > 0, s);

  await tapNut(page, "E+");
  s = await state(page);
  check("a tap on a nut starts a lead", s.pending === "E+", s.pending);
  await page.mouse.move(700, 700);
  await page.waitForTimeout(150);
  await page.screenshot({ path: ".shots/wiring-interact-rubber.png" });
  await tapNut(page, "E+");
  s = await state(page);
  check("a second tap on the same nut cancels it", s.pending === null, s.pending);

  await tapNut(page, "A+");
  await page.keyboard.press("Escape");
  s = await state(page);
  check("Escape cancels the pending lead", s.pending === null && s.leads.length === 0, s);

  // Phones have no Esc: a tap on bare desk (below the wire board) cancels too.
  await tapNut(page, "K1");
  await page.mouse.click(500, 790);
  await page.waitForTimeout(60);
  s = await state(page);
  check(
    "a tap on bare desk cancels the pending lead",
    s.pending === null && s.leads.length === 0,
    s,
  );

  for (const [a, b] of DIAGRAM) {
    await tapNut(page, a);
    await tapNut(page, b);
  }
  s = await state(page);
  check(
    "wiring the diagram by taps makes seven leads that match",
    s.leads.length === 7 && s.matches,
    s,
  );
  check("no ghosts once it matches", s.ghosts === 0, s.ghosts);
  check("no dots with the key open", s.dots === 0, s.dots);

  await page.getByRole("button", { name: "Close key K" }).click();
  await page.waitForTimeout(1800);
  s = await state(page);
  check(
    "closing K moves both needles up the scale",
    s.ammeterDeg > ZERO_DEG + 5 && s.voltmeterDeg > ZERO_DEG + 5,
    s,
  );
  check("dots run on the leads while current flows", s.dots > 0, s.dots);
  await page.screenshot({ path: ".shots/wiring-interact-closed.png" });

  // Tap the middle of the third lead (A− to R1) to remove it.
  const mid = await page.evaluate(() => {
    const h = (window as W).__SNAPLAB_WIRING__;
    const id = h?.bench.visual.current.leads[2]?.id ?? "";
    return h?.leadMid(id) ?? null;
  });
  if (mid) await page.mouse.click(mid[0], mid[1]);
  await page.waitForTimeout(800);
  s = await state(page);
  check("tapping a lead removes it and the loop opens", s.leads.length === 6 && !s.matches, s);
  check(
    "the open loop has no dots and the ammeter falls back",
    s.dots === 0 && s.ammeterDeg < ZERO_DEG + 3,
    s,
  );
  await page.screenshot({ path: ".shots/wiring-interact-removed.png" });

  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(100);
  s = await state(page);
  check("Undo puts the lead back", s.leads.length === 7 && s.matches, s);

  // A second lead in parallel with K2–A+ publishes its own curve (keyed by lead id).
  await tapNut(page, "K2");
  await tapNut(page, "A+");
  await page.waitForTimeout(150);
  const both = await page.evaluate(() => {
    const h = (window as W).__SNAPLAB_WIRING__;
    const ids = (h?.bench.visual.current.leads ?? [])
      .filter((l) => l.a === "K2" && l.b === "A+")
      .map((l) => l.id);
    return ids.map((id) => h?.leadMid(id) !== null);
  });
  check(
    "two parallel leads each have their own curve",
    both.length === 2 && both.every(Boolean),
    both,
  );
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(100);

  // X holds R2–X and V+–X; a third lead fills it, and a fourth tap there is ignored.
  await tapNut(page, "X");
  await tapNut(page, "A+");
  await tapNut(page, "X");
  s = await state(page);
  check("a full nut ignores the tap", s.leads.length === 8 && s.pending === null, s);

  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForTimeout(100);
  s = await state(page);
  check("Reset clears every lead", s.leads.length === 0, s);
} catch (e) {
  check("script ran", false, String(e));
}

check("no console errors", errors.length === 0, errors);
await browser.close();
for (const r of results)
  console.log(
    `${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok ? "" : `  ${JSON.stringify(r.detail)}`}`,
  );
process.exit(results.every((r) => r.ok) ? 0 : 1);
