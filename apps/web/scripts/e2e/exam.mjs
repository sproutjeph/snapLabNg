// Exam E2E (docs/plans/integration.md, slice I2): no callout-chip, hint or show-me is ever in
// the DOM, the elapsed timer is visible, and one hand-in lands on the results. A
// MutationObserver installed before the page's own scripts records any appearance of the
// three testids, so "never" is checked for the whole run, not only at the end.

import { check, run, snap, waitFor } from "./lib.mjs";

const FORBIDDEN = ["callout-chip", "hint", "show-me"];

await run(
  "exam",
  "/?practical=ohms-law&mode=exam&e2e=1&seed=7",
  async (page) => {
    check((await snap(page, "screen")) === "exam", "page did not open in Exam");

    const timer = page.locator('[role="timer"]');
    await timer.first().waitFor({ state: "visible", timeout: 15000 });
    const clockText = (await timer.first().innerText()).trim();
    check(/^\d+:\d{2}$/.test(clockText), `elapsed timer shows "${clockText}", expected m:ss`);

    // Give the page a few seconds in Exam, then hand in once.
    await page.waitForTimeout(3000);
    await snap(page, "handIn");
    await waitFor(
      "the results screen",
      async () => ((await snap(page, "screen")) === "results" ? true : null),
      { timeoutMs: 20000, intervalMs: 250 },
    );
    check(
      (await page.locator('[data-testid="results"]').count()) === 1,
      "results screen did not appear after hand-in",
    );

    const seen = await page.evaluate(() => window.__snaplabForbiddenSeen ?? []);
    check(seen.length === 0, `forbidden testids appeared in Exam: ${seen.join(", ")}`);
    for (const id of FORBIDDEN) {
      check(
        (await page.locator(`[data-testid="${id}"]`).count()) === 0,
        `${id} is in the DOM after hand-in`,
      );
    }
  },
  {
    initScript: () => {
      window.__snaplabForbiddenSeen = [];
      const start = () => {
        const scan = () => {
          for (const id of ["callout-chip", "hint", "show-me"]) {
            if (
              document.querySelector(`[data-testid="${id}"]`) &&
              !window.__snaplabForbiddenSeen.includes(id)
            ) {
              window.__snaplabForbiddenSeen.push(id);
            }
          }
        };
        new MutationObserver(scan).observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        scan();
      };
      if (document.documentElement) start();
      else document.addEventListener("DOMContentLoaded", start);
    },
  },
);
