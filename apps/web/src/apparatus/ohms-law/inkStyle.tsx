import type { ReactNode } from "react";
import { InkGroup } from "../../scene/ink/ink";

// Per-part ink weight for the V–I bench (docs/plans/wave-2-lean.md, row 2a-real; Backcountry
// 101 draws its tinder at .65 and its rope at .55). A part sets `userData.inkStrength` once on a
// group round its InkGroup (the ink pass reads it from the nearest ancestor, scene/ink/inkPass.ts)
// and is tagged `thin`, so fine things (the bridge wire, labels, the dial's scale) draw softer,
// lighter lines than the bodies they sit on.

/** A group's userData for a soft line: `{ inkStrength }`. */
export interface InkSoft {
  readonly inkStrength: number;
}

/** The soft parts and their ink strength. Every one is also tagged thin. */
export const INK_SOFT = {
  /** The resistance wire stretched over the board, like a metre bridge's. */
  wire: { inkStrength: 0.55 },
  /** The metre rule under the wire, with its printed scale. */
  rule: { inkStrength: 0.65 },
  /** A meter's dial card (the scale ticks and numbers). */
  dial: { inkStrength: 0.6 },
  /** The mirror strip under a meter's scale. */
  mirror: { inkStrength: 0.6 },
  /** Paper tags: the key's "K", the cells' + and −. */
  label: { inkStrength: 0.6 },
} as const satisfies Record<string, InkSoft>;

/**
 * A thin, soft-lined piece of a part: its meshes take ink `id`, tagged thin, under a group whose
 * userData carries the strength. Holds no hooks, so it can be called as a plain function.
 */
export function SoftInk({
  soft,
  id,
  children,
}: {
  soft: InkSoft;
  id: number;
  children: ReactNode;
}) {
  return (
    <group userData={{ ...soft }}>
      <InkGroup id={id} thin>
        {children}
      </InkGroup>
    </group>
  );
}
