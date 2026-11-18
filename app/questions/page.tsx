"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cite, Page, VerdictBadge } from "@/components/ui.tsx";
import { Choice, Multi, NumberField, TriChoice, validMonth } from "@/components/inputs.tsx";
import type { Question } from "@/engine-ts/src/types.ts";
import { citation } from "@/lib/cite.ts";
import { DATA, ROWS, engine } from "@/lib/data.ts";
import { BASELINE, STD_SHORT, optionLabel } from "@/lib/labels.ts";
import { useRun } from "@/lib/session.ts";
import { MAX_ROUNDS, useStore } from "@/lib/store.tsx";

const COND = Object.fromEntries(DATA.conditions.map((c) => [c.condition_id, c]));

function spec(q: Question, sector: string): { text: string; kind: string; options: Record<string, string> | null } {
  if (q.question) {
    const o = q.question.options as string[] | null;
    return { text: String(q.question.text ?? q.because), kind: q.question.answer_type,
      options: o && o.length ? Object.fromEntries(o.map((k) => [k, optionLabel(q.profile_field, k)])) : null };
  }
  if (q.profile_field === "baseline") return { text: "Without this project, what happens today?", kind: "single", options: BASELINE[sector] };
  return { text: q.because + "?", kind: "bool", options: null };
}

const routeName = (mid: string) => `${STD_SHORT[ROWS[mid]?.standard] ?? ""} ${ROWS[mid]?.code ?? mid}`.trim();

