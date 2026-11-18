/** Overall verdict per methodology. Code only: port of engine/verdict.py. */
import type { ConditionResult, Overall } from "./types.ts";

/** Any hard not_met -> ineligible; else any unknown -> needs_info; else eligible. Soft not_met -> warning. */
export function overall(results: ConditionResult[], types: Record<string, string>): [Overall, string[]] {
  const warnings = results.filter((r) => r.verdict === "not_met" && types[r.condition_id] === "soft").map((r) => r.reason);
  if (results.some((r) => r.verdict === "not_met" && (types[r.condition_id] ?? "hard") === "hard")) return ["ineligible", warnings];
  if (results.some((r) => r.verdict === "unknown")) return ["needs_info", warnings];
  return ["eligible", warnings];
}
