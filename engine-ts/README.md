# engine-ts

TypeScript port of the carbon-credit route engine for the static React / Next.js site
(decisions log, 18 Nov 2026). **The Python engine in `../engine` and `../calculators` is the reference**: this port
must reproduce it exactly, and CI fails if it doesn't.

What's ported (data in, results out; no file or network access, so it runs in the browser):

| TS (`src/`) | Python reference |
|---|---|
| `rules.ts` (14 operators, nested `any_of` / `all_of`, three-valued) | `engine/rules.py` |
| `verdict.ts`, `hardFilter.ts`, `evaluator.ts` (reviewed rules only) | `engine/verdict.py`, `hard_filter.py`, `evaluator.py` with `llm=None` |
| `questionnaire.ts`, `vocab.ts` | `engine/questionnaire.py`, `engine/vocab.validate_answer` |
| `pipeline.ts` (`Engine`: evaluate, answer, runLoop, ranking) | `engine/pipeline.py` |
| `explain.ts` (offline explanation) | `engine/rag/explain.offline_explanation` |
| `intake.ts` (intake-implied fields) | `engine/intake.py` (shared spec `engine/intake_spec.json`) |
| `calculators/` (credits, price bands, issuance lookup) | `calculators/credits.py`, `prices.py`, `issuance.time_to_first_issuance` |
| `calculators/profile.ts` (profile → estimator inputs, incl. `GRID_TECH`: `solar_pv` → `solar`) | `ui/estimates.estimator_inputs` + the calculator call in `ui/estimates.credits` |

Not ported: the LLM path, BM25 / RAG (local demo mode only), and the issuance statistics build
(`issuance_stats.json` is precomputed).

## Data it reads (`Data/Derived/`)
`registry.json`, `conditions.json`, `explanations.json` (from `python -m extraction.build`);
`vocab.json`, `intake_spec.json` (from `python -m engine.export_spec`);
`calculator_data.json` (from `python -m calculators.export`); `issuance_stats.json` (from `python -m calculators.issuance`).

## Parity with Python
- `python -m evals.export` writes `evals/cases.json` (23 eval cases + expected outcomes) and `evals/python_trace.json`
  (every question round, condition result, outcome, route order and offline explanation from the Python engine).
- `python -m calculators.export` writes `evals/calculator_trace.json` (Python output for ~3,200 calculator calls, incl. profile → estimate for the 23 eval profiles × their routes).
- `npm run parity` replays both through the TS port and compares field by field. The only normalisation: in text,
  an integer-valued float prints as `50.0` in Python and `50` in JS, so both sides drop the `.0` before comparing.
- `tests/test_ts_parity.py` fails if any exported file is stale, so the traces always reflect the current Python code.

```bash
npm ci
npm run typecheck && npm test && npm run parity
```
Node ≥ 22.18 (runs `.ts` directly via type stripping).
