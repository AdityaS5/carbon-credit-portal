import { conditionFields } from "@/engine-ts/src/questionnaire.ts";
import type { Route, RunResult } from "@/engine-ts/src/pipeline.ts";
import type { Condition, Profile, RegistryRow } from "@/engine-ts/src/types.ts";
import { DATA, ROWS } from "./data.ts";

export const COND: Record<string, Condition> = Object.fromEntries(DATA.conditions.map((c) => [c.condition_id, c]));

export interface OpenItem { conditionId: string; text: string; question: string | null; dontKnow: boolean; expert: string | null }

/** Open (unknown) conditions on a route: the question still needed, or the expert check. */
export function openItems(route: Route, profile: Profile): OpenItem[] {
  const dk = new Set(profile._dont_know ?? []);
  return route.conditions.filter((r) => r.verdict === "unknown").map((r) => {
    const c = COND[r.condition_id] ?? ({ text: r.reason } as Condition);
    if (r.expert_check) return { conditionId: r.condition_id, text: c.text, question: null, dontKnow: false, expert: r.reason };
    const missing = conditionFields(c).filter((f) => (profile[f] === null || profile[f] === undefined) && f in DATA.vocab.fields);
    const f = missing[0];
    return { conditionId: r.condition_id, text: c.text, question: f ? DATA.vocab.fields[f].q ?? f : null, dontKnow: f ? dk.has(f) : false, expert: null };
  });
}

export interface OtherRoute { row: RegistryRow; group: "flag" | "watchlist" | "excluded" | "not_evaluated"; why: string }

export function otherRoutes(run: RunResult): OtherRoute[] {
  return [
    ...run.flags.map((x) => ({ row: ROWS[x.methodology_id], group: "flag" as const, why: x.note })),
    ...run.watchlist.map((x) => ({ row: ROWS[x.methodology_id], group: "watchlist" as const, why: x.note || "Rules not final yet." })),
    ...run.excluded.map((x) => ({ row: ROWS[x.methodology_id], group: "excluded" as const, why: x.reasons.join("; ") })),
    ...run.not_evaluated.map((x) => ({ row: ROWS[x.methodology_id], group: "not_evaluated" as const,
      why: "Open to Indian projects, but its conditions have not been extracted yet (PDF not in the corpus), so we can't call it eligible." })),
  ].filter((x) => x.row && x.row.code !== "none");
}

export const routeTitle = (row: RegistryRow): string => `${row.code}${row.version ? " v" + row.version : ""}`;

export interface Warning { text: string; source: Condition["source"] | null }

/** Risk warnings: soft conditions not met (shown with the condition's own text and source), plus hard-filter notes. */
export function riskWarnings(route: Route): Warning[] {
  const soft = route.conditions.filter((r) => r.verdict === "not_met" && COND[r.condition_id]?.type === "soft");
  const softReasons = new Set(soft.map((r) => r.reason));
  return [
    ...route.warnings.filter((w) => !softReasons.has(w)).map((w) => ({ text: w, source: null })),
    ...soft.map((r) => ({ text: COND[r.condition_id].text, source: r.citation ?? COND[r.condition_id].source ?? null })),
  ];
}

/** One line per distinct open question (several conditions can wait on the same answer). */
export function distinctOpen(items: OpenItem[]): OpenItem[] {
  const seen = new Set<string>();
  return items.filter((o) => { const k = o.expert ?? o.question ?? o.text; if (seen.has(k)) return false; seen.add(k); return true; });
}
