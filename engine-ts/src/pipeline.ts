/** Orchestrator: port of engine/pipeline.py (hard filter -> evaluation -> verdicts -> ranking -> questions). */
import { evaluateMethodology } from "./evaluator.ts";
import { hardFilter, type HardFilterOut } from "./hardFilter.ts";
import { pyRepr, sortBy } from "./py.ts";
import { applyAnswers, buildQuestions, conditionFields } from "./questionnaire.ts";
import { COMPOUND, OPS } from "./rules.ts";
import type { Condition, EngineData, Evaluation, Explanation, Profile, Question, RegistryRow, Rule, Vocab } from "./types.ts";

export const CCP_ORDER: Record<string, number> = { approved: 0, conditional: 1, not_assessed: 2, not_approved: 3 };
export const VERDICT_ORDER: Record<string, number> = { eligible: 0, needs_info: 1, ineligible: 2 };
export const RANK_BASIS = "verdict, then target_buyer fit (CCTS for domestic, Verra/GS for international), then CCP status";

export type Route = Evaluation & { row: RegistryRow; standard: string; code: string };

export interface RunResult {
  routes: Route[];
  rank_basis: string;
  flags: HardFilterOut["flags"];
  watchlist: HardFilterOut["watchlist"];
  excluded: HardFilterOut["excluded"];
  not_evaluated: { methodology_id: string; note: string }[];
  questions: Question[];
}

/** Leaf operators of a (possibly nested) rule. */
const operators = (rule: Rule): string[] =>
  COMPOUND.includes(rule.operator) ? ((rule.value as Rule[] | null) ?? []).flatMap(operators) : [rule.operator];

/** Fail fast on contract breaks with the extraction output (same checks as Python). */
export function checkConditions(conditions: Condition[], vocab: Vocab): string[] {
  const errs: string[] = [];
  for (const c of conditions) {
    const f = c.profile_field;
    if (f != null && !(f in vocab.fields)) errs.push(`${c.condition_id}: profile_field ${pyRepr(f)} not in vocabulary`);
    if (c.type !== "hard" && c.type !== "soft") errs.push(`${c.condition_id}: type must be hard|soft`);
    for (const x of conditionFields(c).slice(1)) {
      if (!(x in vocab.fields)) errs.push(`${c.condition_id}: field ${pyRepr(x)} (secondary/rule) not in vocabulary`);
    }
    if (c.rule) {
      const bad = operators(c.rule).filter((o) => !(o in OPS));
      if (bad.length) errs.push(`${c.condition_id}: unsupported rule operator(s) ${pyRepr(bad)}`);
    }
  }
  return errs;
}

export class Engine {
  readonly registry: Record<string, RegistryRow>;
  readonly conditions: Record<string, Condition[]>;
  readonly vocab: Vocab;
  readonly explanations: Record<string, Explanation>;
  readonly asOf: string;

  /** asOf: ISO date "YYYY-MM-DD" (defaults to today, UTC). */
  constructor(data: EngineData, asOf?: string) {
    const errs = checkConditions(data.conditions, data.vocab);
    if (errs.length) throw new Error("Condition file breaks the schema contract:\n" + errs.slice(0, 20).join("\n"));
    this.registry = Object.fromEntries(data.registry.map((r) => [r.methodology_id, r]));
    this.conditions = {};
    for (const c of data.conditions) (this.conditions[c.methodology_id] ??= []).push(c);
    this.vocab = data.vocab;
    this.explanations = data.explanations ?? {};
    this.asOf = asOf ?? new Date().toISOString().slice(0, 10);
  }

  conditionsOf(mid: string): Condition[] {
    return this.conditions[mid] ?? [];
  }

  evaluate(profile: Profile): RunResult {
    const hf = hardFilter(profile, Object.values(this.registry), this.asOf);
    const synth: Record<string, Condition[]> = {};
    for (const c of hf.synthetic_conditions) (synth[c.methodology_id] ??= []).push(c);

    let evals: Evaluation[] = [];
    const condsById: Record<string, Condition> = {};
    const notEvaluated: RunResult["not_evaluated"] = [];
    for (const row of hf.candidates) {
      const mid = row.methodology_id;
      if (!this.conditionsOf(mid).length) { // never call a route eligible on the hard filter alone
        notEvaluated.push({ methodology_id: mid, note: "Passed the hard filter; no extracted conditions yet." });
        continue;
      }
      const conds = [...(synth[mid] ?? []), ...this.conditionsOf(mid)];
      for (const c of conds) condsById[c.condition_id] = c;
      const ev = evaluateMethodology(mid, conds, profile);
      ev.warnings = [...(hf.warnings[mid] ?? []), ...ev.warnings];
      evals.push(ev);
    }

    const buyer = profile.target_buyer;
    evals = sortBy(evals, (ev) => {
      const r = this.registry[ev.methodology_id];
      const isCcts = r.standard === "CCTS";
      const mismatch = buyer === "domestic" ? !isCcts : buyer === "international" ? isCcts : false;
      return [VERDICT_ORDER[ev.overall], mismatch, CCP_ORDER[r.ccp_status ?? ""] ?? 9, r.standard];
    });

    return {
      routes: evals.map((ev) => {
        const row = this.registry[ev.methodology_id];
        return { ...ev, row, standard: row.standard, code: row.code };
      }),
      rank_basis: RANK_BASIS,
      flags: hf.flags, watchlist: hf.watchlist, excluded: hf.excluded,
      not_evaluated: notEvaluated,
      questions: buildQuestions(evals, condsById, profile, this.vocab),
    };
  }

  answer(profile: Profile, answers: Record<string, unknown>): [Profile, Record<string, string>] {
    return applyAnswers(profile, answers, this.vocab);
  }

  /** askFn(questions) -> {field: value | vocab.dont_know}. Stops when nothing is left to ask. */
  runLoop(profile: Profile, askFn: (qs: Question[]) => Record<string, unknown>, maxRounds = 3): [Profile, RunResult] {
    let result = this.evaluate(profile);
    for (let i = 0; i < maxRounds; i++) {
      if (!result.questions.length) break;
      [profile] = this.answer(profile, askFn(result.questions));
      result = this.evaluate(profile);
    }
    return [profile, result];
  }
}
