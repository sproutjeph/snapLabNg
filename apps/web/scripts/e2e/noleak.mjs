// No-leak E2E (docs/plans/integration.md, slice I2; AGENTS.md: never show the student the
// expected result before she hands in). In Practise and Exam, before hand-in the reading
// check is absent and the page text never contains the wire's resistance; after hand-in the
// check and the slope comparison ("The wire is ...") appear. wireOhm() is read through the
// hook for this check only; nothing on the page may print it early. The page text is sampled
// at load, again after the bench has been used (Practise: one setR and key cycle), and
// repeatedly for about 3 s just before hand-in, so "never" is sampled, not looked at once.
//
// Leak forms: the value at 1, 2 and 3 significant figures, at 1 decimal place (the form the
// results page itself prints), and in full. Forms with a decimal point match as plain text.
// A bare-integer form (the 1 s.f. of 2.895... is "3"; the 2 s.f. of a wire over 10 ohm would
// be one too) matches only as a number next to the unit, e.g. "3 Ω" or "3.0 Ω", never as a
// stray digit in the question's own numbering.

import { check, run, snap, waitFor } from "./lib.mjs";

function leakForms(n) {
  const forms = new Set([String(n), n.toFixed(1)]);
  for (const sf of [1, 2, 3]) forms.add(n.toPrecision(sf));
  return [...forms];
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The leak form found in `text`, or null when the text is clean. */
function leaksIn(text, wire) {
  for (const form of leakForms(wire)) {
    if (form.includes(".")) {
      if (text.includes(form)) return form;
    } else if (new RegExp(`(^|[^\\d.])${escapeRegExp(form)}(\\.0)?\\s*Ω`).test(text)) {
      return `${form} Ω`;
    }
  }
  return null;
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
    const assertNoLeak = async (when) => {
      const text = await page.locator("body").innerText();
      const hit = leaksIn(text, wire);
      check(hit === null, `${mode}: page shows the wire resistance (${hit}) ${when}`);
    };
    await assertNoLeak("at load");

    if (mode === "practice") {
      // Use the bench once, the way she would between readings, then look again.
      await snap(page, "setR", 5);
      await snap(page, "key", true);
      await waitFor(
        "the meter readings after closing the key",
        async () => {
          const m = await snap(page, "meters");
          return m.i !== null && m.v !== null ? m : null;
        },
        { timeoutMs: 30000, intervalMs: 200 },
      );
      await snap(page, "key", false);
    }

    // About 3 s of sampling just before hand-in: the value must never appear.
    const until = Date.now() + 3000;
    while (Date.now() < until) {
      await assertNoLeak("before hand-in");
      await page.waitForTimeout(500);
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
