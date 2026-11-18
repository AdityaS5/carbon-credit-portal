/**
 * Output ladder (project brief): five rungs per route, confidence falling down the list.
 * Port of the Streamlit UI's ui/estimates.ladder() on top of the TS calculators. Numbers come only from the
 * calculators and synced data; a rung with no data says so instead of showing a placeholder number.
 * Change from ui/estimates.py (decisions log, 19 Nov): the certification-cost tag is the worst status of its
 * parts, so Verra fees (sourced) with the VVB fee unset show "not connected yet".
 */
import { grossRevenue, priceBand, profileEstimate, timeToFirstIssuance } from "@/engine-ts/src/calculators/index.ts";
import type { Estimate, Range } from "@/engine-ts/src/calculators/types.ts";
import type { Route } from "@/engine-ts/src/pipeline.ts";
import type { Profile } from "@/engine-ts/src/types.ts";
import { CALC, ISSUANCE, today } from "./data.ts";
import { VERDICT } from "./labels.ts";

export type Status = "sourced" | "verify" | "assumption" | "not_connected" | "none";
export type Confidence = "high" | "medium–high" | "medium" | "low–medium" | "low";

export interface Rung {
  key: "eligibility" | "credits" | "issuance" | "cost" | "price";
  label: string;
  value: string | null; // headline; null = no figure
  detail: string;
  confidence: Confidence | null; // null when there is no figure to be confident about
  status: Status;
}

export const LADDER: [Rung["key"], string, Confidence][] = [
  ["eligibility", "Eligible route", "high"],
  ["credits", "Credits per year", "medium–high"],
  ["issuance", "Time to first issuance", "medium"],
  ["cost", "Certification cost", "low–medium"],
  ["price", "Indicative price & gross revenue", "low"],
];
export const SEGMENTS: Record<Confidence, number> = { high: 5, "medium–high": 4, medium: 3, "low–medium": 2, low: 1 };
const CALC_CONFIDENCE: Record<string, Confidence> = { medium_high: "medium–high", medium: "medium", low: "low" };
const STATUS_RANK: Status[] = ["sourced", "verify", "assumption", "not_connected", "none"];
const worst = (xs: Status[]): Status => xs.reduce((a, b) => (STATUS_RANK.indexOf(b) > STATUS_RANK.indexOf(a) ? b : a), "sourced");

export const VERRA_FEES = { listing: 1500, registration_review: 3750, issuance_levy_per_t: 0.23 };

const FIELD_LABELS: Record<string, string> = {
  capacity_mw: "capacity", annual_mwh: "expected generation (MWh/yr)", annual_waste_tpy: "waste received per year",
  landfill_opening_year: "landfill opening year", animal_type: "main animals", head_count: "number of animals",
  manure_baseline_system: "how manure is handled today", area_ha: "area", fuel_from: "fuel used today", fuel_to: "new fuel",
  fuel_saved_tpy: "tonnes of old fuel replaced per year", mwh_saved: "electricity saved",
};

const n0 = (x: number) => Math.round(x).toLocaleString("en-IN");
const usd = (x: number) => "$" + Math.round(x).toLocaleString("en-US");
const label = (k: Rung["key"]) => LADDER.find(([x]) => x === k)![1];
const conf = (k: Rung["key"]) => LADDER.find(([x]) => x === k)![2];
const rung = (key: Rung["key"], value: string | null, status: Status, detail: string, confidence?: Confidence | null): Rung =>
  ({ key, label: label(key), value, detail, status, confidence: value === null ? null : (confidence ?? conf(key)) });

export interface CreditsOut { rung: Rung; range: Range | null; assumptions: Estimate["assumptions"] }

export function creditsRung(profile: Profile, route: Route): CreditsOut {
  const row = route.row;
  let r;
  try {
    r = profileEstimate(CALC, profile, row.standard, row.code);
  } catch (e) { // unsupported combination, e.g. poultry
    return { rung: rung("credits", null, "none", `Can't estimate this combination yet (${(e as Error).message}).`), range: null, assumptions: [] };
  }
  if (!r.estimate) {
    return { rung: rung("credits", null, "none", "Needs: " + r.missing.map((m) => FIELD_LABELS[m] ?? m).join(", ") + " (edit project details)."),
      range: null, assumptions: [] };
  }
  const est = r.estimate;
  const cr = est.credits_per_year;
  const statuses = new Set(est.assumptions.map((a) => a.status));
  const status: Status = statuses.has("assumption") ? "assumption" : statuses.has("verify") ? "verify" : "sourced";
  const assumed = est.assumptions.filter((a) => a.status === "assumption").map((a) => a.param);
  const notes = [...r.notes, ...est.warnings, ...(assumed.length ? [`Assumed: ${assumed.join(", ")}.`] : [])];
  if (!cr) return { rung: rung("credits", null, "none", notes.join(" ") || "No estimate for this case."), range: null, assumptions: [] };
  const value = `≈ ${n0(cr.central)} tCO₂e / yr`;
  const range = cr.low === cr.high ? "" : `Range ${n0(cr.low)}–${n0(cr.high)}. `;
  return { rung: rung("credits", value, status, range + notes.join(" "), CALC_CONFIDENCE[est.confidence]), range: cr,
    assumptions: est.assumptions };
}

