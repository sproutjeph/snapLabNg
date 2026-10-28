import type { ThreeEvent } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { useTerminal, useTerminalRegistry } from "../../learn/terminals";
import type { OhmsLawVisualState, PartId, TerminalId } from "../../learn/types";
import type { QualityTier } from "../meter-bridge/types";
import { TERMINAL_LABELS } from "./layout";

export interface TerminalNutProps {
  id: TerminalId;
  part: PartId;
  /** Local position inside the parent part, at the foot of the nut. */
  position: readonly [number, number, number];
  state: { current: OhmsLawVisualState };
  quality: QualityTier;
  /** Insulated caps on the meters: red for +, black for −. Brass everywhere else. */
  cap?: "brass" | "red" | "black";
}

// Hit target radius: generous so a thumb on a phone finds the nut (≥ 44 px at bench zoom).
const HIT_RADIUS_M = 0.02;

/**
 * A knurled terminal nut that lead ends attach to. Registers itself in the terminal registry
 * and forwards taps to it. STUB (Wave 0): a plain cylinder; apparatus slice 2 models it.
 * Props frozen.
 */
export function TerminalNut({ id, part, position, cap = "brass" }: TerminalNutProps) {
  const attach = useRef<THREE.Object3D>(null);
  const registry = useTerminalRegistry();
  useTerminal(id, part, TERMINAL_LABELS[id], attach);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    registry.tap(id);
  };
  const colour = cap === "red" ? "#b3261e" : cap === "black" ? "#1d1d1f" : "#b08d3c";
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.007}>
        <cylinderGeometry args={[0.006, 0.006, 0.014, 12]} />
        <meshStandardMaterial color={colour} roughness={0.5} />
      </mesh>
      <object3D ref={attach} position-y={0.014} />
      <mesh position-y={0.01} onPointerDown={onDown} visible={false}>
        <sphereGeometry args={[HIT_RADIUS_M, 8, 6]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
