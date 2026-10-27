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
