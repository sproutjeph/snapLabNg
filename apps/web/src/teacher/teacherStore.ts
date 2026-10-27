export const TEACHER_STORAGE_KEY = "snaplab.teacher.v1";

export interface TeacherState {
  enabled: boolean;
  xOhm: number | null;
}

const DISABLED: TeacherState = { enabled: false, xOhm: null };

function isValidXOhm(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 10_000;
}

/**
 * Parses a teacher-entered resistance in ohms.
 * Accepts "3", "3.0", "3.0 Ω", "3 ohms" and "3,0" (comma decimal).
 * Rejects values <= 0, > 10,000 and non-numbers.
 */
export function parseOhms(text: string): number | null {
  if (typeof text !== "string") return null;
  let s = text.trim().toLowerCase();
  if (!s) return null;
  // Strip ohm symbol (Ω lowercases to ω) and trailing unit words.
  s = s.replace(/ω/g, "").trim();
  if (s.endsWith("ohms")) s = s.slice(0, -4).trim();
  else if (s.endsWith("ohm")) s = s.slice(0, -3).trim();
  s = s.replace(/ω/g, "").trim();
  if (!s) return null;
  // Comma decimal separator, e.g. "3,0" -> "3.0". Only a single comma is allowed.
  if ((s.match(/,/g) ?? []).length > 1) return null;
  s = s.replace(",", ".");
  // Must be a plain decimal number.
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  if (value <= 0 || value > 10_000) return null;
  return value;
}

export function loadTeacher(): TeacherState {
  try {
    const raw = localStorage.getItem(TEACHER_STORAGE_KEY);
    if (!raw) return { ...DISABLED };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...DISABLED };
    const record = parsed as Record<string, unknown>;
    const enabled = record.enabled === true;
    const xOhm = isValidXOhm(record.xOhm) ? record.xOhm : null;
    return { enabled, xOhm };
  } catch {
    return { ...DISABLED };
  }
}

export function saveTeacher(state: TeacherState): void {
  try {
    const payload: TeacherState = {
      enabled: state.enabled === true,
      xOhm: isValidXOhm(state.xOhm) ? state.xOhm : null,
    };
    localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage missing or blocked: behave as disabled, never throw.
  }
}

export function clearTeacher(): void {
  try {
    localStorage.removeItem(TEACHER_STORAGE_KEY);
  } catch {
    // Ignore: storage unavailable.
  }
}
