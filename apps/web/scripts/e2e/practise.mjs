// Practise E2E (docs/plans/integration.md, slice I2): one deliberate wrong tap first (a hint
// appears and contains no digit; the wrong lead is undone with the page's own Undo lead
// button), then the circuit is wired by tapping targets(), then each row is taken as she
// would: setR -> close the key -> wait for the meters -> type R, I and V -> open the key.
// On hand-in every typed row must check against her own meters: checkRows === checkOk === rows.
// The length, graph and precautions stay blank, so total === max is not expected.
//
// The question's rows, in the order they are taken (OHMS_LAW_RESISTANCES in
// learn/lessons/ohms-law/script.ts; the hook exposes no row list, so they are pinned here
// and in watch.mjs's seed).

import { check, run, snap, waitFor } from "./lib.mjs";

const RESISTANCES = [0, 1, 5, 10, 20, 40, 60];

await run("practise", "/?practical=ohms-law&mode=practice&e2e=1&seed=7", async (page) => {
  check((await snap(page, "screen")) === "practice", "page did not open in Practise");

  // A deliberate wrong lead: the cells shorted straight across (E+ to E-).
  await snap(page, "tap", "E+");
  await snap(page, "tap", "E-");
  const hint = page.locator('[data-testid="hint"]');
  await hint.first().waitFor({ state: "visible", timeout: 15000 });
  const hintText = await hint.first().innerText();
  check(!/\d/.test(hintText), `hint contains a digit: ${hintText.slice(0, 120)}`);
  await page.getByRole("button", { name: "Undo lead" }).click({ timeout: 15000 });

  // Wire the circuit: tap the two terminals targets() names until none are left.
  for (let lead = 0; lead < 12; lead++) {
    const targets = await snap(page, "targets");
    if (targets.length === 0) break;
    check(targets.length === 2, `targets() returned ${JSON.stringify(targets)}, expected a pair`);
    await snap(page, "tap", targets[0]);
    await snap(page, "tap", targets[1]);
    await page.waitForTimeout(200);
  }
  check((await snap(page, "targets")).length === 0, "circuit still incomplete after wiring");

  // Take every row at its box setting, reading her own meters.
  for (let row = 0; row < RESISTANCES.length; row++) {
    const ohm = RESISTANCES[row];
    await snap(page, "setR", ohm);
    await snap(page, "key", true);
    const meters = await waitFor(
      `row ${row + 1} (R = ${ohm}) meter readings`,
      async () => {
        const m = await snap(page, "meters");
        return m.i !== null && m.v !== null ? m : null;
      },
      { timeoutMs: 30000, intervalMs: 200 },
    );
    await snap(page, "type", row, "R", String(ohm));
    await snap(page, "type", row, "I", String(meters.i));
    await snap(page, "type", row, "V", String(meters.v));
    // Give the bench a beat to log the settled reading before the key opens.
    await page.waitForTimeout(500);
    await snap(page, "key", false);
    await page.waitForTimeout(250);
  }

  await snap(page, "handIn");
  await waitFor(
    "the results screen",
    async () => ((await snap(page, "screen")) === "results" ? true : null),
    { timeoutMs: 20000, intervalMs: 250 },
  );
  const result = await snap(page, "result");
  check(result !== null, "result() is null after hand-in");
  check(
    result.checkRows === RESISTANCES.length,
    `checkRows ${result.checkRows}, expected ${RESISTANCES.length}`,
  );
  check(
    result.checkOk === RESISTANCES.length,
    `checkOk ${result.checkOk}, expected ${RESISTANCES.length} (every row against her meters)`,
  );
});
