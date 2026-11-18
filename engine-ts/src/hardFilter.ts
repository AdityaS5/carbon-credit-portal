/**
 * Hard filter (brief step 1): port of engine/hard_filter.py. Unknown inputs never exclude a route:
 * they become synthetic hard conditions that flow into the questionnaire.
 */
import { runRule } from "./rules.ts";
import type { Condition, Profile, RegistryRow, Rule, Source } from "./types.ts";

export const START_RULES: Record<string, { min: string; source: Source }> = {
  CCTS: { min: "2025-01", source: { doc: "BEE Detailed Procedure for the Offset Mechanism (Mar 2025)", page: null, para: null, verify: true } },
};
export const CUTOVER_WARN_DAYS = 90;

/** Whole days from ISO date a to ISO date b (Python `(b - a).days`). */
export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

export interface HardFilterOut {
  candidates: RegistryRow[];
  flags: { methodology_id: string; note: string }[];
  watchlist: { methodology_id: string; note: string }[];
  excluded: { methodology_id: string; reasons: string[] }[];
  synthetic_conditions: Condition[];
  warnings: Record<string, string[]>;
}

function synthetic(mid: string, field: string, rule: Rule, text: string, source: Source): Condition {
  return { condition_id: `${mid}_HF_${field}`, methodology_id: mid, text, type: "hard", profile_field: field, rule,
    question: null, source, review_status: "reviewed" };
}

/** asOf: ISO date "YYYY-MM-DD". */
export function hardFilter(profile: Profile, registry: RegistryRow[], asOf: string): HardFilterOut {
  const out: HardFilterOut = { candidates: [], flags: [], watchlist: [], excluded: [], synthetic_conditions: [], warnings: {} };
  const sector = profile.sector;
  for (const row of registry) {
    const mid = row.methodology_id, std = row.standard;
    if (row.sector !== sector) continue;
    const reasons: string[] = [];

    if (std === "PACM") { // flag-only (brief: never recommended in v1)
      const a6 = row.india_a6_eligible ?? false;
      let partialOk = false;
      if (a6 === "partial") {
        if (row.a6_rule) partialOk = runRule(row.a6_rule, profile, row.a6_rule.field)[0] !== "not_met";
        else partialOk = profile.has_storage !== false;
      }
      if (a6 === true || partialOk) {
        out.flags.push({ methodology_id: mid, note: row.a6_note || "On India's Article 6.4 list; PACM route possible, not assessed here." });
      } else {
        out.excluded.push({ methodology_id: mid, reasons: ["PACM: activity not on India's Article 6.4 list"] });
      }
      continue;
    }

    const route = row.india_route ?? (row.status === "active" ? "open" : "closed");
    if (route === "pending") {
      out.watchlist.push({ methodology_id: mid, note: ("notes" in row ? row.notes : "") as string });
      continue;
    }
    if (route === "closed" || row.status !== "active") reasons.push(`Not open to new Indian projects: ${row.notes || route}`);
    const inactiveFrom = row.inactive_from;
    if (inactiveFrom && asOf >= inactiveFrom) {
      reasons.push(`Inactive from ${inactiveFrom}` + (row.superseded_by ? `; use ${row.superseded_by}` : ""));
    } else if (inactiveFrom && daysBetween(asOf, inactiveFrom) <= CUTOVER_WARN_DAYS) {
      (out.warnings[mid] ??= []).push(`Methodology inactive from ${inactiveFrom}; registration must complete before then.`);
    }

    if (std === "CCTS") {
      const ob = profile.ccts_obligated;
      if (ob === true) reasons.push("CCTS offsets are for non-obligated entities only");
      else if (ob === null || ob === undefined) {
        out.synthetic_conditions.push(synthetic(mid, "ccts_obligated", { operator: "is_false" },
          "Project owner is not a CCTS obligated entity",
          { doc: "CCTS offset mechanism (non-obligated entities)", page: null, para: null }));
      }
    }

    const sr = START_RULES[std];
    if (sr) {
      const sd = profile.start_date;
      if (sd === null || sd === undefined) {
        out.synthetic_conditions.push(synthetic(mid, "start_date", { operator: "date_gte", value: sr.min },
          `Project start date on or after ${sr.min}`, sr.source));
      } else if ((String(sd) + "-01").slice(0, 10) < (sr.min + "-01").slice(0, 10)) {
        reasons.push(`${std} requires a start date on or after ${sr.min} (rule marked verify)`);
      }
    }

    if (reasons.length) out.excluded.push({ methodology_id: mid, reasons });
    else out.candidates.push(row);
  }
  return out;
}
