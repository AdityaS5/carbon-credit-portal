/**
 * Offline route explanation (no LLM): port of engine/rag/explain.offline_explanation.
 * Pre-written, quote-checked summary (Data/Derived/explanations.json) + this profile's condition results.
 * BM25 / RAG follow-up Q&A is not ported (needs an API key; local demo mode only).
 */
import { isNone, pyStr } from "./py.ts";
import { conditionFields } from "./questionnaire.ts";
import type { Condition, Evaluation, Explanation, Profile, RegistryRow, Source, Vocab } from "./types.ts";

export const MARK: Record<string, string> = { met: "✅ Met", not_met: "❌ Not met", unknown: "❓ Open" };
export const DOC_NAMES: Record<string, string> = {
  "VCS-Standard-v5.0": "VCS Standard v5.0",
  "A6.4_Form_AC-001_India": "India A6.4 host-party form",
  Requirements_PAA: "GS PAA Requirements P&R100-01",
  "Corrections-and-Clarifications-to-the-VCS-Program-Rules-June-2026": "VCS corrections (Jun 2026)",
};

export function cite(src: Source, registry: Record<string, RegistryRow>): string {
  const doc = src.doc ?? null, page = src.page;
  let para = (src.para ?? "").trim();
  const row = doc != null ? registry[doc] : undefined;
  const name: string | null = row ? `${row.code} v${row.version}` : doc != null ? DOC_NAMES[doc] ?? doc : null;
  if (src.url) return `[${pyStr(name)}](${src.url})`;
  para = /^\d/.test(para) ? `para ${para}` : para; // "Table 2", "§4" stay as printed
  return [name, page ? `p.${page}` : "", para].filter((x) => x).join(", ");
}

export function offlineExplanation(ev: Evaluation, row: RegistryRow, conds: Condition[], profile: Profile,
                                   registry: Record<string, RegistryRow>, explanations: Record<string, Explanation>,
                                   vocab: Vocab): string {
  const exp = explanations[ev.methodology_id];
  const head = `**${row.standard} ${row.code} v${row.version}**`;
  const lines = [head + (exp ? `: ${exp.plain}` : "")];
  if (exp) lines.push("", "**Key points**", ...exp.points.map((p) => `- ${p.text} (${cite(p.source, registry)})`));
  const byId = Object.fromEntries(conds.map((c) => [c.condition_id, c]));
  lines.push("", "**Your project against each condition**");
  for (const r of ev.conditions) {
    const c: Partial<Condition> = byId[r.condition_id] ?? {};
    const text = c.text || r.reason;
    let extra = "";
    if (r.verdict === "unknown") {
      if (r.expert_check) extra = ` ${r.reason}`;
      else {
        const missing = conditionFields(c).filter((f) => isNone(profile[f]) && f in vocab.fields);
        extra = missing.length ? ` Still needed: ${vocab.fields[missing[0]].q}` : "";
      }
    }
    lines.push(`- ${MARK[r.verdict] ?? r.verdict}: ${text}.${extra} (${cite(r.citation ?? {}, registry)})`);
  }
  lines.push("", "_Pre-written explanation, checked against the methodology PDFs; no AI was used. " +
    "Not legal or investment advice._");
  return lines.join("\n");
}
