import { describe, expect, it } from "vitest";
import { modeFrom } from "./previewMode";

describe("modeFrom (?director=1&mode=)", () => {
  it("takes both spellings of Practise, and falls back on Watch only for the unknown", () => {
    expect(modeFrom("practice")).toBe("practice");
    expect(modeFrom("practise")).toBe("practice");
    expect(modeFrom("exam")).toBe("exam");
    expect(modeFrom("watch")).toBe("watch");
    expect(modeFrom(null)).toBe("watch");
    expect(modeFrom("nonsense")).toBe("watch");
  });
});
