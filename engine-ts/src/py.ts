/**
 * Small Python-semantics helpers so the TS port gives the same verdicts AND the same reason strings
 * as the Python reference engine (../engine). Only what the interpreter needs.
 */

export class PyError extends Error {}

const isNum = (x: unknown): x is number | boolean => typeof x === "number" || typeof x === "boolean";

/** Python `==` for JSON values (True == 1 == 1.0, lists and dicts compared deeply). */
export function pyEq(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
  if (isNum(a) && isNum(b)) return Number(a) === Number(b);
  if (typeof a === "string" || typeof b === "string") return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => pyEq(x, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object), kb = Object.keys(b as object);
    return ka.length === kb.length &&
      ka.every((k) => k in (b as object) && pyEq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

const typeName = (x: unknown): string =>
  x === null || x === undefined ? "NoneType" : Array.isArray(x) ? "list" : typeof x === "string" ? "str"
    : typeof x === "boolean" ? "bool" : typeof x === "number" ? (Number.isInteger(x) ? "int" : "float") : "dict";

/** Python `item in container` (list membership or substring), raising like Python on bad types. */
export function pyIn(item: unknown, container: unknown): boolean {
  if (Array.isArray(container)) return container.some((c) => pyEq(item, c));
  if (typeof container === "string") {
    if (typeof item !== "string") throw new PyError(`'in <string>' requires string as left operand, not ${typeName(item)}`);
    return container.includes(item);
  }
  if (container !== null && typeof container === "object") return typeof item === "string" && item in container;
  throw new PyError(`argument of type '${typeName(container)}' is not iterable`);
}

const FLOAT_RE = /^[+-]?((\d(_?\d)*)(\.(\d(_?\d)*)?)?|\.\d(_?\d)*)([eE][+-]?\d(_?\d)*)?$/;

/** Python `float(x)`. */
export function pyFloat(x: unknown): number {
  if (typeof x === "boolean") return x ? 1 : 0;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const s = x.trim();
    if (FLOAT_RE.test(s)) return Number(s.replaceAll("_", ""));
    const low = s.toLowerCase().replace(/^[+-]/, "");
    if (low === "inf" || low === "infinity") return s.startsWith("-") ? -Infinity : Infinity;
    if (low === "nan") return NaN;
    throw new PyError(`could not convert string to float: ${pyRepr(x)}`);
  }
  throw new PyError(`float() argument must be a string or a real number, not '${typeName(x)}'`);
}

/** Python `str(x)` for the JSON values the engine sees. */
export function pyStr(x: unknown): string {
  return typeof x === "string" ? x : pyRepr(x);
}

function reprStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = q;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === q) out += "\\" + q;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 0x20 || c === 0x7f) out += "\\x" + c.toString(16).padStart(2, "0");
    else out += ch;
  }
  return out + q;
}

/**
 * Python `repr(x)`. JSON numbers carry no int/float distinction in JS, so 50.0 prints as "50";
 * the parity check normalises "50.0" -> "50" on both sides (see cli/parity.ts).
 */
export function pyRepr(x: unknown): string {
  if (x === null || x === undefined) return "None";
  if (typeof x === "boolean") return x ? "True" : "False";
  if (typeof x === "number") return Number.isNaN(x) ? "nan" : x === Infinity ? "inf" : x === -Infinity ? "-inf" : String(x);
  if (typeof x === "string") return reprStr(x);
  if (Array.isArray(x)) return "[" + x.map(pyRepr).join(", ") + "]";
  return "{" + Object.entries(x as object).map(([k, v]) => `${reprStr(k)}: ${pyRepr(v)}`).join(", ") + "}";
}

/** Python `x is None` for a dict lookup (`profile.get(k) is None`). */
export const isNone = (x: unknown): boolean => x === null || x === undefined;

/** Stable sort by a tuple key, like Python `sorted(key=...)` (numbers, booleans and strings). */
export function sortBy<T>(xs: T[], key: (x: T) => (number | boolean | string)[]): T[] {
  const cmp = (a: (number | boolean | string)[], b: (number | boolean | string)[]): number => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const x = typeof a[i] === "boolean" ? Number(a[i]) : a[i], y = typeof b[i] === "boolean" ? Number(b[i]) : b[i];
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return a.length - b.length;
  };
  return xs.map((x, i) => ({ x, i, k: key(x) })).sort((a, b) => cmp(a.k, b.k) || a.i - b.i).map((e) => e.x);
}

/** Python `sorted()` of strings (code-point order). */
export const sortedStrings = (xs: Iterable<string>): string[] =>
  [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
