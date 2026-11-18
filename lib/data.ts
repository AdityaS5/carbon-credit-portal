/** Everything the site knows, bundled at build time (no fetch, no backend). Files in data/ are synced from the
 * private repo's Data/Derived by a one-way GitHub Action; the engine in engine-ts/ is the synced TS port. */
import registry from "@/data/registry.json";
import conditions from "@/data/conditions.json";
import explanations from "@/data/explanations.json";
import sources from "@/data/sources.json";
import vocab from "@/data/vocab.json";
import intakeSpec from "@/data/intake_spec.json";
import calculatorData from "@/data/calculator_data.json";
import issuanceStats from "@/data/issuance_stats.json";
import { Engine } from "@/engine-ts/src/index.ts";
import type { EngineData, IntakeSpec, RegistryRow } from "@/engine-ts/src/types.ts";
import type { CalculatorData, IssuanceStats } from "@/engine-ts/src/calculators/types.ts";

export const DATA = {
  registry: registry as unknown as RegistryRow[],
  conditions: conditions as unknown as EngineData["conditions"],
  explanations: explanations as unknown as NonNullable<EngineData["explanations"]>,
  vocab: vocab as unknown as EngineData["vocab"],
  intakeSpec: intakeSpec as unknown as IntakeSpec,
};
export const CALC = calculatorData as unknown as CalculatorData;
export const ISSUANCE = issuanceStats as unknown as IssuanceStats & { filters: { credit_start_since: number } };

export interface SourceDoc { title: string; url?: string; kind?: string; checked?: string | null; note?: string; publisher?: string }
export const SOURCES = sources as unknown as Record<string, SourceDoc>;

export const today = (): string => new Date().toISOString().slice(0, 10);

let cached: Engine | null = null;
/** The engine, dated today (inactive_from cut-overs and 90-day warnings use the visitor's date). */
export function engine(): Engine {
  if (!cached || cached.asOf !== today()) cached = new Engine(DATA, today());
  return cached;
}

export const ROWS: Record<string, RegistryRow> = Object.fromEntries(DATA.registry.map((r) => [r.methodology_id, r]));
export const N_CONDITIONS = DATA.conditions.length;
export const N_REVIEWED = DATA.conditions.filter((c) => c.review_status === "reviewed").length;
export const OPEN_ROUTES = DATA.registry.filter((r) => r.india_route === "open" && r.status === "active");
