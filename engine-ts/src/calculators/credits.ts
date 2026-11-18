/**
 * Ex-ante credit estimators, one per v1 sector: port of calculators/credits.py.
 * Screening estimates, not methodology-compliant ex-ante calculations. Parameters come from
 * Data/Derived/calculator_data.json (generated from calculators/defaults.py). Float operations keep Python's
 * order so results match the Python reference exactly (evals/calculator_trace.json).
 */
import { pyPct, pyRound, pySum } from "./num.ts";
import type { CalculatorData, Estimate, Param } from "./types.ts";

const C12 = 44 / 12;

/** Python dict[key]: missing keys raise (KeyError), never silently undefined. */
export class CalcError extends Error {}
function get<T>(obj: Record<string, T>, key: unknown, what: string): T {
  if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(obj, key)) throw new CalcError(`KeyError: ${what} ${String(key)}`);
  return obj[key];
}
const num = (x: unknown, what: string): number => {
  if (typeof x !== "number") throw new CalcError(`TypeError: ${what} must be a number`);
  return x;
};

type Used = Record<string, Param>;

function out(sector: string, low: number | null, central: number | null, high: number | null, confidence: string,
             used: Used, warnings: string[] = []): Estimate {
  const rng = central === null ? null : { low: pyRound(low!), central: pyRound(central), high: pyRound(high!) };
  return { sector, credits_per_year: rng, confidence,
    assumptions: Object.entries(used).map(([k, v]) => ({ param: k, ...v })), warnings };
}

// ---------------- 1. Grid-connected renewable electricity ----------------
/** Grid EF (tCO2/MWh) for a baseline that supplies or saves grid electricity, and the parameters used. */
export function gridEf(d: CalculatorData, standard: string, technology: string, startYear = 2027): [number, Used] {
  const D = d.defaults;
  const rule = D.GRID_EF_RULE[standard] ?? D.GRID_EF_RULE.Verra;
  const r = rule.value;
  let om = D.GRID.om.value, bm = D.GRID.bm.value;
  const used: Used = { grid_ef_rule: rule };
  if (r.method === "cea_published_cm") return [D.GRID.cm_published.value, { ...used, grid_cm: D.GRID.cm_published }];
  const kind = D.INTERMITTENT.includes(technology) ? "intermittent" : "other";
  const [wOm, wBm] = r.weights![kind];
  Object.assign(used, { grid_om: D.GRID.om, grid_bm: D.GRID.bm });
  if (r.method === "amt007") { // vintage decay of OM and BM (AMT-007 Eq. 12; GS MT400-10 cap and lag)
    const n = Math.max(0, startYear - D.GRID.data_central_year.value - r.lag_buffer!);
    const cap = r.f_cap ?? 1.0;
    om *= Math.max(0.0, 1 - Math.min(r.f_om!, cap) * n);
    bm *= Math.max(0.0, 1 - Math.min(r.f_bm!, cap) * n);
    used.data_central_year = D.GRID.data_central_year;
  }
  return [wOm * om + wBm * bm, used];
}

export interface GridReArgs { technology: string; capacity_mw: number; annual_mwh?: number | null; standard?: string; start_year?: number }

/** technology: solar | wind | small_hydro. annual_mwh overrides the CUF default. */
export function gridRe(d: CalculatorData, a: GridReArgs): Estimate {
  const [ef, used] = gridEf(d, a.standard ?? "Verra", a.technology, a.start_year ?? 2027);
  let gen: number[];
  if (a.annual_mwh) gen = [a.annual_mwh * 0.95, a.annual_mwh, a.annual_mwh * 1.02];
  else {
    const cuf = get(d.defaults.CUF.value, a.technology, "CUF technology");
    gen = cuf.map((c) => num(a.capacity_mw, "capacity_mw") * c * 8760);
    used.cuf = d.defaults.CUF;
  }
  const warn = ["Ex-post EF is fixed or updated per the methodology; CEA publishes a new version yearly.",
    "Projects claiming RECs for the same MWh cannot also claim carbon credits."];
  const [lo, ce, hi] = gen.map((g) => g * ef);
  return { ...out("grid_re", lo, ce, hi, "medium_high", used, warn), ef_tco2_per_mwh: pyRound(ef, 4) };
}

// ---------------- 2. Landfill gas (FOD model, TOOL04) ----------------
export interface LandfillArgs {
  annual_waste_t: number; opening_year: number; project_start_year: number; closure_year?: number | null;
  climate?: string; site_type?: string; covered?: boolean; end_use?: string; crediting_years?: number;
  composition?: Record<string, number> | null; standard?: string; start_year?: number | null;
}

