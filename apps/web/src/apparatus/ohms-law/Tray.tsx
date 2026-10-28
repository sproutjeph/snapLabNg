import type { PartProps } from "./layout";
import { StubBlock } from "./StubBlock";

export type TrayItem = "leads" | "sandpaper" | "rheostat" | "micrometer";

export interface TrayProps extends PartProps {
  onItemTap?: (item: TrayItem) => void;
}

/**
 * The side tray: spare leads (with two crocodile clips), a sandpaper strip, and the rheostat
 * and micrometer screw gauge (Identify only). STUB (Wave 0); props frozen.
 */
export function Tray({ position, rotationY = 0 }: TrayProps) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={rotationY}>
      <StubBlock size={[0.22, 0.01, 0.3]} colour="#d9cfbb" />
    </group>
  );
}
