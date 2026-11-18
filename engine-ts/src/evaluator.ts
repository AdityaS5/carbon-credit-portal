/**
 * Per-methodology condition evaluation: port of engine/evaluator.py without the LLM path.
 * Reviewed coded rules decide; everything else is `unknown` (Python with llm=None does the same).
 * The live Claude path stays Python-only (local demo mode, decisions log 2026-11-18).
 */
import { isNone } from "./py.ts";
import { runRule } from "./rules.ts";
import type { Condition, ConditionResult, Evaluation, Profile, Verdict } from "./types.ts";
import { overall } from "./verdict.ts";

const row = (c: Condition, verdict: Verdict, by: ConditionResult["evaluated_by"], reason: string): ConditionResult =>
  ({ condition_id: c.condition_id, verdict, evaluated_by: by, reason, citation: c.source ?? null });

export function evaluateMethodology(mid: string, conds: Condition[], profile: Profile): Evaluation {
  const results: Record<string, ConditionResult> = {};
  for (const c of conds) {
    const f = c.profile_field;
    if (c.rule && c.review_status === "reviewed") {
      const [v, why] = runRule(c.rule, profile, f);
      if (v === "not_met" && c.expert_check) {
        // the coded rule is stricter than the methodology: a person checks the exception
        results[c.condition_id] = { ...row(c, "unknown", "rule", "Check with an expert: " + c.expert_check), expert_check: true };
        continue;
      }
      results[c.condition_id] = row(c, v, "rule", why);
    } else if (f && isNone(profile[f])) {
      results[c.condition_id] = row(c, "unknown", "precheck", `no answer yet for ${f}`);
    } else {
      results[c.condition_id] = row(c, "unknown", "precheck", "no LLM configured");
    }
  }
  const rows = conds.map((c) => results[c.condition_id]);
  const types = Object.fromEntries(conds.map((c) => [c.condition_id, c.type ?? "hard"]));
  const [verdict, warnings] = overall(rows, types);
  return { methodology_id: mid, conditions: rows, overall: verdict, warnings };
}
