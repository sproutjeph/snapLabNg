import { z } from "zod";
import { Box, Confidence, Experiment, Measured } from "./common";

export const ComponentKind = z.enum([
  // meter_bridge
  "bridge_wire",
  "resistance_box",
  "unknown_resistor",
  "galvanometer",
  "jockey",
  "cell",
  "key",
  "protective_resistor",
  "connecting_wire",
  // titration
  "burette",
  "pipette",
  "conical_flask",
  "retort_stand",
  "white_tile",
  "funnel",
  "beaker",
  // glass_block
  "glass_block_outline",
  "normal",
  "incident_ray",
  "refracted_ray",
  "emergent_ray",
  "pin",
  // any
  "other",
]);
export type ComponentKind = z.infer<typeof ComponentKind>;

/** Kinds per experiment. "other" is valid everywhere and is not listed. */
export const COMPONENT_KINDS: Record<
  "meter_bridge" | "titration" | "glass_block",
  readonly ComponentKind[]
> = {
  meter_bridge: [
    "bridge_wire",
    "resistance_box",
    "unknown_resistor",
    "galvanometer",
    "jockey",
    "cell",
    "key",
    "protective_resistor",
    "connecting_wire",
  ],
  titration: [
    "burette",
    "pipette",
    "conical_flask",
    "retort_stand",
    "white_tile",
    "funnel",
    "beaker",
  ],
  glass_block: [
    "glass_block_outline",
    "normal",
    "incident_ray",
    "refracted_ray",
    "emergent_ray",
    "pin",
  ],
};

const MeterBridgeValues = z.strictObject({
  resistances: z.array(Measured),
  unknown_label_as_written: z.string().nullable(),
  cell_type_as_written: z.string().nullable(),
  galvanometer_type_as_written: z.string().nullable(),
});

const TitrationValues = z.strictObject({
  acid_as_written: z.string().nullable(),
  base_as_written: z.string().nullable(),
  acid_concentration: Measured.nullable(),
  base_concentration: Measured.nullable(),
  pipette_volume: Measured.nullable(),
  indicator_as_written: z.string().nullable(),
  equation_as_written: z.string().nullable(),
});

const GlassBlockValues = z.strictObject({
  length: Measured.nullable(),
  width: Measured.nullable(),
  angles_of_incidence: z.array(Measured),
});

export const BlueprintSchema = z.strictObject({
  experiment: Experiment,
  confidence: Confidence,
  components: z.array(
    z.strictObject({
      kind: ComponentKind,
      label_as_written: z.string().nullable(),
      approx_box: Box,
    }),
  ),
  values: z.strictObject({
    meter_bridge: MeterBridgeValues.nullable(),
    titration: TitrationValues.nullable(),
    glass_block: GlassBlockValues.nullable(),
  }),
  setup_issues: z.array(
    z.strictObject({
      description: z.string(),
      rule_code: z.string().nullable(),
    }),
  ),
  notes: z.string(),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;
