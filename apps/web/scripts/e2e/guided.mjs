// Guided E2E (docs/plans/guided-demo.md, "Watch v2: the question drives the bench"): the
// guided run (/?practical=ohms-law&mode=guided) plays to its conclusion at speed 8 — the
// same higher speed watch.mjs asks the e2e hook for — with the conditions the plan names
// checked on the way: the docked paper with step 1 marked, the identify tags in step 1,
// the diagram's leads inking one by one in step 3, the readings table filling to 7 rows in
// steps 4-6, the graph's best-fit line and "s = ΔV/ΔI", the conclusion (with no "0.25"
// anywhere on the page), Replay back to step 1, Home back to /, and the header credit
// opening the full paper paused, then resuming on close. One run is about a minute at
// speed 8 (the run visits the conclusion twice, for Replay then Home), well under the
// 4-minute bound, at phone 390x844 and laptop 1440x900 (lib.mjs).
//
// Speech: headless Chromium refuses speechSynthesis, which would leave the run on the
// "Tap to start" prompt (paper-tap). The route mutes the voice instead (&mute=1, which
// the e2e hook also does), so the reading runs on its estimated clock; if the prompt
// ever does appear, the run taps it, as she would.
//
// No DOM hook shows the 3D parts landing or the bench leads being drawn, so those two
// are read from the DOM the plan gives them: the identify tags (part-tags, which appear
// as each part is named and lands in step 1) and the paper diagram's lines turning from
// pencil to ink ([data-lead][data-made="1"], one per lead made, in step 3).

import { check, run, snap, waitFor } from "./lib.mjs";

/** One sample of everything the checks below read, taken in a single page visit. */
function sample(page) {
  return page.evaluate(() => {
    const step =
      document
        .querySelector('[data-testid="paper-sheet"] li[data-reading="1"] .qp-label')
        ?.textContent?.trim() ??
      document.querySelector('[data-testid="step-card"] .gp-step-label')?.textContent?.trim() ??
      null;
    return {
      progress: window.__snaplab.progress(),
      dock: document.querySelector(".gd-dock")?.getAttribute("data-testid") ?? null,
      paperSheet: document.querySelectorAll('[data-testid="paper-sheet"]').length > 0,
      step,
      tags: document.querySelectorAll('[data-testid="part-tags"] .gt-tag').length,
      made: document.querySelectorAll('[data-lead][data-made="1"]').length,
      rows: document.querySelectorAll('[data-testid^="readings-row-"]').length,
      graphLine: document.querySelector('[data-testid="graph-line"]') !== null,
      slope: document.querySelector('[data-testid="graph-slope"] dd')?.textContent?.trim() ?? null,
      conclusion: document.querySelector('[data-testid="conclusion"]') !== null,
      tapPrompt: document.querySelector('[data-testid="paper-tap"]') !== null,
    };
  });
}

