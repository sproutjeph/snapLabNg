import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// docs/plans/exam-redesign.md, "Where bench truth lives": `supervisor` is the bench's own truth
// and must never reach a student-facing screen. Only these paths may name it in code: the script
// and results folders, the bench that builds it, and the contract that declares it. Tests may.
// No textbook source: this is a code-boundary check, so it tests behaviour only.

const SRC = __dirname;
const ALLOWED_DIRS = ["learn/script/", "learn/results/"];
const ALLOWED_FILES = ["learn/wiring/bench.ts", "learn/types.ts"];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/**
 * The source with its // and block comments blanked out. Strings are kept (so `bench["supervisor"]`
 * is still seen) and are skipped over while looking for comments, so "http://…" is not a comment.
 */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      out += " ";
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Whether code (not a comment) names `supervisor`: a member, a destructuring or a bracket key. */
const namesSupervisor = (src: string): boolean => /\bsupervisor\b/.test(stripComments(src));

describe("bench supervisor boundary", () => {
  it("is named in code only under learn/script, learn/results, in bench.ts, types.ts and tests", () => {
    const offenders = files(SRC)
      .map((f) => relative(SRC, f).split(sep).join("/"))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => !ALLOWED_DIRS.some((a) => f.startsWith(a)) && !ALLOWED_FILES.includes(f))
      .filter((f) => namesSupervisor(readFileSync(join(SRC, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("flags the member, destructuring and bracket forms", () => {
    expect(namesSupervisor("const s = bench.supervisor;")).toBe(true);
    expect(namesSupervisor("const { supervisor } = bench;")).toBe(true);
    expect(namesSupervisor("const { supervisor: s } = bench;")).toBe(true);
    expect(namesSupervisor('const s = bench["supervisor"];')).toBe(true);
    expect(namesSupervisor("const s = bench['supervisor'];")).toBe(true);
    expect(namesSupervisor('const url = "http://x"; const s = bench.supervisor;')).toBe(true);
  });

  it("ignores the word in comments and in longer names", () => {
    expect(namesSupervisor("// the supervisor's log\nconst a = 1;")).toBe(false);
    expect(namesSupervisor("/* the supervisor\n sees it */ const a = 1;")).toBe(false);
    expect(namesSupervisor("const supervisors = 1; const supervisorLog = 2;")).toBe(false);
  });
});
