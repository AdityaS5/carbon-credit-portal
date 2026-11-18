/**
 * Profile -> calculator inputs -> estimate: port of ui/estimates.estimator_inputs and the calculator call in
 * ui/estimates.credits(). Carries the GRID_TECH mapping (vocabulary `solar_pv` -> calculator `solar`): calling the
 * calculator with a vocabulary key would silently use non-intermittent grid weights (decisions log, 19 Nov).
 */
import { pyIn } from "../py.ts";
import type { Profile } from "../types.ts";
import { estimate } from "./credits.ts";
import type { CalculatorData, Estimate } from "./types.ts";

export interface EstimatorInputs { inputs: Record<string, unknown>; missing: string[]; notes: string[] }

export const startYear = (p: Profile): number => (p.start_date ? parseInt(String(p.start_date).slice(0, 4), 10) : 2027);

/** Map profile fields to the sector estimator's arguments (inputs, missing fields, notes). */
export function estimatorInputs(d: CalculatorData, p: Profile): EstimatorInputs {
  const s = p.sector, notes: string[] = [];
  const v = (f: string) => p[f] ?? null;
  const need = (...fields: string[]) => fields.filter((f) => pyIn(v(f), [null, [], 0]));
  if (s === "grid_re") {
    const tech = d.profile.GRID_TECH[String(p.technology)] ?? null;
    let missing = v("annual_mwh") === null ? need("capacity_mw") : [];
    if (tech === "geothermal" && !p.annual_mwh) missing = ["annual_mwh"]; // no default capacity factor
    return { inputs: { technology: tech, capacity_mw: p.capacity_mw || 0, annual_mwh: v("annual_mwh") }, missing, notes };
  }
  if (s === "landfill_gas") {
    const uses = (p.lfg_end_use as string[] | null | undefined) || [];
    const endUse = uses.includes("electricity") ? "electricity" : "enclosed_flare";
    if (uses.some((u) => u === "heat" || u === "pipeline")) notes.push("Heat or pipeline use is estimated as enclosed flaring (fuel displacement not counted).");
    if (!uses.length) notes.push("Gas use not given: estimated as enclosed flaring.");
    return { inputs: { annual_waste_t: v("annual_waste_tpy"), opening_year: v("landfill_opening_year"),
      project_start_year: startYear(p), closure_year: v("landfill_closure_year"), end_use: endUse },
    missing: need("annual_waste_tpy", "landfill_opening_year"), notes };
  }
  if (s === "biogas_manure") {
    const use = v("biogas_end_use");
    if (use === "cooking" || use === "heat") notes.push("Fuel the biogas replaces is not counted (depends on fNRB for firewood).");
    return { inputs: { animal: v("animal_type"), head_count: v("head_count"), baseline_system: v("manure_baseline_system"),
      displaced_fuel: use === "electricity" ? "grid_electricity" : null, productivity: p.productivity || "low" },
    missing: need("animal_type", "head_count", "manure_baseline_system"), notes };
  }
  if (s === "ar") {
    const inputs: Record<string, unknown> = { area_ha: v("area_ha"), species_group: p.species_group || "other", mangrove: Boolean(p.is_mangrove) };
    if (p.zone) inputs.zone = p.zone;
    else notes.push("Ecological zone not given: tropical moist deciduous assumed.");
    return { inputs, missing: need("area_ha"), notes };
  }
  if (s === "industrial_ee_fs") {
    if (p.technology === "fuel_switch" || p.technology === "renewable_heat") {
      const to = p.fuel_to || (p.technology === "renewable_heat" ? "renewable_biomass" : null);
      const missing = [...need("fuel_from", "fuel_saved_tpy"), ...(to ? [] : ["fuel_to"])];
      return { inputs: { mode: "fuel_switch", from_fuel: v("fuel_from"), to_fuel: to, tonnes_from_fuel: v("fuel_saved_tpy"),
        ncv_override: v("fuel_ncv") }, missing, notes };
    }
    return { inputs: { mode: "electricity_saving", mwh_saved: v("mwh_saved") }, missing: need("mwh_saved"), notes };
  }
  throw new Error(`ValueError: ${String(s)}`);
}

/** Estimate for one route (standard + code) from a profile; null estimate when an input is missing. */
export function profileEstimate(d: CalculatorData, p: Profile, standard: string, code: string):
  EstimatorInputs & { estimate: Estimate | null } {
  const r = estimatorInputs(d, p);
  if (r.missing.length) return { ...r, estimate: null };
  const methodology = standard === "GoldStandard" ? code : null;
  const inputs = Object.fromEntries(Object.entries(r.inputs).filter(([, x]) => x !== null && x !== undefined));
  return { ...r, estimate: estimate(d, String(p.sector), standard, { methodology, start_year: startYear(p), ...inputs }) };
}
