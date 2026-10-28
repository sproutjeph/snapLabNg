import type * as THREE from "three";
import type { Terminal, TerminalId, TerminalRegistry } from "./types";

/** The bench's terminal registry: parts register their nuts, wiring reads them and handles taps. */
export function createTerminalRegistry(): TerminalRegistry {
  const terminals = new Map<TerminalId, Terminal>();
  let onTap: ((id: TerminalId) => void) | null = null;
  return {
    register(t) {
      terminals.set(t.id, t);
      return () => {
        if (terminals.get(t.id) === t) terminals.delete(t.id);
      };
    },
    get: (id) => terminals.get(id),
    worldPosition(id, out: THREE.Vector3) {
      const t = terminals.get(id);
      if (!t) return false;
      t.object.getWorldPosition(out);
      return true;
    },
    all: () => terminals.values(),
    tap(id) {
      onTap?.(id);
    },
    setTapHandler(fn) {
      onTap = fn;
    },
  };
}
