import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useState,
} from "react";
import type * as THREE from "three";
import { createTerminalRegistry } from "./terminalRegistry";
import type { PartId, TerminalId, TerminalRegistry } from "./types";

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

/** Registers the object in `ref` as terminal `id` while the component is mounted. */
export function useTerminal(
  id: TerminalId,
  part: PartId,
  label: string,
  ref: RefObject<THREE.Object3D | null>,
): void {
  const registry = useTerminalRegistry();
  useEffect(() => {
    const object = ref.current;
    if (!object) return;
    return registry.register({ id, part, label, object });
  }, [registry, id, part, label, ref]);
}
