import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { emptyOhmsLawRecord } from "../readings/record";
import { createDirector } from "../script/createDirector";
import { SAMPLE_SCRIPT } from "../script/sampleScript";
import type { Script } from "../script/types";
import type { BenchState } from "../types";
import type { VoiceGuide } from "../voice/types";
import { createOhmsLawBench } from "../wiring/bench";
import { Player } from "./Player";
import { humaniseStage, playerCovered, stageIndexOf, stagesOf, WIDE_MIN_PX } from "./stages";

// The player is markup over a director: these tests render it once with react-dom/server (no
// browser) and check what is on the page for each mode.

const quiet: VoiceGuide = {
  say: (_t, o) => o?.onEnd?.(),
  stop: () => {},
  speaking: false,
  muted: false,
  rate: 0.95,
};

function html(
  mode: "watch" | "practice" | "exam",
  script: Script = SAMPLE_SCRIPT,
  beat = 0,
  play = false,
) {
  const bench = createOhmsLawBench(5);
  const record = emptyOhmsLawRecord("practice");
  const benchState = (): BenchState => ({
    comparison: bench.comparison,
    keyClosed: false,
    boxSettingOhm: 0,
    record,
    identified: new Set(),
  });
  const director = createDirector(
    mode === "watch"
      ? { mode, script, voice: quiet, bench, benchState }
      : { mode, script, voice: quiet, bench, benchState },
  );
  director.seek(beat);
  if (play) director.play();
  return renderToStaticMarkup(createElement(Player, { director }));
}

/** The css rules whose selector names `.dp-label`, as [selector, body]. */
function labelRules(): Array<[string, string]> {
  const css = readFileSync(fileURLToPath(new URL("./player.css", import.meta.url)), "utf8");
  const rules: Array<[string, string]> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1]?.trim() ?? "";
    if (selector.includes(".dp-label")) rules.push([selector, m[2] ?? ""]);
  }
  return rules;
}

describe("stages", () => {
  it("the sample script has the question's eleven stages, in order", () => {
    const stages = stagesOf(SAMPLE_SCRIPT);
    expect(stages.map((s) => s.key)).toEqual([
      "identify",
      "measure-xy",
      "connect",
      "r0",
      "r1",
      "repeat",
      "plot",
      "slope",
      "precautions",
      "law",
      "length",
    ]);
    expect(stages.reduce((n, s) => n + s.count, 0)).toBe(SAMPLE_SCRIPT.beats.length);
  });

  it("finds the stage of a beat", () => {
    const stages = stagesOf(SAMPLE_SCRIPT);
    expect(stageIndexOf(stages, 0)).toBe(0);
    expect(stageIndexOf(stages, 4)).toBe(2);
    expect(stageIndexOf(stages, SAMPLE_SCRIPT.beats.length - 1)).toBe(10);
    expect(stageIndexOf([], 3)).toBe(0);
  });

  it("tidies a stage key into a title", () => {
    expect(humaniseStage("measure-xy")).toBe("Measure xy");
  });

  it("covers the stage panel on a wide screen only, plus the header and the dock", () => {
    expect(playerCovered(1440, 900).right).toBeGreaterThan(280);
    expect(playerCovered(WIDE_MIN_PX - 1, 800).right).toBe(0);
    expect(playerCovered(390, 844).top).toBeGreaterThan(0);
    expect(playerCovered(390, 844).bottom).toBeGreaterThan(0);
  });
});

describe("Player markup", () => {
  it("Watch says it is a demonstration bench, which stage it is on, and has the controls", () => {
    const out = html("watch", SAMPLE_SCRIPT, 4);
    expect(out).toContain("Demonstration bench. Your own bench will give different readings.");
    expect(out).toContain("Stage 3 of 11");
    expect(out).toContain("Previous");
    expect(out).toContain("Next");
    expect(out).toContain("1x");
    expect(out).toContain("Join the cells to the key.");
    expect(out).toContain("Stage 11: ");
  });

  it("Watch shows the narration as the caption", () => {
    expect(html("watch", SAMPLE_SCRIPT, 1)).toContain("Read the length XY on the metre rule.");
  });

  it("Practise has no speed or stage ticks, and Show me only on a beat that allows it", () => {
    const onLead = html("practice", SAMPLE_SCRIPT, 4);
    expect(onLead).toContain("Show me");
    expect(onLead).toContain("Resume guide");
    expect(html("practice", SAMPLE_SCRIPT, 0)).toContain("Start the guide");
    expect(onLead).not.toContain("Speed");
    const onRead = html("practice", SAMPLE_SCRIPT, 17);
    expect(onRead).not.toContain("Show me");
  });

  it("keeps the caption's live region mounted even with nothing to say yet", () => {
    const silent: Script = {
      ...SAMPLE_SCRIPT,
      beats: SAMPLE_SCRIPT.beats.map((b) => ({ ...b, say: "", instruct: "" })),
    };
    for (const mode of ["watch", "practice"] as const) {
      expect(html(mode, silent, 0)).toContain('class="dp-caption" aria-live="polite"');
    }
  });

  it("Say it again is disabled while the guide is paused and works while it plays", () => {
    const sayAgain = /<button[^>]*>(?:(?!<\/button>).)*Say it again/s;
    const paused = html("practice", SAMPLE_SCRIPT, 4).match(sayAgain)?.[0] ?? "";
    const playing = html("practice", SAMPLE_SCRIPT, 4, true).match(sayAgain)?.[0] ?? "";
    expect(paused).toContain("disabled");
    expect(playing).not.toContain("disabled");
  });

  it("the narrow-screen css hides button words visually, never with display: none", () => {
    const rules = labelRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const [selector, body] of rules) {
      expect({ selector, hidden: /display:\s*none/.test(body) }).toEqual({
        selector,
        hidden: false,
      });
    }
    expect(rules.some(([, body]) => /clip-path|clip:/.test(body))).toBe(true);
  });

  it("every icon-only button on a phone keeps its words in the page for screen readers", () => {
    const out = html("practice", SAMPLE_SCRIPT, 4, true);
    for (const words of ["Say it again", "Show me"]) {
      expect(out).toContain(`<span class="dp-label">${words}</span>`);
    }
    const watch = html("watch", SAMPLE_SCRIPT, 4);
    for (const words of ["Previous", "Next"]) {
      expect(watch).toContain(`<span class="dp-label">${words}</span>`);
    }
  });

  it("Exam shows no caption, no checklist, no stage count and no Show me", () => {
    const out = html("exam");
    expect(out).toContain("Exam conditions");
    expect(out).toContain("0:00");
    for (const text of ["Join the cells", "Stage 1", "Show me", "dp-caption", "dp-panel", "Next"]) {
      expect(out).not.toContain(text);
    }
  });
});