await run(
  "guided",
  "/?practical=ohms-law&mode=guided&e2e=1&speed=8&seed=7&mute=1",
  async (page, vp) => {
    check((await snap(page, "screen")) === "watch", "page did not open in guided Watch");

    const seen = {
      dockPaperStep1: false,
      tagsInStep1: false,
      maxTags: 0,
      leadCounts: [],
      maxRows: 0,
      rows7Steps: new Set(),
      graphLine: false,
      slopeText: null,
    };
    let tapped = false;
    let creditChecked = false;

    // The header credit opens the full question and pauses the run; closing it resumes.
    // On a phone the credit is clipped to a 1x1 visually-hidden box (shell.css, portrait
    // .sh-credit), so no real tap can reach it there: the click is then sent to the
    // button itself, and the pause/resume below is still what is checked. (PR: Needs
    // from lead — a tappable phone credit would let this be a plain click at both sizes.)
    const checkCreditPaper = async () => {
      const credit = page.locator('[data-testid="credit-paper"]');
      check((await credit.count()) === 1, "credit-paper header button is missing");
      if (vp.viewport === "phone") {
        await credit.dispatchEvent("click");
      } else {
        await credit.click({ timeout: 15000 });
      }
      const sheet = page.locator(".sh-sheet-paper");
      await sheet.first().waitFor({ state: "visible", timeout: 15000 });
      const sheetText = (await sheet.first().textContent()) ?? "";
      check(
        sheetText.includes("Connect the circuit"),
        "the opened paper does not show the full question",
      );
      const pausedAt = (await snap(page, "progress")).beat;
      await page.waitForTimeout(1800);
      check(
        (await snap(page, "progress")).beat === pausedAt,
        `run advanced while the full paper was open (beat ${pausedAt} moved)`,
      );
      await page
        .getByRole("button", { name: "Close question paper" })
        .first()
        .click({ timeout: 15000 });
      await waitFor(
        "the run to resume after the paper closes",
        async () => ((await snap(page, "progress")).beat > pausedAt ? true : null),
        { timeoutMs: 20000, intervalMs: 250 },
      );
      creditChecked = true;
    };

    await waitFor(
      "the guided run to reach its conclusion",
      async () => {
        const s = await sample(page);
        if (s.tapPrompt && !tapped) {
          tapped = true;
          await page.locator('[data-testid="paper-tap"]').click({ timeout: 15000 });
          return null;
        }
        // 1. The question paper is docked and step 1 is highlighted.
        if (s.dock === "dock-paper" && s.paperSheet && s.step === "1") seen.dockPaperStep1 = true;
        // 2. The parts land during step 1 (their identify tags appear there).
        if (s.step === "1" && s.tags > 0) seen.tagsInStep1 = true;
        seen.maxTags = Math.max(seen.maxTags, s.tags);
        // 3. While step 3 is highlighted, leads appear one by one (the diagram inks).
        if (s.step === "3" && s.made > 0 && seen.leadCounts.at(-1) !== s.made) {
          seen.leadCounts.push(s.made);
        }
        // 4. The readings table fills during steps 4-6.
        seen.maxRows = Math.max(seen.maxRows, s.rows);
        if (s.rows === 7 && ["4", "5", "6"].includes(s.step ?? "")) seen.rows7Steps.add(s.step);
        // 5. The graph's best-fit line and slope text.
        if (s.graphLine) seen.graphLine = true;
        if (s.slope !== null) seen.slopeText = s.slope;
        // 8. Mid-run, once the leads are all on (so the step-3 samples above are
        // complete) and beats are still short: the header paper.
        if (!creditChecked && seen.leadCounts.at(-1) === 7) await checkCreditPaper();
        return s.progress.done && s.conclusion ? s : null;
      },
      { timeoutMs: 240000, intervalMs: 100 },
    );

    check(seen.dockPaperStep1, "paper was never docked (dock-paper) with step 1 highlighted");
    check(seen.tagsInStep1, "no identify tags (part-tags) appeared during step 1");
    check(seen.maxTags >= 2, `only ${seen.maxTags} identify tag(s) seen, expected the parts named`);
    check(
      seen.leadCounts.length >= 3 && seen.leadCounts.at(-1) === 7,
      `diagram leads inked as [${seen.leadCounts.join(", ")}] during step 3, expected steps up to 7`,
    );
    check(
      seen.leadCounts.every((n, i) => i === 0 || n > (seen.leadCounts[i - 1] ?? 0)),
      `diagram lead count did not rise one by one: [${seen.leadCounts.join(", ")}]`,
    );
    check(seen.maxRows === 7, `readings table reached ${seen.maxRows} rows, expected 7`);
    check(seen.rows7Steps.size > 0, "the 7th readings row did not land during steps 4-6");
    check(seen.graphLine, "graph best-fit line (graph-line) never appeared");
    check(
      seen.slopeText?.includes("s = ΔV/ΔI") ?? false,
      `graph slope text is ${JSON.stringify(seen.slopeText)}, expected it to show "s = ΔV/ΔI"`,
    );
    check(creditChecked, "header credit paper was never opened (check 8 did not run)");

    // 6. The conclusion card appears, and nothing on the page contains "0.25".
    const conclusion = page.locator('[data-testid="conclusion"]');
    await conclusion.first().waitFor({ state: "visible", timeout: 15000 });
    const bodyText = (await page.locator("body").textContent()) ?? "";
    check(!bodyText.includes("0.25"), 'page contains "0.25" at the conclusion');

    // 7. Replay goes back to step 1; then a second run to the conclusion, and Home to /.
    await page.locator('[data-testid="conclusion-replay"]').click({ timeout: 15000 });
    await waitFor(
      "Replay to return to step 1",
      async () => {
        const s = await sample(page);
        return s.dock === "dock-paper" && s.step === "1" && s.progress.beat < 3 ? s : null;
      },
      { timeoutMs: 30000, intervalMs: 100 },
    );
    await waitFor(
      "the replayed run to reach its conclusion",
      async () => {
        const s = await sample(page);
        return s.progress.done && s.conclusion ? s : null;
      },
      { timeoutMs: 240000, intervalMs: 250 },
    );
    await page.locator('[data-testid="conclusion-home"]').click({ timeout: 15000 });
    await waitFor(
      "Home to return to /",
      async () => (new URL(page.url()).pathname === "/" ? true : null),
      { timeoutMs: 30000, intervalMs: 250 },
    );
  },
);
