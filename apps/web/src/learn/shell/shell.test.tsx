import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OHMS_LAW_LESSON } from "../lessons/ohms-law/lesson";
import { MODE_NOTE } from "../player/stages";
import type { LessonMode } from "../types";
import LessonShell, { type LessonShellProps, type ShellTab, type StepStatus } from "./LessonShell";
import { layoutFor } from "./layout";
import { PracticalMenuBody } from "./PracticalMenu";
import { creditFromSource } from "./StatusCard";
import { applyLayout } from "./useLayout";

// The shell is markup over a lesson: these render it once with react-dom/server (no browser), as
// the player's tests do, and check what is on the page. Geometry is checked in a real browser
// (?shell=1&debug=1) and in layout.test.ts; here only what the page says.

const lesson = OHMS_LAW_LESSON;
const total = lesson.steps.length;

function html(over: Partial<LessonShellProps> = {}, mode: LessonMode = "practice"): string {
  const props: LessonShellProps = {
    lesson,
    mode,
    stepIndex: 0,
    onStepChange: () => {},
    stepStatus: lesson.steps.map(() => "todo" as StepStatus),
    tab: "instructions" as ShellTab,
    onTabChange: () => {},
    ...over,
  };
  return renderToStaticMarkup(createElement(LessonShell, props));
}

/** shell.css's rules as [selector, body], with the comments taken out. */
function shellRules(): Array<[string, string]> {
  const css = readFileSync(fileURLToPath(new URL("./shell.css", import.meta.url)), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const rules: Array<[string, string]> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push([(m[1] ?? "").trim(), m[2] ?? ""]);
  }
  return rules;
}

describe("rail", () => {
  it("has the six places, with the current page marked", () => {
    const out = html();
    const start = out.indexOf('class="sh-rail"');
    const rail = out.slice(start, out.indexOf("</nav>", start));
    expect(start).toBeGreaterThan(0);
    expect(rail.match(/class="sh-nav-item"/g)).toHaveLength(6);
    for (const label of [
      "Home",
      "Metre bridge",
      "Titration",
      "Ohm&#x27;s law (V–I)",
      "Notebook",
      "About",
    ]) {
      expect(rail).toContain(`aria-label="${label}"`);
    }
    expect(rail.match(/aria-current="page"/g)).toHaveLength(1);
    expect(rail).toMatch(/aria-current="page"[^>]*aria-label="Ohm&#x27;s law \(V–I\)"/);
  });

  it("opens and closes with a named button", () => {
    expect(html()).toContain('aria-label="Open the menu"');
  });
});

describe("brand and status card", () => {
  it("names the practical, and marks the way she is on in the tagline", () => {
    const out = html({ practical: "watch" });
    expect(out).toContain("SnapLab NG");
    expect(out).toContain('<span class="sh-mode" aria-current="true">Watch</span>');
    expect(out).toContain('<span class="sh-mode">Practise</span>');
    expect(out).toContain('<span class="sh-mode">Exam</span>');
    expect(html({}, "exam")).toContain('<span class="sh-mode" aria-current="true">Exam</span>');
    expect(html()).toContain('<span class="sh-mode" aria-current="true">Practise</span>');
  });

  it("says how many stages are done: 3/11 for three", () => {
    const stepStatus: StepStatus[] = lesson.steps.map((_, i) => (i < 3 ? "done" : "todo"));
    const out = html({ stepStatus, stepIndex: 3 });
    expect(total).toBe(11);
    expect(out).toContain("3/11");
    expect(out).toContain("3 of 11 stages done");
    expect(html()).toContain("0/11");
  });

  it("the bar steps with the stage count, not with the time", () => {
    const stepStatus: StepStatus[] = lesson.steps.map((_, i) => (i < 3 ? "done" : "todo"));
    expect(html({ stepStatus })).toContain('class="sh-bar-fill" style="width:27%"');
  });

  it("has the practical's name as its heading", () => {
    expect(html()).toContain('<h1 class="sh-course-name">Ohm&#x27;s law (V–I)</h1>');
  });

  it("shows the paper's source in the credit slot, in two lines", () => {
    const credit = creditFromSource("WASSCE (SC) 2018, Physics Paper 3, Question 3B");
    expect(credit).toEqual({ lead: "WASSCE (SC) 2018", line: "Physics Paper 3 · Q3B" });
    const out = html({ status: { credit } });
    expect(out).toContain("WASSCE (SC) 2018");
    expect(out).toContain("Physics Paper 3 · Q3B");
    expect(html()).not.toContain("sh-credit");
  });

  it("drops the bar and the count when asked (Exam)", () => {
    const out = html({ status: { hideCount: true } }, "exam");
    expect(out).not.toContain("sh-count");
    expect(out).not.toContain("sh-bar");
    expect(out).not.toContain("0/11");
    expect(out).toContain("sh-course-name");
  });
});

