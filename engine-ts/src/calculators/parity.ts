/** Replays evals/calculator_trace.json (Python calculators) through the TS port; same projection as calculators/export.py. */
import { pyStr } from "../py.ts";
import { estimate, downwardAdjustment, gridEf } from "./credits.ts";
import { grossRevenue, priceBand } from "./prices.ts";
import { timeToFirstIssuance } from "./issuance.ts";
import { estimatorInputs, profileEstimate } from "./profile.ts";
import type { CalculatorData, Estimate, IssuanceStats, Param } from "./types.ts";

export interface CalcCall { fn: string; args: Record<string, any>; out: unknown }
export interface CalcTrace { strings: string[]; calls: CalcCall[] }

const label = (param: string, status: unknown) => `${param}|${pyStr(status ?? null)}`;

/** Python trace output with string-table indices expanded. */
export function expandPython(trace: CalcTrace, c: CalcCall): unknown {
  const S = (i: number) => trace.strings[i];
  const o = c.out as any;
  const est = (e: any) => (e && typeof e === "object" && !Array.isArray(e) && "assumptions" in e
    ? { ...e, assumptions: e.assumptions.map(S), warnings: e.warnings.map(S) } : e);
  if (c.fn === "grid_ef") return [o[0], (o[1] as number[]).map(S)];
  if (c.fn === "profile_estimate") return { ...o, estimate: est(o.estimate) };
  return est(o);
}

function projectEstimate(e: Estimate) {
  const { assumptions, warnings, ...other } = e;
  return { ...other, assumptions: assumptions.map((x: { param: string } & Param) => label(x.param, x.status)), warnings };
}

/** TS output for one call, projected like calculators/export.py (errors -> {error}). */
export function runTs(d: CalculatorData, stats: IssuanceStats, c: CalcCall): unknown {
  const a = c.args;
  try {
    switch (c.fn) {
      case "grid_ef": {
        const [ef, used] = gridEf(d, a.standard, a.technology, a.start_year);
        return [ef, Object.entries(used).map(([k, v]) => label(k, v.status))];
      }
      case "downward_adjustment": {
        const [avg, p, m] = downwardAdjustment(d, a.standard, a.methodology, a.crediting_years);
        return [avg, p ? p.status : null, m];
      }
      case "estimate": {
        const { sector, standard, ...rest } = a;
        return projectEstimate(estimate(d, sector, standard, rest));
      }
      case "profile_estimate": {
        const r = estimatorInputs(d, a.profile);
        if (r.missing.length) return { ...r, estimate: null };
        let e: unknown;
        try {
          e = projectEstimate(profileEstimate(d, a.profile, a.standard, a.code).estimate!);
        } catch (err) {
          e = { error: (err as Error).message.split(":")[0] };
        }
        return { ...r, estimate: e };
      }
      case "price_band": return priceBand(d, a.standard, a.sector, a.today);
      case "gross_revenue": return grossRevenue(a.credits_per_year, a.band);
      case "time_to_first_issuance": return timeToFirstIssuance(d, stats, a.standard, a.methodology_code, a.sector);
      default: throw new Error(`unknown calculator call ${c.fn}`);
    }
  } catch (e) {
    return { error: (e as Error).message.split(":")[0] };
  }
}
