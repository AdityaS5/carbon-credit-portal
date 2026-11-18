/** Dynamic questionnaire: port of engine/questionnaire.py. */
import { isNone, sortBy, sortedStrings } from "./py.ts";
import { ruleFields } from "./rules.ts";
import type { Condition, Evaluation, Profile, Question, Vocab } from "./types.ts";
import { AnswerError, validateAnswer } from "./vocab.ts";

/** profile_field first, then secondary_fields and any extra fields a compound rule reads. */
export function conditionFields(c: Partial<Condition>): string[] {
  const out: string[] = [];
  for (const f of [c.profile_field, ...(c.secondary_fields ?? []), ...ruleFields(c.rule)]) {
    if (f && !out.includes(f)) out.push(f);
  }
  return out;
}

export function buildQuestions(evals: Evaluation[], condsById: Record<string, Condition>, profile: Profile,
                               vocab: Vocab, cap: number = vocab.max_questions): Question[] {
  const asked = new Set(profile._dont_know ?? []);
  const byField = new Map<string, { profile_field: string; methodologies: Set<string>; condition_ids: string[];
    hard: boolean; fallback: Condition["question"]; because: string }>();
  for (const ev of evals) {
    if (ev.overall !== "needs_info") continue; // no point asking about routes already ruled out
    for (const r of ev.conditions) {
      if (r.verdict !== "unknown") continue;
      const c = condsById[r.condition_id];
      const f = conditionFields(c).find((x) => !asked.has(x) && isNone(profile[x]) && vocab.fields[x].type !== "text");
      if (!f) continue;
      if (!byField.has(f)) {
        byField.set(f, { profile_field: f, methodologies: new Set(), condition_ids: [], hard: false,
          fallback: c.question, because: c.text });
      }
      const q = byField.get(f)!;
      q.methodologies.add(ev.methodology_id);
      q.condition_ids.push(c.condition_id);
      q.hard ||= (c.type ?? "hard") === "hard";
    }
  }
  const ranked = sortBy([...byField.values()], (q) => [-Number(q.hard), -q.methodologies.size, q.profile_field]);
  return ranked.slice(0, cap).map((q) => {
    const spec = vocab.fields[q.profile_field], fb = q.fallback ?? {};
    const item: Question = {
      profile_field: q.profile_field,
      unblocks: q.methodologies.size, // UI shows "affects N routes"
      unblocks_ids: sortedStrings(q.methodologies),
      because: q.because, // UI "Why we ask" line
      hard: q.hard,
      condition_ids: q.condition_ids,
    };
    // Free-text and sector-dependent fields carry no "question": the UI then uses its own question bank.
    if (spec.type !== "text" && !spec.per_sector) {
      item.question = { text: spec.q || fb.text || null, answer_type: vocab.answer_types[spec.type],
        options: spec.options || fb.options || null };
    }
    return item;
  });
}

/** Return [newProfile, errors]. DONT_KNOW marks the field so it is never asked again. */
export function applyAnswers(profile: Profile, answers: Record<string, unknown>, vocab: Vocab): [Profile, Record<string, string>] {
  const next: Profile = { ...profile };
  const errors: Record<string, string> = {};
  const dk = new Set(next._dont_know ?? []);
  for (const [f, v] of Object.entries(answers)) {
    if (!(f in vocab.fields)) {
      errors[f] = "unknown field";
      continue;
    }
    if (v === vocab.dont_know) {
      dk.add(f);
      continue;
    }
    try {
      next[f] = validateAnswer(vocab, f, v);
      dk.delete(f);
    } catch (e) {
      if (!(e instanceof AnswerError)) throw e;
      errors[f] = e.message;
    }
  }
  next._dont_know = sortedStrings(dk);
  return [next, errors];
}
