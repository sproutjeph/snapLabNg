import { describe, expect, it } from "vitest";
import { ABOUT_SECTIONS } from "./content";

describe("about content", () => {
  it("defines exactly 6 sections in the expected order", () => {
    expect(ABOUT_SECTIONS).toHaveLength(6);
    const ids = ABOUT_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(["what", "how", "honest", "privacy", "built", "credits"]);
  });

  it("ensures every section has a heading and at least one paragraph or bullet", () => {
    for (const section of ABOUT_SECTIONS) {
      expect(section.heading.trim().length).toBeGreaterThan(0);
      const paragraphCount = section.paragraphs.length;
      const bulletCount = section.bullets?.length ?? 0;
      expect(paragraphCount + bulletCount).toBeGreaterThan(0);
    }
  });

  it("leads with Ohm's law in three modes and marks the rest Coming soon", () => {
    const what = ABOUT_SECTIONS.find((s) => s.id === "what");
    expect(what?.paragraphs).toHaveLength(1);
    const text = what?.paragraphs[0] ?? "";
    expect(text).toContain("Ohm's law (V–I)");
    expect(text).toContain("WASSCE 2018 Physics Paper 3, Question 3B");
    expect(text).toContain("Watch");
    expect(text).toContain("Practise");
    expect(text).toContain("Exam");
    expect(text).toContain("Coming soon");
    expect(text).toContain("metre bridge");
  });

  it("credits the engine and rules, and scopes snap to the metre bridge", () => {
    const how = ABOUT_SECTIONS.find((s) => s.id === "how");
    const text = [...(how?.paragraphs ?? []), ...(how?.bullets ?? [])].join(" ");
    expect(text).toContain("packages/engine");
    expect(text).toContain("packages/rules");
    expect(text).toContain("Muse Spark");
    expect(text).toContain("Muse Wonder");
    expect(text).toContain("SAM 3.1");
    expect(text).toContain("metre bridge (/?flow=1)");
    const honest = ABOUT_SECTIONS.find((s) => s.id === "honest");
    const honestText = (honest?.bullets ?? []).join(" ");
    expect(honestText).toContain("never decides marks");
    expect(honestText).toContain("never shows the expected answer");
  });

  it("contains 'official' only in sentences that also contain 'not'", () => {
    const allSentences: string[] = [];

    for (const section of ABOUT_SECTIONS) {
      for (const p of section.paragraphs) {
        // Split paragraphs into sentences approximately by period followed by space or end
        const sentences = p.split(/(?<=[.!?])\s+/);
        allSentences.push(...sentences);
      }
      if (section.bullets) {
        for (const b of section.bullets) {
          const sentences = b.split(/(?<=[.!?])\s+/);
          allSentences.push(...sentences);
        }
      }
    }

    const sentencesWithOfficial = allSentences.filter((sentence) => /official/i.test(sentence));
    expect(sentencesWithOfficial.length).toBeGreaterThan(0);

    for (const sentence of sentencesWithOfficial) {
      expect(sentence.toLowerCase()).toContain("not");
      expect(sentence).toContain("not an official WAEC examiner");
    }
  });
});
