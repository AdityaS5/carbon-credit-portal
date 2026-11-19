/**
 * Explore mode ("I don't have a project yet"): port of engine/explore.py (the Python reference).
 * Generic inputs -> a heuristic shortlist of project types (02_schemas §6.2). Never an eligibility verdict: the
 * route engine never sees explore inputs. Data in, results out (works in the browser). Arithmetic follows the
 * Python operation order so that the parity check (evals/explore_trace.json) can compare numbers exactly.
 */
import { estimate } from "./calculators/credits.ts";
import { timeToFirstIssuance } from "./calculators/issuance.ts";
import { pyRound } from "./calculators/num.ts";
import type { CalculatorData, IssuanceStats } from "./calculators/types.ts";
import type { RegistryRow } from "./types.ts";

type Conv = { low: number; central: number; high: number; unit: string; status: string; source: string; url: string | null };
export interface ExploreSpec {
  conversions: Record<string, Conv>;
  minimum_units: { status: string; solar_mw: number; wind_turbines: number; farm_digester_m3d: number; cbg_tpd: number; ar_ha: number };
  budget_bands_cr: Record<string, [number, number | null]>;
  timeline_max_months: Record<string, number | null>;
  no_ccts_route: Record<string, string>;
  sector_order: string[];
  blocker_priority: string[];
  blockers: Record<string, string>;
  not_shortlisted: Record<string, string>;
  access_fit: Record<string, string>;
  rank_basis: string;
  caveat: string;
  caveats: string[];
}
export interface ExploreData { spec: ExploreSpec; registry: RegistryRow[]; issuance: IssuanceStats; calc: CalculatorData }
export type ExploreInputs = Record<string, any>;

const STATUS_ORDER = ["sourced", "verify", "assumption"];
const CR = 1e7;
const worst = (s: string[]) => s.length ? s.reduce((a, b) => (STATUS_ORDER.indexOf(b) > STATUS_ORDER.indexOf(a) ? b : a)) : "assumption";
const r2 = (x: number | null) => (x === null ? null : pyRound(x, 2));
const hasLand = (inp: ExploreInputs) => !!inp.land_area_ha && inp.land_use != null && inp.land_use !== "none";

export function intlMedian(sector: string, d: ExploreData): number | null {
  let best: number | null = null;
  for (const row of d.registry) {
    if (row.sector !== sector || (row as any).india_route !== "open" || !["Verra", "GoldStandard"].includes(row.standard)) continue;
    const r: any = timeToFirstIssuance(d.calc, d.issuance, row.standard, (row as any).code, sector);
    const m = r && r.start_to_first_issuance_months ? r.start_to_first_issuance_months.median : null;
    if (m != null && (best === null || m < best)) best = m;
  }
  return best;
}

