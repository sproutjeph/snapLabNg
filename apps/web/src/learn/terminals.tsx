import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type * as THREE from "three";
import { createTerminalRegistry } from "./terminalRegistry";
import type { PartId, Terminal, TerminalId, TerminalRegistry } from "./types";

const TerminalContext = createContext<TerminalRegistry | null>(null);

export function TerminalProvider({
  registry,
  children,
}: {
  registry?: TerminalRegistry;
  children: ReactNode;
}) {
  const [own] = useState(createTerminalRegistry);
  return <TerminalContext.Provider value={registry ?? own}>{children}</TerminalContext.Provider>;
}

export function useTerminalRegistry(): TerminalRegistry {
  const r = useContext(TerminalContext);
  if (!r) throw new Error("useTerminalRegistry needs a <TerminalProvider>");
  return r;
}

/**
 * Registers the object in `ref` as terminal `id` while the component is mounted. Checks after
 * every render, so a remounted attach object (same id, new Object3D) replaces the old one.
 * Keep the ref and this hook in the same component (as TerminalNut does).
 */
export function useTerminal(
  id: TerminalId,
  part: PartId,
  label: string,
  ref: RefObject<THREE.Object3D | null>,
): void {
  const registry = useTerminalRegistry();
  const current = useRef<{ terminal: Terminal; registry: TerminalRegistry; off: () => void }>(null);
  useEffect(() => {
    const object = ref.current;
    const had = current.current;
    if (
      had &&
      had.registry === registry &&
      had.terminal.object === object &&
      had.terminal.id === id &&
      had.terminal.part === part &&
      had.terminal.label === label
    ) {
      return;
    }
    had?.off();
    current.current = null;
    if (!object) return;
    const terminal: Terminal = { id, part, label, object };
    current.current = { terminal, registry, off: registry.register(terminal) };
  });
  useEffect(
    () => () => {
      current.current?.off();
      current.current = null;
    },
    [],
  );
}
