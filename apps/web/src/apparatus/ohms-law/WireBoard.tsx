import { cmToX } from "../meter-bridge/dimensions";
import { type PartProps, tapOnly } from "./layout";
import { StubBlock } from "./StubBlock";
import { TerminalNut } from "./TerminalNut";

export interface WireBoardProps extends PartProps {
  /** From the engine's params: the bare wire runs from startCm to startCm + lengthCm on the rule. */
  wire: { lengthCm: number; startCm: number };
  /** Tap the metre rule to open the ruler loupe (step 1). */
  onRuleTap?: () => void;
}

/**
 * The constantan wire XY stretched on a wooden board, brass strips and terminals at X and Y,
 * a metre rule fixed alongside (cm and mm marks). X is at startCm, Y at startCm + lengthCm.
 * STUB (Wave 0); props frozen.
 */
export function WireBoard({
  state,
  quality,
  position,
  rotationY = 0,
  wire,
  onRuleTap,
}: WireBoardProps) {
  const xX = cmToX(wire.startCm);
  const xY = cmToX(wire.startCm + wire.lengthCm);
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <group onPointerDown={tapOnly(onRuleTap)}>
        <StubBlock size={[1.1, 0.025, 0.12]} colour="#a8784a" />
      </group>
      <TerminalNut
        id="X"
        part="wire"
        position={[xX, 0.025, -0.03]}
        state={state}
        quality={quality}
      />
      <TerminalNut
        id="Y"
        part="wire"
        position={[xY, 0.025, -0.03]}
        state={state}
        quality={quality}
      />
    </group>
  );
}
