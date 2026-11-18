/** Coded rule runner: port of engine/rules.py (compound any_of / all_of with three-valued logic). */
import { PyError, isNone, pyEq, pyFloat, pyIn, pyRepr, pyStr } from "./py.ts";
import type { Profile, Rule, Verdict } from "./types.ts";

const date = (s: unknown): string => {
  const t = pyStr(s);
  return t.length === 7 ? t + "-01" : t;
};
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);
const cmpStr = (a: string, b: string, ok: (c: number) => boolean) => ok(a < b ? -1 : a > b ? 1 : 0);

export const OPS: Record<string, (x: unknown, v: any) => boolean> = {
  eq: (x, v) => pyEq(x, v),
  neq: (x, v) => !pyEq(x, v),
  in: (x, v) => asList(x).every((i) => pyIn(i, v)), // every selected value allowed
  not_in: (x, v) => !asList(x).some((i) => pyIn(i, v)),
  any_in: (x, v) => asList(x).some((i) => pyIn(i, v)), // at least one selected value allowed
  gte: (x, v) => pyFloat(x) >= pyFloat(v),
  lte: (x, v) => pyFloat(x) <= pyFloat(v),
  gt: (x, v) => pyFloat(x) > pyFloat(v),
  lt: (x, v) => pyFloat(x) < pyFloat(v),
  between: (x, v) => {
    if (!Array.isArray(v) && typeof v !== "string") throw new PyError(`'${v === null ? "NoneType" : typeof v}' object is not subscriptable`);
    return pyFloat(v[0]) <= pyFloat(x) && pyFloat(x) <= pyFloat(v[1]);
  },
  is_true: (x) => x === true,
  is_false: (x) => x === false,
  date_gte: (x, v) => cmpStr(date(x), date(v), (c) => c >= 0),
  date_lte: (x, v) => cmpStr(date(x), date(v), (c) => c <= 0),
};

export const COMPOUND = ["any_of", "all_of"];

/** Profile fields a rule reads (primary field first for simple rules). */
export function ruleFields(rule: Rule | null | undefined, field?: string | null): string[] {
  if (!rule) return field ? [field] : [];
  if (COMPOUND.includes(rule.operator)) {
    const out: string[] = [];
    for (const part of (rule.value as Rule[] | null) ?? []) {
      for (const f of ruleFields(part, part.field)) if (!out.includes(f)) out.push(f);
    }
    return out;
  }
  return field ? [field] : [];
}

/** Return [verdict, reason]. Missing value or bad data -> unknown, never a guess. */
export function runRule(rule: Rule, profile: Profile, field: string | null | undefined): [Verdict, string] {
  const op = rule.operator;
  if (COMPOUND.includes(op)) {
    const parts = ((rule.value as Rule[] | null) ?? []).map((r) => runRule(r, profile, r.field));
    const vs = parts.map(([v]) => v);
    let v: Verdict;
    if (op === "any_of") v = vs.includes("met") ? "met" : vs.includes("unknown") ? "unknown" : "not_met";
    else v = vs.includes("not_met") ? "not_met" : vs.includes("unknown") ? "unknown" : "met";
    return [v, parts.map(([, why]) => `(${why})`).join(` ${op.replace("_", " ")} `)];
  }
  const value = field == null ? undefined : profile[field];
  if (isNone(value)) return ["unknown", `no answer yet for ${pyStr(field ?? null)}`];
  if (!(op in OPS)) return ["unknown", `unsupported operator ${pyRepr(op ?? null)}`];
  let ok: boolean;
  try {
    ok = OPS[op](value, rule.value ?? null);
  } catch (e) {
    if (!(e instanceof PyError)) throw e;
    return ["unknown", `cannot compare ${field}=${pyRepr(value)}: ${e.message}`];
  }
  return [ok ? "met" : "not_met", `${field}=${pyRepr(value)} ${op} ${pyRepr(rule.value ?? null)}`];
}
