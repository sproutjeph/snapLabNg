// Watch E2E (docs/plans/integration.md, slice I2): the demonstration plays to the end at
// speed 8 (about 3 minutes), a callout chip appears during the lead beats, and the demo mark
// sheet shows total === max - 1. The one lost mark is PHYS-CALC's final answer, by design:
// the demo stops the length working before the answer (script.test.ts enforces it).

import { check, run, snap, waitFor } from "./lib.mjs";

await run("watch", "/?practical=ohms-law&mode=watch&e2e=1&speed=8&seed=7", async (page) => {
  check((await snap(page, "screen")) === "watch", "page did not open in Watch");
  await snap(page, "play");

  let chipSeen = false;
  await waitFor(
    "the demonstration to finish",
    async () => {
      if ((await page.locator('[data-testid="callout-chip"]').count()) > 0) chipSeen = true;
      const p = await snap(page, "progress");
      return p.done ? p : null;
    },
    { timeoutMs: 290000, intervalMs: 250 },
  );
  check(chipSeen, "no callout chip appeared during the demonstration");

  await waitFor(
    "the demo mark sheet",
    async () => ((await snap(page, "screen")) === "results" ? true : null),
    { timeoutMs: 20000, intervalMs: 250 },
  );
  const result = await snap(page, "result");
  check(result !== null, "result() is null after the demonstration handed in");
  check(
    result.total === result.max - 1,
    `demo mark sheet total ${result.total}, expected max - 1 (max ${result.max})`,
  );

  // Which mark was lost: exactly PHYS-CALC's ("Calculation", RULE_LABEL in learn/marking.ts,
  // one li per rule on the results page). A different single lost mark must fail here too.
  await page
    .locator('[data-testid="results"]')
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
  const lostLabels = (
    await page.locator('[data-testid="results"] li[data-lost="1"] .rs-line-label').allInnerTexts()
  ).map((t) => t.trim());
  check(
    lostLabels.length === 1 && lostLabels[0] === "Calculation",
    `demo lost marks [${lostLabels.join(", ")}], expected exactly [Calculation]`,
  );
});
