import { PLUG_CONTACT_OHM } from "./constants";

/**
 * Resistance of a plug box: a plug that is in shorts its coil, so R is the sum of
 * the coils whose plug is out, plus the contact resistance. A missing entry in
 * plugsIn counts as a plug that is in.
 */
export function boxOhm(
  valuesOhm: ReadonlyArray<number>,
  plugsIn: ReadonlyArray<boolean>,
  contactOhm: number = PLUG_CONTACT_OHM,
): number {
  let total = contactOhm;
  for (let i = 0; i < valuesOhm.length; i++) {
    if (plugsIn[i] === false) total += valuesOhm[i] ?? 0;
  }
  return total;
}
