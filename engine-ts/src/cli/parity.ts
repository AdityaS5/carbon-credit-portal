/**
 * CI parity check: replay evals/cases.json through the TS engine and compare with evals/python_trace.json
 * (written by `python -m evals.export` from the Python reference engine). Exit 1 on any disagreement, or if
 * a case's outcomes disagree with its expected (PDF-derived) outcomes.
 *
 *   node src/cli/parity.ts [--trace path] [--cases path]
 */
import { join } from "node:path";
import { loadEngine, mismatches, runCase, trace, type EvalCase } from "../harness.ts";
import { loadData, readJson, REPO } from "../node.ts";
import { diff } from "../parity.ts";

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const casesFile = readJson<{ as_of: string; max_rounds: number; cases: EvalCase[] }>(arg("--cases", join(REPO, "evals", "cases.json")));
const pyTrace = readJson<{ as_of: string; traces: Record<string, unknown>[] }>(arg("--trace", join(REPO, "evals", "python_trace.json")));

const data = loadData();
const engine = loadEngine(data, casesFile.as_of);
let failures = 0;
const pyById = new Map(pyTrace.traces.map((t) => [t.id as string, t]));
if (pyTrace.as_of !== casesFile.as_of) { console.error(`as_of differs: trace ${pyTrace.as_of}, cases ${casesFile.as_of}`); failures++; }
if (pyById.size !== casesFile.cases.length) { console.error(`case count differs: python ${pyById.size}, cases ${casesFile.cases.length}`); failures++; }

for (const c of casesFile.cases) {
  const run = runCase(engine, data.intakeSpec, c, casesFile.max_rounds);
  const mm = mismatches(run);
  const py = pyById.get(c.id);
  const d = py ? diff(py, trace(engine, run)) : ["no Python trace for this case"];
  const ok = !d.length && !Object.keys(mm).length;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.id}  questions=${run.asked.length}`);
  for (const [mid, [e, g]] of Object.entries(mm)) console.log(`     expected ${mid}: ${e}, TS got ${g}`);
  for (const line of d) console.log(`     parity ${line}`);
}
console.log(failures ? `\n${failures} case(s) failed: TS and Python disagree or verdicts differ from the PDFs.`
  : `\nAll ${casesFile.cases.length} cases: TS engine matches the Python reference and the expected outcomes.`);
process.exit(failures ? 1 : 0);