function sizeAndCredits(d: ExploreData, sector: string, tech: string, inp: ExploreInputs, std: string) {
  const { conversions: C, minimum_units: MU } = d.spec;
  const band = d.spec.budget_bands_cr[inp.budget_band];
  const [loCr, hiCr] = band ?? [null, null];
  const land: number = inp.land_area_ha || 0;
  const used: string[] = [];
  let below: boolean | null = null, size: [number, number, string] | null = null, basis: string | null = null;
  let estLo: number | null = null, estHi: number | null = null, needs: string[] | null = null;
  const est = (s: string, o: Record<string, unknown>) => estimate(d.calc, s, std, o as any).credits_per_year ?? ({} as any);

  if (sector === "grid_re" && tech === "solar_pv") {
    const L = C.solar_land_ha_per_mw, K = C.solar_capex_cr_per_mw;
    used.push(L.status, K.status);
    let lo = land / L.high, hi = land / L.low;
    if (band) {
      lo = Math.min(lo, loCr! / K.high);
      if (hiCr !== null) hi = Math.min(hi, hiCr / K.low);
      below = hiCr !== null && hiCr < MU.solar_mw * K.central;
      used.push(MU.status);
    }
    size = [lo, hi, "MW"]; basis = "land_area_ha and budget_band -> MW (solar_land_ha_per_mw, solar_capex_cr_per_mw)";
    estLo = est("grid_re", { technology: "solar", capacity_mw: lo }).low ?? null;
    estHi = est("grid_re", { technology: "solar", capacity_mw: hi }).high ?? null;
  } else if (sector === "grid_re" && tech === "wind_onshore") {
    const K = C.wind_capex_cr_per_mw, T = C.wind_turbine_mw;
    used.push(K.status, T.status, MU.status);
    const lo = Math.max(T.central * MU.wind_turbines, loCr! / K.central);
    const hi = hiCr !== null ? Math.max(lo, hiCr / K.central) : lo;
    below = false;
    size = [lo, hi, "MW"]; basis = "budget_band -> MW (wind_capex_cr_per_mw; at least one turbine)";
    estLo = est("grid_re", { technology: "wind", capacity_mw: lo }).low ?? null;
    estHi = est("grid_re", { technology: "wind", capacity_mw: hi }).high ?? null;
  } else if (sector === "biogas_manure" && band) {
    const D = C.dung_kg_per_m3d, A = C.dung_kg_per_animal_day;
    used.push(D.status, A.status, MU.status);
    let heads: [number, number];
    if (tech === "centralised_digester") {
      const K = C.cbg_capex_cr_per_tpd, R = C.dung_t_per_t_cbg;
      used.push(K.status, R.status);
      const loT = loCr! / K.high, hiT = loCr! / K.low;
      heads = [loT * R.central * 1000 / A.central, hiT * R.central * 1000 / A.central];
      size = [loT, hiT, "t CBG/day"]; basis = "budget_band -> t CBG/day (cbg_capex_cr_per_tpd, dung_t_per_t_cbg)";
      below = false;
    } else {
      const K = C.farm_digester_cost_inr_per_m3d, S = C.farm_digester_m3d;
      used.push(K.status, S.status);
      const clamp = (v: number) => Math.min(Math.max(v, S.low), S.high);
      const loM = clamp(loCr! * CR / K.high);
      const hiM = hiCr !== null ? clamp(hiCr * CR / K.low) : clamp(loCr! * CR / K.low);
      heads = [loM * D.central / A.central, hiM * D.central / A.central];
      size = [loM, hiM, "m3/day"]; basis = "budget_band -> m3/day (farm_digester_cost_inr_per_m3d, dung_kg_per_m3d)";
      below = hiCr !== null && hiCr * CR < MU.farm_digester_m3d * K.central;
    }
    estLo = est("biogas_manure", { animal: "dairy_cattle", head_count: heads[0], baseline_system: "solid_storage" }).low ?? null;
    estHi = est("biogas_manure", { animal: "dairy_cattle", head_count: heads[1], baseline_system: "uncovered_lagoon" }).high ?? null;
    basis += "; dairy cattle; low = solid-storage baseline, high = uncovered lagoon";
  } else if (sector === "biogas_manure") {
    needs = ["budget_band", "head_count"];
  } else if (sector === "ar" && tech === "mangrove") {
    needs = ["site_data"];
    if (band) {
      const K = C.ar_mangrove_cost_inr_per_ha;
      used.push(K.status, MU.status);
      below = land < MU.ar_ha || (hiCr !== null && hiCr * CR < MU.ar_ha * K.central);
    }
  } else if (sector === "ar") {
    const K = C.ar_plantation_cost_inr_per_ha;
    used.push(K.status);
    let lo = land, hi = land;
    if (band) {
      lo = Math.min(land, loCr! * CR / K.high);
      if (hiCr !== null) hi = Math.min(land, hiCr * CR / K.low);
      below = land < MU.ar_ha || (hiCr !== null && hiCr * CR < MU.ar_ha * K.central);
      used.push(MU.status);
    }
    size = [lo, hi, "ha"]; basis = "min(land_area_ha, budget_band / ar_plantation_cost_inr_per_ha)";
    estLo = est("ar", { area_ha: lo }).low ?? null;
    estHi = est("ar", { area_ha: hi }).high ?? null;
  } else if (sector === "landfill_gas") {
    needs = ["annual_waste_tpy", "landfill_opening_year"];
  } else {
    needs = ["mwh_saved", "fuel_saved_tpy"];
  }
  if (estLo === null || estHi === null) {
    estLo = estHi = null;
    needs = needs ?? ["site_data"];
  }
  const cr = {
    low: estLo, high: estHi, unit: "tCO2e/yr",
    size: size === null ? null : { low: r2(size[0]), high: r2(size[1]), unit: size[2] },
    size_basis: basis, status: worst(used), confidence: "low", needs: estLo !== null ? null : needs, standard: std,
  };
  return { cr, below };
}

function technology(d: ExploreData, sector: string, inp: ExploreInputs): string | null {
  const C = d.spec.conversions, band = d.spec.budget_bands_cr[inp.budget_band];
  if (sector === "grid_re") {
    if (hasLand(inp) && inp.land_area_ha >= C.solar_land_ha_per_mw.central * d.spec.minimum_units.solar_mw
        && ["farmland", "wasteland_degraded"].includes(inp.land_use)) return "solar_pv";
    const turbineCr = C.wind_turbine_mw.central * C.wind_capex_cr_per_mw.central;
    if (band && (band[1] === null || band[1] >= turbineCr)) return "wind_onshore";
    return null;
  }
  if (sector === "landfill_gas") return "lfg_capture";
  if (sector === "biogas_manure") return inp.budget_band === "gt_50cr" ? "centralised_digester" : "farm_digester";
  if (sector === "ar") return inp.land_use === "coastal_mangrove" ? "mangrove" : "plantation";
  return "efficient_equipment";
}

