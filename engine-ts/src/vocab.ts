/** Answer validation: port of engine/vocab.validate_answer, driven by Data/Derived/vocab.json. */
import { PyError, pyFloat, pyIn, pyRepr, pyStr } from "./py.ts";
import type { Vocab } from "./types.ts";

export class AnswerError extends Error {}

export function validateAnswer(vocab: Vocab, field: string, value: unknown): unknown {
  if (value === vocab.dont_know || value === null || value === undefined) return null;
  const spec = vocab.fields[field];
  const t = spec.type;
  if (t === "bool") {
    if (typeof value === "boolean") return value;
    const s = pyStr(value).trim().toLowerCase();
    if (["yes", "true", "y", "1"].includes(s)) return true;
    if (["no", "false", "n", "0"].includes(s)) return false;
    throw new AnswerError(`${field}: expected yes/no`);
  }
  if (t === "number") {
    try {
      return pyFloat(value);
    } catch (e) {
      if (e instanceof PyError) throw new AnswerError(e.message);
      throw e;
    }
  }
  if (t === "date") {
    const s = pyStr(value).trim();
    if (![7, 10].includes(s.length) || s[4] !== "-") throw new AnswerError(`${field}: expected YYYY-MM`);
    return s;
  }
  if (t === "enum") {
    if (!pyIn(value, spec.options ?? [])) throw new AnswerError(`${field}: must be one of ${pyRepr(spec.options)}`);
    return value;
  }
  if (t === "multi_enum") {
    const vals = typeof value === "string" ? [value] : [...(value as unknown[])];
    const bad = vals.filter((v) => !pyIn(v, spec.options ?? []));
    if (bad.length) throw new AnswerError(`${field}: unknown options ${pyRepr(bad)}`);
    return vals;
  }
  return pyStr(value);
}