export function landfillGas(d: CalculatorData, a: LandfillArgs): Estimate {
  const L = d.defaults.LFG, standard = a.standard ?? "Verra", endUse = a.end_use ?? "enclosed_flare";
  const creditingYears = a.crediting_years ?? 10;
  const comp: Record<string, number> = a.composition || L.composition.value;
  const k = get(L.k.value, a.climate ?? "tropical_wet", "climate") as Record<string, number>;
  const doc = L.DOC.value as Record<string, number>;
  const mcf = get(L.MCF.value, a.site_type ?? "managed_anaerobic", "site_type") as number;
  const ox = L.OX.value[(a.covered ?? true) ? "covered" : "uncovered"];
  const base = (1 - ox) * 16 / 12 * L.F.value * L.DOCf.value * mcf;
  const waste = num(a.annual_waste_t, "annual_waste_t"), opening = num(a.opening_year, "opening_year");
  const start = num(a.project_start_year, "project_start_year");
  const lastDisposal = a.closure_year || (start + creditingYears);
  const comps = Object.keys(comp);

  const ch4Generated = (y: number): number => { // t CH4 in year y, before phi
    const terms: number[] = [];
    for (let x = opening; x < Math.min(y, lastDisposal + 1); x++) {
      for (const j of comps) {
        terms.push(waste * comp[j] * get(doc, j, "DOC") * Math.exp(-get(k, j, "k") * (y - x)) * (1 - Math.exp(-k[j])));
      }
    }
    return base * pySum(terms);
  };

  const years: number[] = [];
  for (let y = start; y < start + creditingYears; y++) years.push(y);
  const avgCh4 = pySum(years.map(ch4Generated)) / creditingYears;
  const de = get(L.destruction_eff.value, endUse === "electricity" ? "engine" : endUse, "end_use") as number;
  const gwp = d.defaults.GWP_CH4.value;
  const [ef, efUsed] = gridEf(d, standard, "lfg_engine", a.start_year || start);
  const phi = L.phi.value;
  const res = (L.collection_eff.value as number[]).map((ce) => {
    const destroyed = avgCh4 * phi * ce * de;
    let er = destroyed * gwp;
    if (endUse === "electricity") er += destroyed / de * L.mwh_per_t_ch4.value * ef;
    return er;
  });
  let used: Used = Object.fromEntries(["F", "DOCf", "MCF", "OX", "DOC", "k", "composition", "phi", "collection_eff",
    "destruction_eff"].map((x) => [x, L[x]]));
  used.gwp_ch4 = d.defaults.GWP_CH4;
  const warn = [`Average over first ${creditingYears} crediting years; credits decline after closure.`,
    "If rules already require capture/flaring, baseline destruction is deducted (ACM0001/BM WA03.002 " +
    "defaults); under A6.4-AMM-001 a flaring requirement with no set amount means no credits."];
  if (standard === "GoldStandard" && endUse !== "electricity") warn.push("Flaring-only projects are not eligible under GS A6.4-AMM-001.");
  if (endUse === "electricity") used = { ...used, mwh_per_t_ch4: L.mwh_per_t_ch4, ...efUsed };
  return out("landfill_gas", res[0], res[1], res[2], "medium", used, warn);
}

// ---------------- 3. Biogas / manure management ----------------
export interface ManureArgs {
  animal: string; head_count: number; baseline_system: string; displaced_fuel?: string | null; standard?: string;
  productivity?: string; start_year?: number;
}

