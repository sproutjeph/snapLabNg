import { PerformanceMonitor } from "@react-three/drei";
import type { ReactNode } from "react";
import { useRef } from "react";
import { createLiteState, resetLite, updateLite } from "./liteCheck";
import { useQuality, useQualityControl } from "./QualityProvider";

const DECLINE_THROTTLE_MS = 3000;

export function QualityMonitor({ children }: { children?: ReactNode }) {
  const { tier, stepDown } = useQuality();
  const { setLiteSuggested } = useQualityControl();
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const lastDeclineAtRef = useRef(0);
  const liteStateRef = useRef(createLiteState());

  return (
    <PerformanceMonitor
      onDecline={(api) => {
        // The lite check runs before the throttle return: onDecline fires on
        // every slow window even once drei's factor has bottomed out at 0,
        // while onChange stops firing then.
        const now = performance.now();
        if (updateLite(liteStateRef.current, tierRef.current, api.averages, now)) {
          setLiteSuggested(true);
        }
        if (now - lastDeclineAtRef.current < DECLINE_THROTTLE_MS) return;
        lastDeclineAtRef.current = now;
        stepDown();
      }}
      onIncline={() => {
        resetLite(liteStateRef.current);
      }}
    >
      {children}
    </PerformanceMonitor>
  );
}