describe("guide", () => {
  const tabsOf = (out: string) =>
    [...out.matchAll(/role="tab"[^>]*>([^<]*)</g)].map((m) => m[1] ?? "");

  it("has Instructions, Why it works and Precautions, and no Examiner asks without content", () => {
    const out = html();
    expect(tabsOf(out)).toEqual(["Instructions", "Why it works", "Precautions"]);
    expect(out).not.toContain("Examiner asks");
  });

  it("adds Examiner asks only when the page passes its content", () => {
    const out = html({ tabContent: { examiner: createElement("p", null, "Ask me") } });
    expect(tabsOf(out)).toEqual(["Instructions", "Why it works", "Precautions", "Examiner asks"]);
  });

  it("Exam keeps Instructions (and Examiner asks), not Why it works or Precautions", () => {
    expect(tabsOf(html({}, "exam"))).toEqual(["Instructions"]);
    const withExaminer = html({ tabContent: { examiner: createElement("p", null, "x") } }, "exam");
    expect(tabsOf(withExaminer)).toEqual(["Instructions", "Examiner asks"]);
    expect(html({ tab: "why" }, "exam")).not.toContain("Why it works");
  });

  it("Practise says what to do next; Exam says only what the question says", () => {
    const practise = html({ stepIndex: 1 });
    expect(practise).toContain("Do this next");
    expect(practise).toContain("The question says");
    expect(practise).toContain(lesson.steps[1]?.plain.slice(0, 20) ?? "?");
    const exam = html({ stepIndex: 1 }, "exam");
    expect(exam).not.toContain("Do this next");
    expect(exam).not.toContain("On the bench");
    expect(exam).toContain("The question says");
  });

  it("shows the stage's sub-steps under the question's words, in place of Do this next", () => {
    const out = html({ checklist: createElement("ol", { className: "sc-list" }, "rows") });
    expect(out).toContain('<ol class="sc-list">rows</ol>');
    expect(out).not.toContain("Do this next");
    expect(
      html({ checklist: createElement("ol", { className: "sc-list" }) }, "exam"),
    ).not.toContain("sc-list");
  });

  it("says the mode's one line at the foot", () => {
    for (const mode of ["watch", "practice", "exam"] as const) {
      const out = html({ note: MODE_NOTE[mode] }, mode === "exam" ? "exam" : "practice");
      expect(out).toContain(`<p class="sh-note">${MODE_NOTE[mode]}</p>`);
    }
    expect(MODE_NOTE.watch).toBe(
      "Demonstration bench. Your own bench will give different readings.",
    );
    expect(MODE_NOTE.exam).toBe("Exam conditions: no guide.");
  });

  it("shows the examiner's content in its tab", () => {
    const out = html({
      tab: "examiner",
      tabContent: {
        examiner: createElement("p", { className: "mine" }, "Why does the key stay open?"),
      },
    });
    expect(out).toContain("Why does the key stay open?");
  });

  it("names the panel by the step", () => {
    expect(html({ stepIndex: 2 })).toContain('aria-label="Step 3: Connect"');
  });
});