/** displaced_fuel: null | lpg | diesel | grid_electricity. productivity: low (IPCC Tier 1 default) | high. */
export function manureBiogas(d: CalculatorData, a: ManureArgs): Estimate {
  const M = d.defaults.MANURE, productivity = a.productivity ?? "low";
  const baseline = d.defaults.MANURE_ALIASES[a.baseline_system] ?? a.baseline_system;
  const [vsRate, tam, b0] = get(get(M.animals.value, a.animal, "animal"), productivity, "productivity") as number[];
  const vs = vsRate * tam / 1000; // kg VS/head/day
  const ch4PotM3 = num(a.head_count, "head_count") * vs * 365 * b0; // m3 CH4/yr at full B0
  const toT = M.m3_ch4_to_t.value, gwp = d.defaults.GWP_CH4.value;
  const pe = ch4PotM3 * M.digester_leakage.value * toT * gwp;
  const uf = M.uf_b.value;
  let used: Used = { vs_b0: M.animals, mcf_baseline: M.mcf_baseline, uf_b: M.uf_b, digester_leakage: M.digester_leakage,
    gwp_ch4: d.defaults.GWP_CH4 };
  let energyEr = 0.0;
  if (a.displaced_fuel) {
    const gj = ch4PotM3 * M.capture_fraction_of_b0.value * M.ch4_lhv_gj_per_m3.value;
    if (a.displaced_fuel === "grid_electricity") {
      const [ef, efUsed] = gridEf(d, a.standard ?? "Verra", "biogas_genset", a.start_year ?? 2027);
      energyEr = gj / 3.6 * 0.35 * ef; // 35% genset efficiency
      used = { ...used, ...efUsed };
    } else {
      energyEr = gj / 1000 * get(d.defaults.FUELS.value, a.displaced_fuel, "fuel")[1];
    }
    used = { ...used, capture_fraction: M.capture_fraction_of_b0, fuels: d.defaults.FUELS };
  }
  const res = (get(M.mcf_baseline.value, baseline, "baseline_system") as number[])
    .map((mcf) => Math.max(0.0, uf * ch4PotM3 * mcf * toT * gwp + energyEr - pe));
  const warn: string[] = [];
  if (["solid_storage", "daily_spread", "burned_for_fuel"].includes(baseline)) {
    warn.push("Dry baseline: little methane is avoided and digester leakage can cancel it; " +
      "credits depend on fuel displacement (firewood needs fNRB - not modelled). " +
      "AMS-III.D/ACM0010 need an anaerobic baseline system.");
  }
  if (baseline === "burned_for_fuel") warn.push("Dung now burned as fuel must be replaced; replacement fuel emissions not modelled.");
  return { ...out("biogas_manure", res[0], res[1], res[2], a.displaced_fuel ? "low" : "medium", used, warn),
    vs_kg_per_head_day: pyRound(vs, 2), productivity };
}

// ---------------- 4. Afforestation / reforestation ----------------
export interface ArArgs { area_ha: number; species_group?: string; zone?: string; mangrove?: boolean }

export function afforestation(d: CalculatorData, a: ArArgs): Estimate {
  if (a.mangrove) {
    return out("ar", null, null, null, "low", {},
      ["Mangrove (CCTS/VM0033) sequestration needs site data; no screening default yet."]);
  }
  const A = d.defaults.AR, zone = a.zone ?? "tropical_moist_deciduous";
  const growth = get(A.agb_increment_t_dm.value, zone, "zone") as Record<string, number>;
  let species = d.credits.AR_SPECIES_ALIASES[a.species_group ?? "other"] ?? a.species_group ?? "other";
  species = species in growth ? species : "other";
  const perHa = growth[species] * (1 + (get(A.root_shoot.value, zone, "zone") as number)) * A.carbon_fraction.value * C12;
  const unc = 1 - A.uncertainty.value;
  const stocking = A.stocking.value as number[], buffer = A.buffer.value as number[];
  const area = num(a.area_ha, "area_ha");
  const res = stocking.slice(0, buffer.length).map((s, i) => area * perHa * s * unc * (1 - buffer[i]));
  const warn = ["Long-run average; years 1-5 sequester far less and credits arrive only at verification.",
    "VM0047 area-based projects are credited against a dynamic performance benchmark (not modelled); " +
    "census-based projects have a zero baseline. Leakage (VMD0054) not included."];
  return { ...out("ar", res[0], res[1], res[2], "low", { ...A }, warn), gross_tco2_per_ha_yr: pyRound(perHa, 1) };
}

// ---------------- 5. Industrial energy efficiency / fuel switch ----------------
export interface EeArgs {
  mode: string; mwh_saved?: number | null; fuel?: string | null; tonnes_saved?: number | null; from_fuel?: string | null;
  to_fuel?: string | null; tonnes_from_fuel?: number | null; ncv_override?: number | null; standard?: string; start_year?: number;
}

