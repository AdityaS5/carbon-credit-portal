/** Shapes of Data/Derived/calculator_data.json (generated from calculators/*.py) and calculator outputs. */

export interface Param<T = any> {
  value: T;
  source: string;
  status: "sourced" | "verify" | "assumption";
  note: string;
}

export interface CalculatorData {
  defaults: {
    AS_OF: string;
    GRID: Record<"om" | "bm" | "cm_published" | "weighted_avg" | "data_central_year" | "re_nuclear_share", Param<number>>;
    GRID_EF_RULE: Record<string, Param<{ method: string; weights?: Record<string, [number, number]>; f_bm?: number;
      f_om?: number; f_cap?: number | null; lag_buffer?: number }>>;
    PACM_DA: Param<{ initial: number; annual_increase: number }>;
    GS_DAF_INDIA: Param<number>;
    GS_DEFAULT_METHODOLOGY: Record<string, string>;
    CUF: Param<Record<string, [number, number, number]>>;
    GWP_CH4: Param<number>;
    FUELS: Param<Record<string, [number, number]>>;
    LFG: Record<string, Param>;
    MANURE: Record<string, Param>;
    MANURE_ALIASES: Record<string, string>;
    AR: Record<string, Param>;
    INTERMITTENT: string[];
    PACM_BASED: string[];
  };
  credits: { AR_SPECIES_ALIASES: Record<string, string> };
  prices: { STALE_AFTER_DAYS: number; BANDS: PriceBand[] };
  issuance: { PARENT: Record<string, string>; NO_REGISTRY_EXPORT: string[]; MIN_N: number };
  profile: { GRID_TECH: Record<string, string> };
}

export interface PriceBand {
  key: [string, string];
  low: number | null;
  central: number | null;
  high: number | null;
  currency: string;
  as_of: string;
  [k: string]: unknown;
}

export interface IssuanceStats {
  generated_at: string;
  rows: { level: string; key: (string | null)[]; [k: string]: unknown }[];
  [k: string]: unknown;
}

export type Range = { low: number; central: number; high: number };

export interface Estimate {
  sector: string;
  credits_per_year: Range | null;
  confidence: string;
  assumptions: ({ param: string } & Param)[];
  warnings: string[];
  [k: string]: unknown;
}