describe("step strip", () => {
  const cards = (out: string) =>
    [...out.matchAll(/aria-label="(Step \d+, [^"]*)"/g)].map((m) => m[1]);

  it("has one card per stage, each with its number, title and status words", () => {
    const out = html();
    const found = cards(out);
    expect(found).toHaveLength(total);
    expect(found[0]).toBe("Step 1, Identify, not done yet");
    expect(found[2]).toBe("Step 3, Connect, not done yet");
    expect(found[10]).toBe("Step 11, (b)(ii), not done yet");
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("says done, lost and locked in words as well as marks", () => {
    const stepStatus: StepStatus[] = lesson.steps.map((_, i) =>
      i === 0 ? "done" : i === 1 ? "lost" : "todo",
    );
    const out = html({ stepStatus, stepIndex: 2, lockedFrom: 3 });
    const found = cards(out);
    expect(found[0]).toBe("Step 1, Identify, done");
    expect(found[1]).toBe("Step 2, Measure XY, lost");
    expect(found[2]).toBe("Step 3, Connect, not done yet");
    expect(found[3]).toBe("Step 4, R = 0 Ω, locked");
    expect(out).toContain("sh-step-mark is-done");
    expect(out).toContain("sh-step-mark is-lost");
    expect(out).toContain("sh-step-lock");
  });

  it("locked and display-only cards say so and stay focusable (aria-disabled)", () => {
    const locked = html({ lockedFrom: 1 });
    expect(locked.match(/aria-disabled="true"/g)?.length).toBe(total - 1);
    const readOnly = html({ readOnlyTabs: true });
    expect(readOnly.match(/class="sh-step"[^>]*aria-disabled="true"/g)).toHaveLength(total);
    expect(html()).not.toContain("aria-disabled");
  });

  it("shows a picture where there is one, and a numbered ink ring where there is not", () => {
    const out = html({ thumbs: { identify: "/thumbs/ohms-law/identify.webp" } });
    expect(out).toContain('<img src="/thumbs/ohms-law/identify.webp" alt=""');
    expect(out.match(/class="sh-ring"/g)).toHaveLength(total - 1);
    expect(html().match(/class="sh-ring"/g)).toHaveLength(total);
  });

  it("names the practical on the selector, with previous and next buttons", () => {
    const out = html();
    expect(out).toContain("Practical: Ohm&#x27;s law (V–I)");
    expect(out).toContain('aria-label="Previous stage"');
    expect(out).toContain('aria-label="Next stage"');
  });
});

describe("practical menu", () => {
  const body = (over: { onRestart?: () => void } = {}) =>
    renderToStaticMarkup(
      createElement(PracticalMenuBody, { stageCount: total, onNavigate: () => {}, ...over }),
    );

  it("lists the three practicals, the one she is on ticked with its stage count", () => {
    const out = body();
    for (const name of ["Metre bridge", "Titration", "Ohm&#x27;s law (V–I)"]) {
      expect(out).toContain(`<b>${name}</b>`);
    }
    expect(out.match(/class="sh-pitem"/g)).toHaveLength(3);
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toContain("11 stages");
  });

  it("has no Restart unless the page offers it (Practise and Exam have none)", () => {
    expect(body()).not.toContain("Restart");
    expect(body()).not.toContain("sh-pmenu-actions");
  });

  it("lists Restart under the practicals, as a button, when the page offers it (Watch)", () => {
    const out = body({ onRestart: () => {} });
    expect(out.match(/class="sh-pitem"/g)).toHaveLength(4);
    expect(out).toMatch(/<button type="button" class="sh-pitem">.*<b>Restart<\/b>/s);
    // Under the three links, set off in its own list, so a touch screen finds it last.
    expect(out.indexOf("sh-pmenu-actions")).toBeGreaterThan(out.lastIndexOf('href="'));
  });
});

describe("shell.css", () => {
  const labelClasses = [
    ".sh-txt",
    ".sh-label",
    ".sh-nav-label",
    ".sh-step-label",
    ".sh-credit-text",
    ".sh-brand-text",
    ".sh-brand-tagline",
    ".sh-practical-label",
  ];

  it("a label folded away on a small screen is clipped, never display: none", () => {
    const rules = shellRules();
    const labelled = rules.filter(([selector]) => labelClasses.some((c) => selector.includes(c)));
    expect(labelled.length).toBeGreaterThan(0);
    for (const [selector, body] of labelled) {
      expect({ selector, hidden: /display:\s*none/.test(body) }).toEqual({
        selector,
        hidden: false,
      });
    }
    expect(labelled.some(([, body]) => /clip-path|clip:/.test(body))).toBe(true);
  });

  it("the credit's small line and the phone's tagline have a floor on the screen, not only in design px", () => {
    // The layers are zoomed by --ui, so 10.5 design px was 8.7 px on a 1440 laptop and 11.5 was
    // 10.4 px on a 390 phone: each is at least 11.5 px as drawn, and 12 design px.
    const rules = shellRules();
    for (const selector of [
      ".sh-credit-lead",
      '.sh-root[data-layout="portrait"] .sh-brand-tagline',
    ]) {
      const body = rules.find(([s]) => s === selector)?.[1] ?? "";
      expect({
        selector,
        floored: /font-size:\s*max\(12px,\s*calc\(11\.5px\s*\/\s*var\(--ui,\s*1\)\)\)/.test(body),
      }).toEqual({ selector, floored: true });
    }
  });

  it("uses no layout media queries: the modes come from data-layout", () => {
    const css = readFileSync(fileURLToPath(new URL("./shell.css", import.meta.url)), "utf8");
    expect(css).not.toMatch(/@media\s*\(\s*(min|max)-(width|height)/);
  });

  it("slides and fades only when motion is allowed", () => {
    const css = readFileSync(fileURLToPath(new URL("./shell.css", import.meta.url)), "utf8");
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    const outside = css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(outside).not.toMatch(/transition\s*:/);
    expect(outside).not.toMatch(/animation\s*:/);
  });
});

describe("learn.css (the lesson page's overlays)", () => {
  // ?learn=ohms-law lays a toolbar, a note, a close-up bar and the graph paper over the canvas. They
  // used to sit at fixed offsets from the old header and panel (top 96 px, right 428 px), which ran
  // under the new cards (the Compare button, the guide). They read the shell's free-stage edges now.
  const css = readFileSync(fileURLToPath(new URL("../learn.css", import.meta.url)), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const rules: Array<[string, string]> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push([(m[1] ?? "").trim(), m[2] ?? ""]);
  }
  const body = (selector: string) => rules.find(([s]) => s === selector)?.[1] ?? "";

  it("has no layout media queries and none of the old header and panel offsets", () => {
    expect(css).not.toMatch(/@media\s*\(\s*(min|max)-(width|height)/);
    for (const old of ["96px", "152px", "428px", "432px", "368px", "372px", "var(--sh-rail"]) {
      expect({ old, found: css.includes(old) }).toEqual({ old, found: false });
    }
  });

  it("anchors each overlay to the free stage the shell writes: its head, strip and guide", () => {
    expect(body(".ol-tools")).toContain("var(--sh-head)");
    expect(body(".ol-tools")).toContain("var(--sh-guide)");
    expect(body(".ol-note")).toContain("var(--sh-head)");
    expect(body(".ol-note")).toContain("var(--sh-guide)");
    expect(body(".ol-loupe")).toContain("var(--sh-bar)");
    expect(body(".ol-loupe")).toContain("var(--sh-guide)");
    expect(body(".ol-graph")).toContain("var(--sh-head)");
    expect(body(".ol-graph")).toContain("var(--sh-bar)");
    // The graph paper stops left of the guide, with its gap, so it never runs under it.
    expect(body(".ol-graph")).toMatch(/right:\s*calc\(var\(--sh-guide\)\s*\+\s*12px\)/);
  });

  it("puts the toolbar a row below the Compare button on a laptop and on a phone held upright", () => {
    // --sh-head is the foot of the row the Compare button is on, so the toolbar can never lie over it.
    expect(body(".ol-tools")).toMatch(/top:\s*calc\(var\(--sh-head\)\s*\+\s*12px\)/);
    expect(body('.sh-root[data-layout="portrait"] .ol-tools')).toMatch(
      /top:\s*calc\(var\(--sh-head\)\s*\+\s*8px\)/,
    );
  });

  it("a phone held upright with the guide open puts the toolbar on the Compare button's row, out of the window", () => {
    // The window is 234 px tall at 390 x 844, and two rows of buttons lay over the bench. The
    // Compare button is 78 design px down, centred in the player's 54: the toolbar takes the same
    // top, starts beside the button (14 design px in, --tap wide, 8 px of room), and keeps to one row.
    const open = body('.sh-root[data-layout="portrait"][data-guide="open"] .ol-tools');
    expect(open).toMatch(
      /top:\s*calc\(78px\s*\*\s*var\(--ui\)\s*\+\s*\(54px\s*\*\s*var\(--ui\)\s*-\s*var\(--tap\)\)\s*\/\s*2\)/,
    );
    expect(open).toMatch(/left:\s*calc\(14px\s*\*\s*var\(--ui\)\s*\+\s*var\(--tap\)\s*\+\s*8px\)/);
    expect(open).toMatch(/flex-wrap:\s*nowrap/);
    // The graph paper takes the room the toolbar left.
    expect(body('.sh-root[data-layout="portrait"][data-guide="open"] .ol-graph')).toMatch(
      /top:\s*calc\(var\(--sh-head\)\s*\+\s*8px\)/,
    );
  });

  it("a landscape phone puts the toolbar beside the Compare button, clear of its 44 px", () => {
    expect(body('.sh-root[data-layout="short"] .ol-tools')).toMatch(
      /left:\s*calc\(12px\s*\*\s*var\(--ui\)\s*\+\s*52px\)/,
    );
  });
});

describe("applyLayout", () => {
  function fake() {
    const props = new Map<string, string>();
    const el = {
      style: {
        setProperty: (k: string, v: string) => void props.set(k, v),
        removeProperty: (k: string) => void props.delete(k),
      },
      dataset: {} as Record<string, string>,
    };
    return { el: el as unknown as HTMLElement, props, data: el.dataset };
  }

  it("writes the scale, the design size and the mode", () => {
    const { el, props, data } = fake();
    const l = layoutFor(1440, 900);
    applyLayout(el, l);
    expect(Number(props.get("--ui"))).toBeCloseTo(0.8333, 3);
    expect(props.get("--lw")).toBe(`${l.lw}px`);
    expect(props.get("--lh")).toBe(`${l.lh}px`);
    expect(props.get("--label")).toBe(String(l.ui));
    expect(props.has("--scene-bottom")).toBe(false);
    expect(data.layout).toBe("wide");
    expect(data.credit).toBeUndefined();
  });

  it("a phone also writes where the stage ends, and its label scale stays at 0.62", () => {
    const { el, props, data } = fake();
    applyLayout(el, layoutFor(390, 844));
    expect(Number.parseFloat(props.get("--scene-bottom") ?? "")).toBeCloseTo(389.7, 1);
    expect(props.get("--label")).toBe("0.62");
    expect(data.layout).toBe("portrait");
  });

  it("a narrow compact screen folds the credit to its mark; a narrow landscape phone folds the brand", () => {
    const compact = fake();
    applyLayout(compact.el, layoutFor(1024, 768));
    expect(compact.data.layout).toBe("compact");
    expect(compact.data.credit).toBe("mark");
    const short = fake();
    applyLayout(short.el, layoutFor(640, 360));
    expect(short.data.layout).toBe("short");
    expect(short.data.brand).toBe("badge");
    expect(short.props.get("--guide-w")).toBe(`${layoutFor(640, 360).guideW}px`);
  });
});
