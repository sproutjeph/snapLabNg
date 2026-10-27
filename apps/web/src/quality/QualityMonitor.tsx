import { PerformanceMonitor } from "@react-three/drei";
import type { ReactNode } from "react";
import { useRef } from "react";
import { useQuality, useQualityControl } from "./QualityProvider";

const DECLINE_THROTTLE_MS = 3000;
const LITE_FPS_LIMIT = 20;
const LITE_HOLD_MS = 5000;

export function QualityMonitor({ children }: { children?: ReactNode }) {
  const { tier, stepDown } = useQuality();
  const { setLiteSuggested } = useQualityControl();
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const lastDeclineAtRef = useRef(0);
  const lowSinceRef = useRef<number | null>(null);

  return (
    <PerformanceMonitor
      onDecline={() => {
        const now = performance.now();
        if (now - lastDeclineAtRef.current < DECLINE_THROTTLE_MS) return;
        lastDeclineAtRef.current = now;
        stepDown();
      }}
      onChange={({ fps }) => {
        if (tierRef.current === "low" && fps < LITE_FPS_LIMIT) {
          const now = performance.now();
          if (lowSinceRef.current === null) lowSinceRef.current = now;
          if (now - lowSinceRef.current >= LITE_HOLD_MS) setLiteSuggested(true);
        } else {
          lowSinceRef.current = null;
        }
      }}
    >
      {children}
    </PerformanceMonitor>
  );
}
