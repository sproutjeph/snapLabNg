import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { QualityTier } from "../apparatus/meter-bridge/types";
import { readDeviceSignals } from "./signals";
import type { DeviceSignals, QualitySettings } from "./tier";
import { chooseTier, parseOverride, settingsFor, stepDown as stepDownTier } from "./tier";
import { measureWarmupFps } from "./warmup";

export interface QualityContextValue {
  tier: QualityTier;
  settings: QualitySettings;
  stepDown: () => void;
  liteSuggested: boolean;
  /** The signals and warm-up fps the tier was chosen from; null until measured. */
  signals: DeviceSignals | null;
}

interface QualityControl {
  setLiteSuggested: (value: boolean) => void;
}

const QualityContext = createContext<QualityContextValue | null>(null);
const QualityControlContext = createContext<QualityControl | null>(null);

export function useQuality(): QualityContextValue {
  const value = useContext(QualityContext);
  if (!value) throw new Error("useQuality must be used inside <QualityProvider>");
  return value;
}

export function useQualityControl(): QualityControl {
  const value = useContext(QualityControlContext);
  if (!value) throw new Error("useQualityControl must be used inside <QualityProvider>");
  return value;
}

export function QualityProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<QualityTier>("mid");
  const [liteSuggested, setLiteSuggested] = useState(false);
  const [signals, setSignals] = useState<DeviceSignals | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    const override = parseOverride(window.location.search);
    if (override !== null) {
      resolvedRef.current = true;
      setTier(override);
    }
    let cancelled = false;
    void (async () => {
      const detected = readDeviceSignals();
      const warmupFps = await measureWarmupFps(2000);
      if (cancelled) return;
      const used: DeviceSignals = { ...detected, warmupFps };
      setSignals(used);
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setTier(chooseTier(used));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stepDown = useCallback(() => {
    setTier((current) => stepDownTier(current));
  }, []);

  const value = useMemo<QualityContextValue>(
    () => ({ tier, settings: settingsFor(tier), stepDown, liteSuggested, signals }),
    [tier, stepDown, liteSuggested, signals],
  );
  const control = useMemo<QualityControl>(() => ({ setLiteSuggested }), []);

  return (
    <QualityContext.Provider value={value}>
      <QualityControlContext.Provider value={control}>{children}</QualityControlContext.Provider>
    </QualityContext.Provider>
  );
}