function prefill(sector: string, tech: string, inp: ExploreInputs) {
  const p: Record<string, unknown> = { sector, technology: tech, state: inp.state ?? null, target_buyer: inp.target_buyer ?? null };
  if (inp.access_grid != null) p.grid_connected = inp.access_grid;
  if (sector === "ar") {
    p.area_ha = inp.land_area_ha ?? null;
    p.land_ownership = inp.land_tenure ?? null;
    const base = ({ farmland: "cropland", wasteland_degraded: "degraded", forest: "forest" } as Record<string, string>)[inp.land_use];
    if (base) p.baseline = base;
  }
  return p;
}

const cmpKey = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

export function shortlist(inputs: ExploreInputs, d: ExploreData) {
  const spec = d.spec, inp = { ...inputs };
  const dom = inp.target_buyer === "domestic";
  const window = spec.timeline_max_months[inp.timeline] ?? null;
  const accessKey: Record<string, string> = { landfill_gas: "access_landfill", biogas_manure: "access_manure", industrial_ee_fs: "access_industrial_site" };
  const dropReason: Record<string, string> = { landfill_gas: "no_landfill_access", biogas_manure: "no_manure_access", industrial_ee_fs: "no_industrial_site" };
  const items: { key: number[]; item: Record<string, unknown> }[] = [];
  const dropped: { sector: string; reason_code: string; reason: string }[] = [];
  const drop = (sector: string, code: string) => dropped.push({ sector, reason_code: code, reason: spec.not_shortlisted[code] });

  spec.sector_order.forEach((sector, idx) => {
    if (sector === "grid_re" && inp.access_grid === false) return drop(sector, "no_grid_access");
    if (sector in accessKey && inp[accessKey[sector]] === false) return drop(sector, dropReason[sector]);
    if (sector === "ar" && !hasLand(inp)) return drop(sector, "no_land");
    const tech = technology(d, sector, inp);
    if (tech === null) return drop(sector, "no_site_for_grid_re");
    const cctsRoute = !(tech in spec.no_ccts_route);
    if (dom && !cctsRoute) return drop(sector, "no_ccts_route_for_buyer");

    let codes: string[] = [];
    const fits: string[] = [];
    const answered = sector === "grid_re" ? inp.access_grid === true : sector === "ar" ? true : inp[accessKey[sector]] === true;
    const tierA = answered ? 0 : 1;
    if (answered) fits.push(sector !== "grid_re" || tech !== "solar_pv" ? spec.access_fit[sector]
      : "Land suited to ground-mounted solar, with a grid connection");
    if (tech === "solar_pv") codes.push("additionality_grid_solar");
    if (tech === "wind_onshore") codes.push("wind_resource_study");
    if (sector === "landfill_gas" || sector === "industrial_ee_fs") codes.push("size_needs_site_data");
    if (sector === "biogas_manure") codes.push("manure_baseline_unknown");
    if (tech === "mangrove") codes.push("mangrove_no_estimate");
    if (sector === "ar" && inp.land_use === "forest") codes.push("forest_land_expert_check");
    if ((sector === "ar" || sector === "grid_re") && ["community", "government"].includes(inp.land_tenure) && hasLand(inp)
        && (sector === "ar" || tech === "solar_pv")) codes.push("land_rights_not_checked");
    if (sector === "industrial_ee_fs" && dom) codes.push("ccts_obligated_check");
    const std = dom ? "CCTS" : "Verra";
    const { cr, below } = sizeAndCredits(d, sector, tech, inp, std);
    let tierB: number;
    if (below === null) tierB = 1;
    else if (below) { tierB = 2; codes.push("budget_below_min_unit"); }
    else { tierB = 0; fits.push("Budget band reaches the smallest unit worth certifying"); }
    let median: number | null = null, tierC: number, missBy: number;
    if (dom && cctsRoute) {
      tierC = 1; missBy = 0;
      codes.push("ccts_no_issuance_history");
      fits.push("An open CCTS route exists for a domestic buyer");
    } else {
      median = intlMedian(sector, d);
      if (median === null || window === null || median <= window) {
        tierC = 0; missBy = 0;
        if (median !== null) fits.push(`Typical time to first credits (about ${pyRound(median)} months) fits your timeline`);
      } else { tierC = 2; missBy = median; codes.push("timeline_miss"); }
    }
    codes = spec.blocker_priority.filter((c) => codes.includes(c));
    items.push({ key: [tierA, tierB, tierC, missBy, codes.length, idx], item: {
      sector, technology: tech, credits_range: cr, fits,
      blockers: codes.map((c) => spec.blockers[c]), blocker_codes: codes,
      main_blocker: codes.length ? spec.blockers[codes[0]] : null, main_blocker_code: codes.length ? codes[0] : null,
      time_to_first_credits_months: median,
      rank_basis: spec.rank_basis, caveat: spec.caveat, prefill: prefill(sector, tech, inp) } });
  });
  items.sort((a, b) => cmpKey(a.key, b.key));
  return { shortlist: items.map((x, i) => ({ rank: i + 1, ...x.item })), not_shortlisted: dropped, caveats: [...spec.caveats] };
}
