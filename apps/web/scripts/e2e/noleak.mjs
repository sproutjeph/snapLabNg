// No-leak E2E (docs/plans/integration.md, slice I2; AGENTS.md: never show the student the
// expected result before she hands in). In Practise and Exam, before hand-in the reading
// check is absent and the page text never contains the wire's resistance; after hand-in the
// check and the slope comparison ("The wire is ...") appear. wireOhm() is read through the
// hook for this check only; nothing on the page may print it early.
//
// Leak forms: the value at 1, 2 and 3 significant figures, at 1 decimal place (the form the
// results page itself prints), and in full. A form with no decimal point (the 1 s.f. of
// 2.895... is "3") cannot be told apart from the question's own numbers, so only forms that
// carry a decimal point are matched; every printed leak would carry one.

import { check, run, snap, waitFor } from "./lib.mjs";

function leakForms(n) {
  const forms = new Set([String(n), n.toFixed(1)]);
  for (const sf of [1, 2, 3]) forms.add(n.toPrecision(sf));
  return [...forms].filter((f) => f.includes("."));
}

for (const mode of ["practice", "exam"]) {
  await run(`noleak-${mode}`, `/?practical=ohms-law&mode=${mode}&e2e=1&seed=7`, async (page) => {
    const screen = await snap(page, "screen");
    check(screen === mode, `page did not open in ${mode} (screen is ${screen})`);
    check(
      (await page.locator('[data-testid="results-check"]').count()) === 0,
      `${mode}: results-check is present before hand-in`,
    );
    check(
      (await page.locator('[data-testid="results"]').count()) === 0,
      `${mode}: results are present before hand-in`,
    );

    const wire = await snap(page, "wireOhm");
    check(Number.isFinite(wire) && wire > 0, `wireOhm() returned ${wire}`);
    const textBefore = await page.locator("body").innerText();
    for (const form of leakForms(wire)) {
      check(!textBefore.includes(form), `${mode}: page shows the wire resistance ${form} early`);
    }

    await snap(page, "handIn");
    await waitFor(
      "the results screen",
      async () => ((await snap(page, "screen")) === "results" ? true : null),
      { timeoutMs: 20000, intervalMs: 250 },
    );
    const checkSection = page.locator('[data-testid="results-check"]');
    await checkSection.first().waitFor({ state: "visible", timeout: 15000 });
    const checkText = await checkSection.first().innerText();
    check(
      checkText.includes(`The wire is ${wire.toFixed(1)}`),
      `${mode}: slope comparison missing after hand-in (expected "The wire is ${wire.toFixed(1)}")`,
    );
  });
}
