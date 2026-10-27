import { useCallback, useReducer, useRef } from "react";
import { clearTeacher, loadTeacher, parseOhms, saveTeacher } from "./teacherStore";

/**
 * Internal state keeps the stored value even while teacher mode is off,
 * so the pure reducer can be tested for the "hidden while disabled" rule.
 * The hook only exposes `xOhm` while `enabled` is true.
 */
export interface TeacherInternalState {
  enabled: boolean;
  storedXOhm: number | null;
}

export type TeacherAction =
  | { type: "enable" }
  | { type: "disable" }
  | { type: "set"; value: number }
  | { type: "clear" }
  | { type: "hydrate"; enabled: boolean; xOhm: number | null };

export function teacherReducer(
  state: TeacherInternalState,
  action: TeacherAction,
): TeacherInternalState {
  switch (action.type) {
    case "enable":
      return { ...state, enabled: true };
    case "disable":
      return { ...state, enabled: false };
    case "set":
      return { ...state, storedXOhm: action.value };
    case "clear":
      return { enabled: false, storedXOhm: null };
    case "hydrate":
      return { enabled: action.enabled, storedXOhm: action.xOhm };
    default:
      return state;
  }
}

/** The value visible to the rest of the app: null unless teacher mode is on. */
export function exposedXOhm(state: TeacherInternalState): number | null {
  return state.enabled ? state.storedXOhm : null;
}

export interface UseTeacherResult {
  enabled: boolean;
  xOhm: number | null;
  enable: () => void;
  disable: () => void;
  setX: (text: string) => boolean;
  clear: () => void;
}

function initTeacher(): TeacherInternalState {
  const loaded = loadTeacher();
  return { enabled: loaded.enabled, storedXOhm: loaded.xOhm };
}

export function useTeacher(): UseTeacherResult {
  const [state, dispatch] = useReducer(
    teacherReducer,
    { enabled: false, storedXOhm: null } as TeacherInternalState,
    () => initTeacher(),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const apply = useCallback((action: TeacherAction) => {
    const next = teacherReducer(stateRef.current, action);
    stateRef.current = next;
    dispatch(action);
    return next;
  }, []);

  const enable = useCallback(() => {
    const next = apply({ type: "enable" });
    saveTeacher({ enabled: next.enabled, xOhm: next.storedXOhm });
  }, [apply]);

  const disable = useCallback(() => {
    const next = apply({ type: "disable" });
    saveTeacher({ enabled: next.enabled, xOhm: next.storedXOhm });
  }, [apply]);

  const setX = useCallback(
    (text: string): boolean => {
      const value = parseOhms(text);
      if (value === null) return false;
      const next = apply({ type: "set", value });
      saveTeacher({ enabled: next.enabled, xOhm: next.storedXOhm });
      return true;
    },
    [apply],
  );

  const clear = useCallback(() => {
    apply({ type: "clear" });
    clearTeacher();
  }, [apply]);

  return {
    enabled: state.enabled,
    xOhm: exposedXOhm(state),
    enable,
    disable,
    setX,
    clear,
  };
}