export default function Questions() {
  const router = useRouter();
  const store = useStore();
  const { run, ready } = useRun();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!ready) return;
    if (!store.profile) router.replace("/project/");
    else if (run && (!run.questions.length || store.rounds >= MAX_ROUNDS)) router.replace("/results/");
  }, [ready, run, store.profile, store.rounds, router]);

  if (!run || !store.profile) return <Page step={2}><p className="muted">Loading…</p></Page>;
  const p = store.profile;
  const qs = run.questions;
  const open = run.routes.filter((r) => r.overall === "needs_info");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const dk = DATA.vocab.dont_know, out: Record<string, unknown> = {}, errs: Record<string, string> = {};
    for (const q of qs) {
      const v = answers[q.profile_field];
      if (v === undefined || v === null || (Array.isArray(v) && !v.length)) out[q.profile_field] = dk;
      else if (spec(q, String(p.sector)).kind === "month" && !validMonth(v)) errs[q.profile_field] = "Use the form YYYY-MM.";
      else out[q.profile_field] = v;
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const [next] = engine().answer(p, out);
    setAnswers({}); setErrors({});
    store.setProfile(next, store.rounds + 1);
    window.scrollTo(0, 0);
  }

  return (
    <Page step={2}>
      <div className="row" style={{ alignItems: "flex-start", ["--gap" as string]: "32px" }}>
        <form onSubmit={submit} className="mainc stack" style={{ ["--gap" as string]: "18px" }}>
          <div className="stack" style={{ ["--gap" as string]: "10px" }}>
            <div className="row">
              <span className="mono small" style={{ color: "var(--forest)" }}>Round {store.rounds + 1} of up to {MAX_ROUNDS}</span>
              <span className="row" style={{ ["--gap" as string]: "4px" }} aria-hidden="true">
                {Array.from({ length: MAX_ROUNDS }, (_, i) => <span key={i} style={{ width: 40, height: 6, borderRadius: 3,
                  background: i <= store.rounds ? "var(--forest)" : "var(--seg-off)" }} />)}
              </span>
            </div>
            <h1>{qs.length} question{qs.length === 1 ? "" : "s"} decide{qs.length === 1 ? "s" : ""} your routes</h1>
            <p className="soft" style={{ maxWidth: 660 }}>We only ask what an open route still depends on, most decisive first. &quot;Not sure&quot; (or leaving a
              question blank) is a fine answer: the route stays &quot;needs info&quot; and we won&apos;t ask again.</p>
          </div>

          {qs.map((q, i) => {
            const sp = spec(q, String(p.sector));
            const f = q.profile_field, v = answers[f];
            const set = (x: unknown) => setAnswers((a) => ({ ...a, [f]: x }));
            const c = citation(COND[q.condition_ids[0]]?.source);
            return (
              <fieldset key={f} className="card lg">
                <legend className="sr">{sp.text}</legend>
                <div className="pad stack" style={{ ["--gap" as string]: "14px" }}>
                  <div className="row" style={{ ["--gap" as string]: "10px" }}>
                    <span className="mono small muted">Q{i + 1}</span>
                    {q.hard && <span className="tag hard">Deciding question</span>}
                    <span className="small muted">Unblocks {q.unblocks} route{q.unblocks === 1 ? "" : "s"}</span>
                  </div>
                  <span style={{ fontFamily: "var(--head)", fontSize: 21, fontWeight: 600, lineHeight: 1.3 }}>{sp.text}</span>
                  <div className="note info"><span aria-hidden="true">ⓘ</span><span><b style={{ color: "var(--ink)" }}>The condition behind it:</b> {q.because}.</span></div>
                  {sp.kind === "bool" && <TriChoice name={f} value={v as boolean | null | undefined} onChange={(x) => set(x)} />}
                  {sp.kind === "single" && sp.options && <Choice name={f} value={v} options={sp.options} onChange={(x) => set(x)} />}
                  {sp.kind === "multi" && sp.options && (<><Multi name={f} value={v as string[] | null} options={sp.options} onChange={(x) => set(x)} />
                    <span className="small muted">Choose all that apply; leave empty if not sure.</span></>)}
                  {sp.kind === "number" && <NumberField id={f} value={v} onChange={(x) => set(x)} placeholder="Leave empty if not sure" />}
                  {sp.kind === "month" && <input type="month" value={String(v ?? "")} onChange={(e) => set(e.target.value || null)} />}
                  {errors[f] && <span className="err">{errors[f]}</span>}
                </div>
                <div className="foot row between small">
                  <span className="row" style={{ ["--gap" as string]: "6px" }}><span className="muted">Routes affected:</span>
                    {q.unblocks_ids.map((m) => <span key={m} className="code b">{routeName(m)}</span>)}</span>
                  <Cite c={c} />
                </div>
              </fieldset>
            );
          })}

          <div className="row between" style={{ paddingTop: 6 }}>
            <Link href="/results/" className="btn link">Skip for now: show results with open questions</Link>
            <button type="submit" className="btn primary">Update my routes →</button>
          </div>
        </form>

        <aside className="side stack">
          <div className="card stack" style={{ ["--gap" as string]: "14px" }}>
            <span className="eyebrow">Open routes right now</span>
            {open.map((r) => {
              const waits = qs.map((q, i) => (q.unblocks_ids.includes(r.methodology_id) ? `Q${i + 1}` : null)).filter(Boolean);
              return (
                <div key={r.methodology_id} className="stack" style={{ ["--gap" as string]: "4px" }}>
                  <span className="row between"><b>{routeName(r.methodology_id)}</b><VerdictBadge v="needs_info" small /></span>
                  <span className="small soft">{waits.length ? `Waiting on ${waits.join(", ")}` : "Waiting on an answer you marked Not sure"}</span>
                </div>
              );
            })}
            {!open.length && <span className="small soft">No route is waiting on an answer.</span>}
          </div>
          <div className="card stack" style={{ ["--gap" as string]: "6px" }}>
            <span style={{ fontWeight: 600 }}>Why only {qs.length}?</span>
            <span className="small soft">Each question is shared across routes, so you answer it once. At most {DATA.vocab.max_questions} per
              round; everything else was settled by your earlier answers.</span>
          </div>
        </aside>
      </div>
    </Page>
  );
}

