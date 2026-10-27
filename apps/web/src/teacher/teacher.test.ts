import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTeacher,
  loadTeacher,
  parseOhms,
  saveTeacher,
  TEACHER_STORAGE_KEY,
} from "./teacherStore";
import { exposedXOhm, type TeacherInternalState, teacherReducer } from "./useTeacher";

class FakeStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

describe("parseOhms", () => {
  it('parses "3" as 3', () => {
    expect(parseOhms("3")).toBe(3);
  });

  it('parses "3.0 Ω" as 3', () => {
    expect(parseOhms("3.0 Ω")).toBe(3);
  });

  it('parses "3 ohms" as 3', () => {
    expect(parseOhms("3 ohms")).toBe(3);
  });

  it('parses "3,0" with a comma decimal as 3', () => {
    expect(parseOhms("3,0")).toBe(3);
  });

  it('parses "3.0" as 3', () => {
    expect(parseOhms("3.0")).toBe(3);
  });

  it('rejects "0" as null', () => {
    expect(parseOhms("0")).toBeNull();
  });

  it('rejects "-2" as null', () => {
    expect(parseOhms("-2")).toBeNull();
  });

  it('rejects "abc" as null', () => {
    expect(parseOhms("abc")).toBeNull();
  });

  it('rejects "20000" above 10,000 as null', () => {
    expect(parseOhms("20000")).toBeNull();
  });
});

describe("teacher store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new FakeStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("save then load round-trips the teacher value", () => {
    saveTeacher({ enabled: true, xOhm: 3 });
    expect(loadTeacher()).toEqual({ enabled: true, xOhm: 3 });
    saveTeacher({ enabled: false, xOhm: 2.5 });
    expect(loadTeacher()).toEqual({ enabled: false, xOhm: 2.5 });
  });

  it("clear removes the stored value", () => {
    saveTeacher({ enabled: true, xOhm: 3 });
    clearTeacher();
    expect(loadTeacher()).toEqual({ enabled: false, xOhm: null });
    expect(
      (globalThis as unknown as { localStorage: FakeStorage }).localStorage.getItem(
        TEACHER_STORAGE_KEY,
      ),
    ).toBeNull();
  });

  it("returns disabled when localStorage throws on access and save does not throw", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("localStorage", throwing);
    expect(loadTeacher()).toEqual({ enabled: false, xOhm: null });
    expect(() => saveTeacher({ enabled: true, xOhm: 3 })).not.toThrow();
    expect(() => clearTeacher()).not.toThrow();
  });
});

describe("teacher reducer (hook logic)", () => {
  it("exposes xOhm as null while disabled, even when a value is stored", () => {
    const stored: TeacherInternalState = { enabled: false, storedXOhm: 3 };
    expect(exposedXOhm(stored)).toBeNull();
    const enabled = teacherReducer(stored, { type: "enable" });
    expect(exposedXOhm(enabled)).toBe(3);
    const disabledAgain = teacherReducer(enabled, { type: "disable" });
    expect(disabledAgain.storedXOhm).toBe(3);
    expect(exposedXOhm(disabledAgain)).toBeNull();
  });

  it("stores a new value without exposing it while disabled", () => {
    const start: TeacherInternalState = { enabled: false, storedXOhm: null };
    const afterSet = teacherReducer(start, { type: "set", value: 4.5 });
    expect(afterSet.storedXOhm).toBe(4.5);
    expect(exposedXOhm(afterSet)).toBeNull();
  });

  it("clear drops the stored value and disables teacher mode", () => {
    const start: TeacherInternalState = { enabled: true, storedXOhm: 3 };
    const cleared = teacherReducer(start, { type: "clear" });
    expect(cleared).toEqual({ enabled: false, storedXOhm: null });
    expect(exposedXOhm(cleared)).toBeNull();
  });
});
