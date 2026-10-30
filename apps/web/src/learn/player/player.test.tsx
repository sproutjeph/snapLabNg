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
import { StageChecklist } from "./StageChecklist";
import { humaniseStage, playerCovered, stageIndexOf, stagesOf } from "./stages";

// The player is markup over a director: these tests render it once with react-dom/server (no
// browser) and check what is on the page for each mode. The stage checklist is the guide's.

const quiet: VoiceGuide = {
  say: (_t, o) => o?.onEnd?.(),
  stop: () => {},
  speaking: false,
  muted: false,
  rate: 0.95,
};

function directorAt(
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
  return director;
}

function html(
  mode: "watch" | "practice" | "exam",
  script: Script = SAMPLE_SCRIPT,
  beat = 0,
  play = false,
) {
  return renderToStaticMarkup(
    createElement(Player, { director: directorAt(mode, script, beat, play) }),
  );
}

function checklist(mode: "watch" | "practice" | "exam", beat = 0, titles?: Record<string, string>) {
  return renderToStaticMarkup(
    createElement(StageChecklist, {
      director: directorAt(mode, SAMPLE_SCRIPT, beat),
      ...(titles ? { stageTitles: titles } : {}),
    }),
  );
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

/** player.css's rules, comments out and @media blocks flattened, each with the query it sits in. */
function playerRules(): Array<{ media: string; selector: string; body: string }> {
  const css = readFileSync(fileURLToPath(new URL("./player.css", import.meta.url)), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const rules: Array<{ media: string; selector: string; body: string }> = [];
  const walk = (src: string, media: string) => {
    let pos = 0;
    while (pos < src.length) {
      const open = src.indexOf("{", pos);
      if (open < 0) break;
      let depth = 1;
      let close = open + 1;
      while (close < src.length && depth > 0) {
        if (src[close] === "{") depth++;
        else if (src[close] === "}") depth--;
        close++;
      }
      const head = src.slice(pos, open).trim().replace(/\s+/g, " ");
      const inner = src.slice(open + 1, close - 1);
      if (head.startsWith("@media")) walk(inner, head.slice("@media".length).trim());
      else if (!head.startsWith("@")) rules.push({ media, selector: head, body: inner });
      pos = close;
    }
  };
  walk(css, "");
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

  it("covers only always-on chrome: 0 right, slim top bar, 0 bottom", () => {
    // Wave 2 lean (docs/plans/wave-2-lean.md): pop-ups overlay the stage and never refit it.
    const laptop = playerCovered(1440, 900);
    expect(laptop.right).toBe(0);
    expect(laptop.top).toBeCloseTo(56.7, 0);
    expect(laptop.bottom).toBe(0);
    const phone = playerCovered(390, 844);
    expect(phone.right).toBe(0);
    expect(phone.top).toBeCloseTo(99.8, 0);
    expect(phone.bottom).toBe(0);
  });
});

describe("Player markup", () => {
  it("Watch has the card's controls: restart, previous, play, next and the speed", () => {
    const out = html("watch", SAMPLE_SCRIPT, 4);
    expect(out).toContain("Restart");
    expect(out).toContain("Previous");
    expect(out).toContain("Next");
    expect(out).toContain("1x");
  });

  it("Watch shows the narration as the caption", () => {
    expect(html("watch", SAMPLE_SCRIPT, 1)).toContain("Read the length XY on the metre rule.");
  });

  it("Practise has no speed, and Show me only on a beat that allows it", () => {
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
    for (const words of ["Previous", "Next", "Restart"]) {
      expect(watch).toContain(`<span class="dp-label">${words}</span>`);
    }
  });

  it("Exam shows the clock, and no caption, no checklist, no stage count and no Show me", () => {
    const out = html("exam");
    expect(out).toContain("0:00");
    expect(out).toContain('role="timer"');
    for (const text of ["Join the cells", "Stage 1", "Show me", "dp-caption", "dp-panel", "Next"]) {
      expect(out).not.toContain(text);
    }
  });

  it("Watch keeps the five transport buttons in one group, with mute after the speed button", () => {
    // Restart, previous, play, next and the speed are one group; mute follows the divider, last in
    // the page, so the tab order follows. (On a touch screen css drops Restart from the group.)
    const out = html("watch", SAMPLE_SCRIPT, 4);
    const group = out.match(/<div class="dp-group">(.*?)<\/div>/s)?.[1] ?? "";
    expect(group.match(/<button/g)).toHaveLength(5);
    expect(group).not.toContain("Mute the voice");
    const speed = out.indexOf("Speed 1x");
    const divider = out.indexOf('class="dp-divider"');
    const mute = out.indexOf("Mute the voice and sounds");
    expect(speed).toBeGreaterThan(-1);
    expect(divider).toBeGreaterThan(speed);
    expect(mute).toBeGreaterThan(divider);
  });
});

describe("player.css", () => {
  const rules = playerRules();
  const rule = (selector: string, media = "") =>
    rules.find((r) => r.media === media && r.selector === selector);
  const tap44 = /min-width:\s*calc\(var\(--tap\)\s*\/\s*var\(--ui,\s*1\)\)/;

  it("every button is a 44 px target on a touch screen, on every layout", () => {
    // The card is anchored on its right edge, so the wider buttons grow it to the left. A mouse on
    // a laptop keeps Backcountry's sizes.
    expect(rule(".dp .dp-btn", "(pointer: coarse)")?.body).toMatch(tap44);
    expect(rule(".dp .dp-btn")).toBeUndefined();
  });

  it("a phone-sized window gets 44 px buttons whatever the pointer", () => {
    const phone = rule('.dp[data-layout="portrait"] .dp-btn, .dp[data-layout="short"] .dp-btn');
    expect(phone?.body).toMatch(tap44);
  });

  it("Watch drops Restart on a touch screen and on a phone held upright, and nowhere else", () => {
    // Six 44 px targets are 264 px, wider than a phone's pill: the practical menu has Restart
    // there. The button stays in the markup (a laptop with a mouse keeps all six); the css takes
    // it out of the page, so it leaves the tab order too. Exactly these two rules hide it.
    expect(html("watch", SAMPLE_SCRIPT, 4)).toContain(
      '<button type="button" class="dp-btn dp-restart"',
    );
    const hiding = rules
      .filter((r) => r.selector.includes("dp-restart") && /display:\s*none/.test(r.body))
      .map((r) => `${r.media}|${r.selector}`)
      .sort();
    expect(hiding).toEqual(
      ["(pointer: coarse)|.dp .dp-restart", '|.dp[data-layout="portrait"] .dp-restart'].sort(),
    );
  });

  it("Watch's pill holds its five buttons and mute in one card, not mute in a card beside it", () => {
    // Upright on a phone the pill is five 44 px buttons wide (previous, play, next, the speed, and
    // mute after the divider), about 245 px at 390: nothing positions mute on its own or stretches
    // the pill to Backcountry's 268 design px.
    expect(
      rules.some((r) => r.selector.includes(".dp-mute") && /position:\s*absolute/.test(r.body)),
    ).toBe(false);
    expect(rules.some((r) => /min-width:\s*268px/.test(r.body))).toBe(false);
    expect(rule('.dp.dp-watch[data-layout="portrait"] .dp-divider')).toBeUndefined();
    // The pill stays centred under the brand whether or not the Compare button is beside it.
    expect(rules.some((r) => r.selector.includes("data-compare"))).toBe(false);
  });

  it("mute is a 44 px target in Practise and Exam on compact, whatever the pointer", () => {
    // Compact is a tablet's size and mute is an icon on its own in these two cards, so it has no
    // mouse-sized exception there (wide keeps Backcountry's 37 px for a mouse).
    for (const mode of ["practice", "exam"] as const) {
      expect(html(mode)).toContain('class="dp-btn dp-mute"');
    }
    const compact = rule(
      '.dp.dp-practice[data-layout="compact"] .dp-mute, .dp.dp-practice[data-layout="compact"] .dp-again, .dp.dp-exam[data-layout="compact"] .dp-mute',
    );
    expect(compact?.body).toMatch(tap44);
  });

  it("on compact the repeat button keeps its icon and gives up its words, so the card clears the brand", () => {
    // Resume guide, Say it again, Show me and a 44 px mute are 359 px wide at 1024 and lay over the
    // end of the brand's tagline: the repeat button's words are clipped (still its name), never
    // display: none. Wide keeps all the words.
    const out = html("practice", SAMPLE_SCRIPT, 4, true);
    expect(out).toMatch(
      /class="dp-btn dp-btn-text dp-again"[^>]*>.*?<span class="dp-label">Say it again</s,
    );
    const clipped = rule('.dp.dp-practice[data-layout="compact"] .dp-again .dp-label')?.body ?? "";
    expect(clipped).toMatch(/clip-path/);
    expect(clipped).not.toMatch(/display:\s*none/);
    expect(rule('.dp.dp-practice[data-layout="compact"] .dp-again')?.body).toMatch(
      /padding:\s*0\b/,
    );
    expect(rule('.dp.dp-practice[data-layout="wide"] .dp-again .dp-label')).toBeUndefined();
  });

  it("a phone's card stays 8 px clear of the Compare button, and centred when there is room", () => {
    // 14 design px in and 44 px wide, so the card's margins are 14 + 52 / ui design px on both
    // sides: centred between them, and starting at the left margin when it is wider than the room.
    const card = rule('.dp[data-layout="portrait"] .dp-card')?.body ?? "";
    expect(card).toMatch(/left:\s*calc\(14px \+ 52px \/ var\(--ui, 1\)\)/);
    expect(card).toMatch(/right:\s*calc\(14px \+ 52px \/ var\(--ui, 1\)\)/);
    expect(card).toMatch(/width:\s*max-content/);
    expect(card).toMatch(/margin-inline:\s*auto/);
  });
});

describe("StageChecklist", () => {
  it("lists the beats of the stage the director is on, in the words she hears", () => {
    const out = checklist("watch", 4);
    expect(out).toContain("Join the cells to the key.");
    expect(out).toContain("Put the voltmeter across the wire, at X.");
    // Another stage's beats are not here.
    expect(out).not.toContain("Read the length XY on the metre rule.");
    expect(out).not.toContain("Head the R column.");
  });

  it("marks the current row, and the rows before it done in words as well as a tick", () => {
    const out = checklist("practice", 6);
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
    // Beats 4 and 5 (the first two leads) are done.
    expect(out.match(/Done\. /g)).toHaveLength(2);
    expect(out).toContain("sc-now");
  });

  it("draws a ring and a glyph for each beat, and a cursor that slides to the current row", () => {
    const out = checklist("watch", 5);
    const stage = stagesOf(SAMPLE_SCRIPT)[2];
    expect(out.match(/class="sc-glyph"/g)).toHaveLength(stage?.count ?? -1);
    expect(out).toContain("--i:1");
    expect(out).toContain("sc-cursor");
  });

  it("names the list by the stage's title", () => {
    expect(checklist("watch", 4, { connect: "Connect" })).toContain(
      'aria-label="Steps for Connect"',
    );
    expect(checklist("watch", 4)).toContain('aria-label="Steps for Connect"');
  });

  it("is empty in Exam: no guide, no checklist", () => {
    expect(checklist("exam", 4)).toBe("");
  });
});