export function issuanceRung(route: Route): Rung {
  const row = route.row;
  if (CALC.issuance.NO_REGISTRY_EXPORT.includes(row.standard)) {
    return rung("issuance", null, "none", `No ${row.standard} project has issued credits yet, so there is no history to time against.`);
  }
  const r = timeToFirstIssuance(CALC, ISSUANCE, row.standard, row.code, row.sector) as Record<string, any> | null;
  const m = r?.start_to_first_issuance_months;
  if (!r || !m) return rung("issuance", null, "none", "Fewer than 5 issued Indian projects to compute from.");
  const parent = CALC.issuance.PARENT[(row.code || "").toUpperCase()];
  const basis = ({ methodology: "this methodology", parent: `its CDM parent (${parent})`, sector: "this sector",
    standard: `all Indian ${row.standard} projects` } as Record<string, string>)[r.fallback_level];
  let d = `Crediting start → first issuance for Indian projects since ${ISSUANCE.filters.credit_start_since}, basis: ${basis}`;
  if (m.p25 != null && m.p75 != null) d += `; middle half ${m.p25.toFixed(1)}–${m.p75.toFixed(1)} months`;
  d += `; n = ${r.n_issued} issued. Counts only projects that have issued, so it leans short.`;
  if (r.reg_to_first_issuance_months) d += ` Registration → first issuance ~${Math.round(r.reg_to_first_issuance_months.median)} months.`;
  if (r.share_not_issued_3y_after_registration != null) d += ` ${Math.round(r.share_not_issued_3y_after_registration * 100)}% not issued 3 years after registration.`;
  d += ` Registry exports of ${ISSUANCE.generated_at}.`;
  return rung("issuance", `${m.median.toFixed(1)} months (median)`, "sourced", d, r.fallback_level === "standard" ? "low" : undefined);
}

export function costRung(route: Route, cr: Range | null): Rung {
  const std = route.row.standard;
  if (std === "Verra") {
    const fixed = VERRA_FEES.listing + VERRA_FEES.registration_review;
    const levy = cr ? cr.central * VERRA_FEES.issuance_levy_per_t : null;
    // worst of: Verra fees (sourced) + VVB fee (not set) -> not connected yet
    return rung("cost", `${usd(fixed)} upfront + $${VERRA_FEES.issuance_levy_per_t} / credit`, worst(["sourced", "not_connected"]),
      `Verra listing $1,500 + registration review $3,750; issuance levy $0.23/t` + (levy ? ` ≈ ${usd(levy)} / yr at the central estimate` : "") +
      ". Validation/verification body (VVB) fees not included yet, so this rung is not complete.");
  }
  if (std === "GoldStandard") return rung("cost", null, "not_connected", "Gold Standard fee schedule v3.1 found; values not entered yet. VVB fees not set.");
  return rung("cost", null, "not_connected", "CCTS registration and issuance fees have not been researched yet.");
}

export function priceRung(route: Route, cr: Range | null): Rung {
  const b = priceBand(CALC, route.row.standard, route.row.sector, today()) as (ReturnType<typeof priceBand> & Record<string, any>) | null;
  if (!b) return rung("price", null, "none", "No price band.");
  if (b.insufficient_trading_history) return rung("price", null, "none", `${b.basis}.`);
  const rev = cr ? grossRevenue(cr, b) : null;
  let d = `${b.basis}. As of ${b.as_of}.`;
  if (b.proxy) d += " Proxy band.";
  if (b.stale) d += ` ${b.age_days} days old, so stale.`;
  if (rev) d += ` Gross ≈ ${usd(rev.low)}–${usd(rev.high)} / yr (central ${usd(rev.central)}), before levies, VVB and broker costs.`;
  else d += " Gross revenue needs a credits estimate.";
  return rung("price", `$${b.low!.toFixed(2)}–${b.high!.toFixed(2)} / t (central $${b.central!.toFixed(2)})`,
    b.stale || b.proxy ? "verify" : "sourced", d);
}

export function eligibilityRung(route: Route): Rung {
  const unverified = route.conditions.some((r) => r.citation?.verify);
  const open = route.conditions.filter((r) => r.verdict === "unknown").length;
  const failed = route.conditions.filter((r) => r.verdict === "not_met").length;
  const d = route.overall === "eligible"
    ? "All applicability conditions met for this profile. See the checklist."
    : route.overall === "needs_info"
      ? `${open} open condition${open === 1 ? "" : "s"}; answer them to settle the verdict.`
      : `${failed} condition${failed === 1 ? "" : "s"} not met.`;
  return rung("eligibility", VERDICT[route.overall], unverified ? "verify" : "sourced",
    d + (route.warnings.length ? ` ${route.warnings.length} risk warning${route.warnings.length === 1 ? "" : "s"}.` : ""));
}

export function ladder(route: Route, profile: Profile) {
  const c = creditsRung(profile, route);
  return { rungs: [eligibilityRung(route), c.rung, issuanceRung(route), costRung(route, c.range), priceRung(route, c.range)], credits: c };
}
