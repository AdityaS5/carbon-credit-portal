/** Intake-implied fields from the shared spec (Data/Derived/intake_spec.json): port of engine/intake.py. */
import { pyEq, pyIn } from "./py.ts";
import type { IntakeSpec, Profile } from "./types.ts";

export function impliedFields(spec: IntakeSpec, intake: Profile, previous: Profile = {}): Profile {
  const out: Profile = {};
  for (const r of spec.rules) {
    if (intake.sector !== r.sector) continue;
    const src = intake[r.from] ?? null;
    if (r.op === "eq") out[r.set] = pyEq(src, r.value);
    else if (r.op === "copy") out[r.set] = src;
    else if (r.op === "map") {
      const m = r.value as Record<string, unknown>;
      if (typeof src === "string" && pyIn(src, m)) out[r.set] = m[src];
      else if (r.otherwise === "keep") out[r.set] = r.set in intake ? intake[r.set] : previous[r.set] ?? null;
      else out[r.set] = null;
    } else throw new Error(`intake_spec: unknown op ${(r as { op: string }).op}`);
  }
  return out;
}

/** Answers + implied fields, a fresh _dont_know, unanswered (null) fields dropped. */
export function intakeProfile(spec: IntakeSpec, intake: Profile, previous?: Profile): Profile {
  const p: Profile = { ...intake, ...impliedFields(spec, intake, previous), _dont_know: [] };
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null && v !== undefined));
}
