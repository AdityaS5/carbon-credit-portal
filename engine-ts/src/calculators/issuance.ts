/** Time to first issuance lookup: port of calculators/issuance.time_to_first_issuance over issuance_stats.json. */
import { pyEq } from "../py.ts";
import type { CalculatorData, IssuanceStats } from "./types.ts";

/** Most specific row with n >= MIN_N: methodology -> CDM parent -> sector -> standard. */
export function timeToFirstIssuance(d: CalculatorData, stats: IssuanceStats, standard: string,
                                    methodologyCode?: string | null, sector?: string | null) {
  if (d.issuance.NO_REGISTRY_EXPORT.includes(standard)) {
    return { standard, start_to_first_issuance_months: null, confidence: "none",
      note: `No ${standard} issuance history to compute from yet.` };
  }
  const parent = d.issuance.PARENT[(methodologyCode || "").toUpperCase()] ?? null;
  const levels: [string, (string | null)[]][] = [["methodology", [standard, methodologyCode ?? null]],
    ["parent", [standard, parent]], ["sector", [standard, sector ?? null]], ["standard", [standard]]];
  for (const [level, key] of levels) {
    const lvl = level === "parent" ? "methodology" : level;
    for (const r of stats.rows) {
      if (r.level === lvl && pyEq(r.key, key) && !key.includes(null)) return { ...r, confidence: "medium", fallback_level: level };
    }
  }
  return null;
}
