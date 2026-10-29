import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// docs/plans/exam-redesign.md, "Where bench truth lives": `.supervisor` is the bench's own truth
// and must never reach a student-facing screen, so only these folders may read it.

const SRC = __dirname;
const ALLOWED = ["learn/script/", "learn/results/", "learn/wiring/"];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("bench supervisor boundary", () => {
  it("is read only under learn/script, learn/results, learn/wiring and in tests", () => {
    const offenders = files(SRC)
      .map((f) => relative(SRC, f).split(sep).join("/"))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => !ALLOWED.some((a) => f.startsWith(a)))
      .filter((f) => /\.supervisor\b/.test(readFileSync(join(SRC, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
