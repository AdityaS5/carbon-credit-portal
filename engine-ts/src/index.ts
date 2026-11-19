/** Public API of the TS engine. Data in, results out: no file or network access (works in the browser). */
export { Engine, RANK_BASIS, checkConditions, type Route, type RunResult } from "./pipeline.ts";
export { runRule, ruleFields, OPS, COMPOUND } from "./rules.ts";
export { overall } from "./verdict.ts";
export { hardFilter, START_RULES } from "./hardFilter.ts";
export { buildQuestions, applyAnswers, conditionFields } from "./questionnaire.ts";
export { validateAnswer } from "./vocab.ts";
export { offlineExplanation, cite } from "./explain.ts";
export { impliedFields, intakeProfile } from "./intake.ts";
export type * from "./types.ts";
export { shortlist, intlMedian, type ExploreData, type ExploreSpec, type ExploreInputs } from "./explore.ts";
