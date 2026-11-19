/**
 * CI parity check for explore mode: run the 15 cases in evals/explore_cases.json through the TS shortlist and
 * compare with evals/explore_trace.json (Python reference, written by `python -m evals.export`) and with each
 * case's expected order, blocker codes, main blocker and not-shortlisted reasons. Exit 1 on any difference.
 */
import { join } from "node:path";
import { shortlist, type ExploreData } from "../explore.ts";
import { DATA_DIR, readJson, REPO } from "../node.ts";
import { diff } from "../parity.ts";

const cases = readJson<{ cases: any[] }>(join(REPO, "evals", "explore_cases.json")).cases;
const trace = readJson<{ traces: Record<string, unknown> }>(join(REPO, "evals", "explore_trace.json")).traces;
const data: ExploreData = {
  spec: readJson(join(DATA_DIR, "explore_conversions.json")),
  registry: readJson(join(DATA_DIR, "registry.json")),
  issuance: readJson(join(DATA_DIR, "issuance_stats.json")),
  calc: readJson(join(DATA_DIR, "calculator_data.json")),
};
let fails = 0;
for (const c of cases) {
  const out: any = shortlist(c.inputs, data);
  const problems = diff(trace[c.id], out);
  const order = out.shortlist.map((i: any) => [i.sector, i.technology]);
  if (JSON.stringify(order) !== JSON.stringify(c.order)) problems.push(`order ${JSON.stringify(order)} != expected ${JSON.stringify(c.order)}`);
  for (const i of out.shortlist) {
    const want = [...c.blockers[i.sector]].sort(), got = [...i.blocker_codes].sort();
    if (JSON.stringify(want) !== JSON.stringify(got)) problems.push(`${i.sector} blockers ${got} != expected ${want}`);
    if (i.main_blocker_code !== c.main_blocker[i.sector]) problems.push(`${i.sector} main blocker ${i.main_blocker_code} != ${c.main_blocker[i.sector]}`);
  }
  const ns = Object.fromEntries(out.not_shortlisted.map((n: any) => [n.sector, n.reason_code]));
  if (JSON.stringify(Object.entries(ns).sort()) !== JSON.stringify(Object.entries(c.not_shortlisted).sort())) problems.push(`not_shortlisted ${JSON.stringify(ns)}`);
  if (problems.length) fails++;
  console.log(`${problems.length ? "FAIL" : "ok  "} ${c.id}`);
  for (const p of problems.slice(0, 8)) console.log(`     ${p}`);
}
console.log(fails ? `\n${fails} explore case(s) failed.` : `\nAll ${cases.length} explore cases: TS shortlist matches Python and the expected shortlists.`);
process.exit(fails ? 1 : 0);
