import { useEffect } from "react";
import type { QualityTier } from "../../apparatus/meter-bridge/types";
import { RestingLead, restBookOf } from "../../apparatus/ohms-law/Lead";
import { LEAD_REST } from "../../apparatus/ohms-law/layout";
import type { OhmsLawBench } from "../types";
import type { StageMotion } from "./stageMotion";

// The leads as apparatus (docs/plans/beauty-pass.md, Step 0 item 2): every lead the practical
// needs lies in its rest place on the bench (apparatus/ohms-law/layout.ts LEAD_REST), drops in
// one by one after the parts (the entrance, Choreo.tsx), is lifted from there when a lead is made
// (Lead.tsx flies it to its terminals) and flies back when it is removed. Inside the Canvas, under
// a <TerminalProvider>, beside <BenchWiring>.

export interface RestLeadsProps {
  bench: OhmsLawBench;
  quality: QualityTier;
  /** The entrance's drops and the loop's flags; without it every lead lies in place. */
  motion?: Pick<StageMotion, "restLeads" | "busy" | "moving"> | undefined;
}

export function RestLeads({ bench, quality, motion }: RestLeadsProps) {
  // While this layer is mounted the bench's leads come from (and go back to) the rest places.
  useEffect(() => {
    const rest = restBookOf(bench.visual);
    rest.on++;
    return () => {
      rest.on--;
    };
  }, [bench]);
  return (
    <group>
      {LEAD_REST.map((r, i) => (
        <RestingLead
          key={`rest-${r.x}`}
          slot={i}
          state={bench.visual}
          quality={quality}
          drop={motion?.restLeads[i]}
          awake={motion}
        />
      ))}
    </group>
  );
}
