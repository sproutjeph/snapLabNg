import { createContext, useContext } from "react";
import type { QualityTier } from "../../apparatus/meter-bridge/types";

// The quality tier for the look's components, whose props are frozen (scene/look/types.ts). The
// canvas that uses the look wraps its scene in <LookTier.Provider value={tier}>. Without a
// provider the look assumes "high"; the lights also follow the canvas's own `shadows` switch,
// so a canvas without shadows never builds a shadow map.

export const LookTier = createContext<QualityTier>("high");

export function useLookTier(): QualityTier {
  return useContext(LookTier);
}
