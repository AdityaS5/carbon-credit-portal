/** Deep comparison of the TS trace against the Python reference trace. */

/**
 * JSON has no int/float distinction in JS, so Python prints 50.0 where TS prints 50 inside reason strings.
 * Both sides are normalised the same way before comparing; nothing else is relaxed.
 */
export const normaliseText = (s: string): string => s.replace(/(?<![\w.])(-?\d+)\.0(?![\d.])/g, "$1");

export function diff(py: unknown, ts: unknown, path = "$", out: string[] = [], limit = 50): string[] {
  if (out.length >= limit) return out;
  const show = (x: unknown) => { const s = JSON.stringify(x); return s && s.length > 200 ? s.slice(0, 200) + "…" : s; };
  if (typeof py === "string" && typeof ts === "string") {
    const a = normaliseText(py), b = normaliseText(ts);
    if (a !== b) {
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      const at = (s: string) => JSON.stringify((i > 40 ? "…" : "") + s.slice(Math.max(0, i - 40), i + 60));
      out.push(`${path}: differs at char ${i}: python ${at(a)} != ts ${at(b)}`);
    }
    return out;
  }
  if (typeof py === "number" && typeof ts === "number") {
    if (!(py === ts || (Number.isNaN(py) && Number.isNaN(ts)))) out.push(`${path}: python ${py} != ts ${ts}`);
    return out;
  }
  if (Array.isArray(py) && Array.isArray(ts)) {
    if (py.length !== ts.length) out.push(`${path}: length python ${py.length} != ts ${ts.length}`);
    for (let i = 0; i < Math.min(py.length, ts.length); i++) diff(py[i], ts[i], `${path}[${i}]`, out, limit);
    return out;
  }
  if (py && ts && typeof py === "object" && typeof ts === "object" && !Array.isArray(py) && !Array.isArray(ts)) {
    const a = py as Record<string, unknown>, b = ts as Record<string, unknown>;
    // a key that is absent on one side and null on the other is the same (Python None vs JS undefined)
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if ((a[k] ?? null) === null && (b[k] ?? null) === null) continue;
      if (!(k in a)) out.push(`${path}.${k}: missing in python, ts ${show(b[k])}`);
      else if (!(k in b)) out.push(`${path}.${k}: missing in ts, python ${show(a[k])}`);
      else diff(a[k], b[k], `${path}.${k}`, out, limit);
      if (out.length >= limit) break;
    }
    return out;
  }
  if ((py ?? null) !== (ts ?? null)) out.push(`${path}: python ${show(py)} != ts ${show(ts)}`);
  return out;
}