/** mode: electricity_saving | fuel_saving | fuel_switch (same useful energy assumed). */
export function industrialEe(d: CalculatorData, a: EeArgs): Estimate {
  const F = d.defaults.FUELS.value;
  let used: Used = { fuels: d.defaults.FUELS };
  let central: number[];
  if (a.mode === "electricity_saving") {
    const [ef, efUsed] = gridEf(d, a.standard ?? "Verra", "electricity_saving", a.start_year ?? 2027);
    used = { ...used, ...efUsed };
    const mwh = num(a.mwh_saved, "mwh_saved");
    central = [mwh * ef * 0.8, mwh * ef, mwh * ef];
  } else if (a.mode === "fuel_saving") {
    const f = get(F, a.fuel, "fuel");
    const ncv = a.ncv_override || f[0];
    const er = num(a.tonnes_saved, "tonnes_saved") / 1000 * ncv * f[1];
    central = [er * 0.8, er, er];
  } else if (a.mode === "fuel_switch") {
    const from = get(F, a.from_fuel, "from_fuel");
    const ncv = a.ncv_override || from[0];
    const tj = num(a.tonnes_from_fuel, "tonnes_from_fuel") / 1000 * ncv;
    const er = tj * (from[1] - get(F, a.to_fuel, "to_fuel")[1]);
    central = [er * 0.8, er, er];
  } else {
    throw new CalcError(`ValueError: ${a.mode}`);
  }
  const warn = ["Low case assumes 20% shortfall versus the claimed savings."];
  if ((a.fuel || a.from_fuel || "").endsWith("coal") && !a.ncv_override) {
    warn.push("Using IPCC coal NCV; Indian coal is usually lower – enter measured NCV.");
  }
  return out("industrial_ee_fs", central[0], central[1], central[2], "medium", used, warn);
}

export const SECTORS = ["grid_re", "landfill_gas", "biogas_manure", "ar", "industrial_ee_fs"] as const;

/** Average baseline downward adjustment over the crediting period, the parameter used and the message. */
export function downwardAdjustment(d: CalculatorData, standard: string, methodology: string | null | undefined,
                                   creditingYears: number): [number, Param | null, string | null] {
  const D = d.defaults;
  const pacmRule = standard === "PACM" ||
    (standard === "GoldStandard" && D.PACM_BASED.some((p) => (methodology || "").toUpperCase().startsWith(p)));
  if (pacmRule) {
    const da = D.PACM_DA.value;
    const avg = da.initial + da.annual_increase * (creditingYears - 1) / 2;
    return [avg, D.PACM_DA, `PACM downward adjustment: average ${pyPct(avg, 1)} over ${creditingYears} years ` +
      "(10% initial + 1%/yr)."];
  }
  if (standard === "GoldStandard") {
    const daf = D.GS_DAF_INDIA.value;
    return [daf, D.GS_DAF_INDIA, `Gold Standard DAF for India: ${pyPct(daf, 2)} (fixed 2026-2030).`];
  }
  return [0.0, null, null];
}

export interface EstimateOptions { methodology?: string | null; crediting_years?: number; start_year?: number; [k: string]: unknown }

/**
 * Entry point (calculators.credits.estimate): run the sector estimator for one standard/methodology, then apply the
 * Paris-aligned baseline adjustment (PACM rule or GS DAF). As in Python, `crediting_years` and `start_year` are
 * estimate()'s own arguments: landfill gas gets neither (it uses its own crediting_years default of 10 and
 * project_start_year).
 */
export function estimate(d: CalculatorData, sector: string, standard: string, opts: EstimateOptions = {}): Estimate {
  const { methodology: m0 = null, crediting_years: cy = 10, start_year: sy = 2027, ...inputs } = opts;
  let methodology = m0;
  if (standard === "GoldStandard" && !methodology) methodology = d.defaults.GS_DEFAULT_METHODOLOGY[sector] ?? null;
  const args: Record<string, unknown> = { ...inputs };
  if (sector !== "ar") {
    args.standard = standard;
    if (sector !== "landfill_gas" && !("start_year" in args)) args.start_year = sy;
  }
  let res: Estimate;
  if (sector === "grid_re") res = gridRe(d, args as unknown as GridReArgs);
  else if (sector === "landfill_gas") res = landfillGas(d, args as unknown as LandfillArgs);
  else if (sector === "biogas_manure") res = manureBiogas(d, args as unknown as ManureArgs);
  else if (sector === "ar") res = afforestation(d, args as unknown as ArArgs);
  else if (sector === "industrial_ee_fs") res = industrialEe(d, args as unknown as EeArgs);
  else throw new CalcError(`KeyError: sector ${sector}`);
  const [avgDa, param, msg] = downwardAdjustment(d, standard, methodology, cy);
  if (avgDa && res.credits_per_year) {
    const c = res.credits_per_year;
    res.credits_per_year = { low: pyRound(c.low * (1 - avgDa)), central: pyRound(c.central * (1 - avgDa)), high: pyRound(c.high * (1 - avgDa)) };
    res.assumptions.push({ param: "downward_adjustment", ...param! });
    res.warnings.push(msg!);
  }
  return { ...res, standard, methodology };
}
