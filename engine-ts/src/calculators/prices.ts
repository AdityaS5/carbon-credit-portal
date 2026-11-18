/** Indicative price bands: port of calculators/prices.py (bands in calculator_data.json). */
import { pyRound } from "./num.ts";
import type { CalculatorData, PriceBand, Range } from "./types.ts";

const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

export type PriceBandOut = PriceBand & { age_days: number; stale: boolean; confidence: "low" };

/** today: ISO date "YYYY-MM-DD" (defaults to today, UTC). Lookup: (standard, sector) -> (standard, *) -> (*, sector). */
export function priceBand(d: CalculatorData, standard: string, sector: string, today?: string): PriceBandOut | null {
  const t = today ?? new Date().toISOString().slice(0, 10);
  for (const [s, sec] of [[standard, sector], [standard, "*"], ["*", sector]]) {
    const b = d.prices.BANDS.find((x) => x.key[0] === s && x.key[1] === sec);
    if (b) {
      const age = days(b.as_of, t);
      return { ...b, age_days: age, stale: age > d.prices.STALE_AFTER_DAYS, confidence: "low" };
    }
  }
  return null;
}

/** Gross annual revenue range; excludes registry levies, VVB and broker costs. */
export function grossRevenue(creditsPerYear: Range | null | undefined, band: PriceBand | null | undefined) {
  if (!creditsPerYear || !band || band.central === null) return null;
  return { low: pyRound(creditsPerYear.low * band.low!), central: pyRound(creditsPerYear.central * band.central),
    high: pyRound(creditsPerYear.high * band.high!), currency: band.currency };
}
