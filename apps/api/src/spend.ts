import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** List prices, USD (docs/06 §3). Tokens are per million; SAM is per image. */
const PRICES: Record<string, { inPerM: number; outPerM: number } | { perImage: number }> = {
  "muse-spark-1.3": { inPerM: 1.25, outPerM: 4.25 },
  "muse-wonder-1.0": { inPerM: 4, outPerM: 20 },
  "sam-3.1": { perImage: 2.5 / 1000 },
};

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  images_processed?: number;
}

/** Cost of one call from the usage Meta reported. Unknown models cost as Wonder, to stay safe. */
export function costUsd(model: string, usage: Usage | null | undefined): number {
  const price = PRICES[model] ?? PRICES["muse-wonder-1.0"];
  if (!price || !usage) return 0;
  if ("perImage" in price) return (usage.images_processed ?? 1) * price.perImage;
  return (
    ((usage.input_tokens ?? 0) * price.inPerM + (usage.output_tokens ?? 0) * price.outPerM) / 1e6
  );
}

/** Output caps sent with every call, so the reserve below really is the worst case. */
export const MAX_OUTPUT_TOKENS = { spark: 3000, wonder: 6000 } as const;
/** Input tokens for one page image plus prompt and schema (≈4,060 measured on Oct 26), with margin. */
const MAX_INPUT_TOKENS = 6000;
const SAM_CALLS_PER_SNAP = 7;

/**
 * Worst case for one snap, reserved before any call: Spark and Wonder at their output caps
 * plus every SAM image. About $0.19; a typical snap costs about $0.10 (Oct 26).
 */
export const SNAP_RESERVE_USD =
  costUsd("muse-spark-1.3", {
    input_tokens: MAX_INPUT_TOKENS,
    output_tokens: MAX_OUTPUT_TOKENS.spark,
  }) +
  costUsd("muse-wonder-1.0", {
    input_tokens: MAX_INPUT_TOKENS,
    output_tokens: MAX_OUTPUT_TOKENS.wonder,
  }) +
  costUsd("sam-3.1", { images_processed: SAM_CALLS_PER_SNAP });

interface LedgerFile {
  totalUsd: number;
  day: string;
  dayUsd: number;
}

/**
 * A hard spend cap. Meta's own limit only notifies (docs/01 §0 rule 9), so every live
 * call reserves its worst case first and is refused if either cap would be passed.
 * Kept in a JSON file so a restart doesn't reset it (no database).
 */
export class SpendLedger {
  private data: LedgerFile;
  private reservedUsd = 0;

  constructor(
    private readonly path: string,
    private readonly capUsd: number,
    private readonly dailyCapUsd: number,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {
    this.data = existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as LedgerFile)
      : { totalUsd: 0, day: today(), dayUsd: 0 };
  }

  private rollDay(): void {
    const d = this.today();
    if (this.data.day !== d) this.data = { ...this.data, day: d, dayUsd: 0 };
  }

  /** Reserves `usd`; returns false (and reserves nothing) if a cap would be passed. */
  reserve(usd: number): boolean {
    this.rollDay();
    const total = this.data.totalUsd + this.reservedUsd + usd;
    const day = this.data.dayUsd + this.reservedUsd + usd;
    if (total > this.capUsd || day > this.dailyCapUsd) return false;
    this.reservedUsd += usd;
    return true;
  }

  /** Releases a reservation and records what was actually spent. */
  settle(reservedUsd: number, actualUsd: number): void {
    this.rollDay();
    this.reservedUsd = Math.max(0, this.reservedUsd - reservedUsd);
    this.data.totalUsd += actualUsd;
    this.data.dayUsd += actualUsd;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(this.data)}\n`);
  }

  summary() {
    this.rollDay();
    return {
      totalUsd: round(this.data.totalUsd),
      todayUsd: round(this.data.dayUsd),
      capUsd: this.capUsd,
      dailyCapUsd: this.dailyCapUsd,
    };
  }
}

function round(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
