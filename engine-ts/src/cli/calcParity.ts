/**
 * CI parity check for the calculators: every call in evals/calculator_trace.json (written by
 * `python -m calculators.export`) must give the same result in the TS port. Exit 1 on any difference.
 */
import { join } from "node:path";
import { expandPython, runTs, type CalcTrace } from "../calculators/parity.ts";
import { DATA_DIR, readJson, REPO } from "../node.ts";
import { diff } from "../parity.ts";

const trace = readJson<CalcTrace>(process.argv[2] ?? join(REPO, "evals", "calculator_trace.json"));
const data = readJson(join(DATA_DIR, "calculator_data.json"));
const stats = readJson(join(DATA_DIR, "issuance_stats.json"));
let fails = 0;
const byFn: Record<string, number> = {};
for (const c of trace.calls) {
  byFn[c.fn] = (byFn[c.fn] ?? 0) + 1;
  const d = diff(expandPython(trace, c), runTs(data, stats, c));
  if (d.length) {
    fails++;
    if (fails <= 20) console.log(`FAIL ${c.fn} ${JSON.stringify(c.args)}\n     ${d.slice(0, 5).join("\n     ")}`);
  }
}
console.log(Object.entries(byFn).map(([k, v]) => `${k}: ${v}`).join(", "));
console.log(fails ? `${fails} of ${trace.calls.length} calculator calls differ from Python.`
  : `All ${trace.calls.length} calculator calls match the Python reference.`);
process.exit(fails ? 1 : 0);
