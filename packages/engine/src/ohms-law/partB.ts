/**
 * Part (b)(ii): the length of a wire from its resistance, R = ρL/A, so L = RA/ρ with A = πd²/4
 * (docs/07 §4.4). Pure; the rules slice uses it to check her answer. Pass π = 22/7 when the
 * question says so.
 */
export function wireLengthFromResistanceM(args: {
  resistanceOhm: number;
  diameterM: number;
  resistivityOhmM: number;
  pi?: number;
}): number {
  const pi = args.pi ?? Math.PI;
  const areaM2 = (pi * args.diameterM * args.diameterM) / 4;
  return (args.resistanceOhm * areaM2) / args.resistivityOhmM;
}
