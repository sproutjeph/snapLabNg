import type { PartProps } from "./layout";
import { StubBlock } from "./StubBlock";
import { TerminalNut } from "./TerminalNut";

/**
 * Two 1.5 V dry cells in series in a holder (E), terminals E+ and E−. Shows how drained the
 * cells are from `state.current.readout.cellDrain01`. STUB (Wave 0); props frozen.
 */
export function CellHolder({ state, quality, position, rotationY = 0 }: PartProps) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <StubBlock size={[0.14, 0.04, 0.07]} colour="#55606e" />
      <TerminalNut
        id="E+"
        part="cells"
        position={[-0.055, 0.04, 0]}
        state={state}
        quality={quality}
      />
      <TerminalNut
        id="E-"
        part="cells"
        position={[0.055, 0.04, 0]}
        state={state}
        quality={quality}
      />
    </group>
  );
}
