import { RuleCode } from "@snaplab/contracts";
import { describe, expect, it } from "vitest";
import { itemWords, ruleWords } from "./RedInkOverlay";

describe("plain words for marks", () => {
  it("has words for every rule, never the bare code", () => {
    for (const rule of RuleCode.options) {
      expect(ruleWords(rule)).not.toBe(rule);
      expect(ruleWords(rule)).not.toMatch(/^[A-Z]+-/);
    }
  });

  it("names the table's parts", () => {
    const item = (id: string) => ({ id, rule: "PHYS-TABLE" }) as Parameters<typeof itemWords>[0];
    expect(itemWords(item("PHYS-TABLE:units-X"))).toBe("Units in the headings");
    expect(itemWords(item("PHYS-TABLE:columns"))).toBe("Table columns");
  });
});
