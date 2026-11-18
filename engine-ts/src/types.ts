/** Shapes of Data/Derived/*.json and engine outputs (see claude/02_schemas). */

export type Profile = Record<string, unknown> & { _dont_know?: string[] };
export type Verdict = "met" | "not_met" | "unknown";
export type Overall = "eligible" | "ineligible" | "needs_info";

export interface Rule {
  operator: string;
  value?: unknown;
  field?: string | null;
}

export interface Source {
  doc?: string | null;
  page?: number | null;
  para?: string | null;
  quote?: string;
  url?: string;
  [k: string]: unknown;
}

export interface Condition {
  condition_id: string;
  methodology_id: string;
  text: string;
  type: "hard" | "soft";
  profile_field: string | null;
  secondary_fields?: string[] | null;
  rule: Rule | null;
  question?: { text?: string; answer_type?: string; options?: unknown[] } | null;
  source?: Source | null;
  expert_check?: string | null;
  review_status?: string;
  [k: string]: unknown;
}

export interface RegistryRow {
  methodology_id: string;
  standard: string;
  code: string;
  version: string;
  status: string;
  india_route?: string;
  sector: string;
  ccp_status?: string;
  india_a6_eligible?: boolean | "partial";
  a6_note?: string | null;
  a6_rule?: Rule | null;
  pdf_path?: string | null;
  superseded_by?: string | null;
  inactive_from?: string | null;
  notes?: string;
  [k: string]: unknown;
}

export interface ConditionResult {
  condition_id: string;
  verdict: Verdict;
  evaluated_by: "rule" | "llm" | "precheck";
  reason: string;
  citation: Source | null;
  expert_check?: boolean;
}

export interface Evaluation {
  methodology_id: string;
  conditions: ConditionResult[];
  overall: Overall;
  warnings: string[];
}

export interface VocabField {
  type: "enum" | "multi_enum" | "bool" | "number" | "date" | "text";
  options?: string[];
  q?: string;
  per_sector?: boolean;
}

export interface Vocab {
  dont_know: string;
  max_questions: number;
  answer_types: Record<string, string>;
  fields: Record<string, VocabField>;
}

export interface Question {
  profile_field: string;
  unblocks: number;
  unblocks_ids: string[];
  because: string;
  hard: boolean;
  condition_ids: string[];
  question?: { text: unknown; answer_type: string; options: unknown };
}

export interface Explanation {
  plain: string;
  points: { text: string; source: Source }[];
}

export interface IntakeRule {
  sector: string;
  set: string;
  from: string;
  op: "eq" | "copy" | "map";
  value?: unknown;
  otherwise?: "keep";
}

export interface IntakeSpec {
  rules: IntakeRule[];
}

export interface EngineData {
  registry: RegistryRow[];
  conditions: Condition[];
  vocab: Vocab;
  explanations?: Record<string, Explanation>;
  intakeSpec?: IntakeSpec;
}
