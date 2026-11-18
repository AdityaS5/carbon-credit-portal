/**
 * Replay an eval case through the TS engine: port of evals/harness.py.
 * intake -> questionnaire rounds (facts answered, anything else "Not sure") -> final verdicts.
 */
import { offlineExplanation } from "./explain.ts";
import { intakeProfile } from "./intake.ts";
import { Engine, type RunResult } from "./pipeline.ts";
import type { EngineData, IntakeSpec, Profile, Question, RegistryRow } from "./types.ts";

export interface EvalCase {
  id: string;
  title: string;
  intake: Profile;
  facts?: Record<string, unknown>;
  expect: Record<string, [string, string]>;
  expect_first?: string;
  [k: string]: unknown;
}

export interface CaseRun {
  id: string; sector: string; title: string;
  rounds: string[][]; question_rounds: Question[][]; asked: string[]; dont_know: string[]; left_unasked: string[];
  outcomes: Record<string, string>; expected: Record<string, string>; route_order: string[];
  profile: Profile; result: RunResult;
}

export const loadEngine = (data: EngineData, asOf: string) => new Engine(data, asOf);

/** {methodology_id: outcome} for every registry row the hard filter saw. */
export function outcomes(engine: Engine, result: RunResult): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ev of result.routes) {
    const types = Object.fromEntries(engine.conditionsOf(ev.methodology_id).map((c) => [c.condition_id, c.type ?? "hard"]));
    const softFail = ev.conditions.some((r) => r.verdict === "not_met" && types[r.condition_id] === "soft");
    if (ev.overall === "eligible") out[ev.methodology_id] = softFail ? "eligible_warning" : "eligible";
    else if (ev.overall === "needs_info") out[ev.methodology_id] = ev.conditions.some((r) => r.expert_check) ? "needs_info_expert" : "needs_info";
    else out[ev.methodology_id] = "ineligible";
  }
  const groups: [keyof RunResult, string][] = [["excluded", "excluded"], ["watchlist", "watchlist"], ["flags", "flag"], ["not_evaluated", "not_evaluated"]];
  for (const [key, label] of groups) for (const x of result[key] as { methodology_id: string }[]) out[x.methodology_id] = label;
  return out;
}

/** Registry default for rows a case doesn't list (open rows must be listed explicitly). */
export function defaultOutcome(row: RegistryRow, asOf: string): string {
  if (row.standard === "PACM") return "excluded";
  if (row.india_route === "pending") return "watchlist";
  if (row.india_route === "closed" || row.status !== "active") return "excluded";
  if (row.inactive_from && asOf >= row.inactive_from) return "excluded";
  if (!row.pdf_path) return "not_evaluated";
  return "open";
}

export function expectedMap(engine: Engine, c: EvalCase): Record<string, string> {
  const exp: Record<string, string> = {};
  for (const [mid, row] of Object.entries(engine.registry)) {
    if (row.sector !== c.intake.sector) continue;
    exp[mid] = mid in c.expect ? c.expect[mid][0] : defaultOutcome(row, engine.asOf);
  }
  return exp;
}

export function runCase(engine: Engine, spec: IntakeSpec, c: EvalCase, maxRounds: number): CaseRun {
  let profile = intakeProfile(spec, c.intake);
  const facts = c.facts ?? {};
  let result = engine.evaluate(profile);
  const rounds: string[][] = [], questionRounds: Question[][] = [], asked: string[] = [], dontKnow: string[] = [];
  for (let i = 0; i < maxRounds; i++) {
    const qs = result.questions;
    if (!qs.length) break;
    const fields = qs.map((q) => q.profile_field);
    rounds.push(fields);
    questionRounds.push(qs);
    asked.push(...fields);
    const answers: Record<string, unknown> = {};
    for (const f of fields) {
      if (f in facts) answers[f] = facts[f];
      else {
        answers[f] = engine.vocab.dont_know;
        dontKnow.push(f);
      }
    }
    let errors: Record<string, string>;
    [profile, errors] = engine.answer(profile, answers);
    if (Object.keys(errors).length) throw new Error(`${c.id}: invalid answers ${JSON.stringify(errors)}`);
    result = engine.evaluate(profile);
  }
  return {
    id: c.id, sector: String(c.intake.sector), title: c.title,
    rounds, question_rounds: questionRounds, asked, dont_know: dontKnow,
    left_unasked: result.questions.map((q) => q.profile_field),
    outcomes: outcomes(engine, result), expected: expectedMap(engine, c),
    route_order: result.routes.map((r) => r.methodology_id),
    profile, result,
  };
}

export function mismatches(run: CaseRun): Record<string, [string, string]> {
  const out: Record<string, [string, string]> = {};
  for (const [mid, exp] of Object.entries(run.expected)) {
    const got = run.outcomes[mid] ?? "missing";
    if (got !== exp) out[mid] = [exp, got];
  }
  return out;
}

/** Same shape as evals/export.py trace(): what the parity check compares against python_trace.json. */
export function trace(engine: Engine, run: CaseRun): Record<string, unknown> {
  const res = run.result;
  return {
    id: run.id, rounds: run.rounds, question_rounds: run.question_rounds,
    asked: run.asked, dont_know: run.dont_know, left_unasked: run.left_unasked,
    profile: run.profile, outcomes: run.outcomes, expected: run.expected, route_order: run.route_order,
    result: {
      routes: res.routes.map(({ row: _row, ...rest }) => rest), rank_basis: res.rank_basis, flags: res.flags,
      watchlist: res.watchlist, excluded: res.excluded, not_evaluated: res.not_evaluated, questions: res.questions,
    },
    explanations: Object.fromEntries(res.routes.map((ev) => [ev.methodology_id, offlineExplanation(
      ev, engine.registry[ev.methodology_id], engine.conditionsOf(ev.methodology_id), run.profile,
      engine.registry, engine.explanations, engine.vocab)])),
  };
}
