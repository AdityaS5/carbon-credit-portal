"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Cite, Page, Tag, VerdictBadge } from "@/components/ui.tsx";
import { citation } from "@/lib/cite.ts";
import { DATA, SOURCES } from "@/lib/data.ts";
import { ladder } from "@/lib/ladder.ts";
import { STD_NAME } from "@/lib/labels.ts";
import { COND, openItems, routeTitle } from "@/lib/routes.ts";
import { useRun } from "@/lib/session.ts";
import { useStore } from "@/lib/store.tsx";

export default function RouteDetailPage() {
  return <Suspense fallback={<Page step={3}><p className="muted">Loading…</p></Page>}><RouteDetail /></Suspense>;
}

const ICON: Record<string, [string, string]> = { met: ["✓", "Met"], not_met: ["✕", "Not met"], unknown: ["?", "Open"] };
const fmtValue = (v: unknown): string =>
  typeof v === "number" ? String(v) : Array.isArray(v) ? v.join(" / ") : v && typeof v === "object" ? JSON.stringify(v).replace(/[{}"]/g, "").replace(/,/g, ", ") : String(v);

function RouteDetail() {
  const id = useSearchParams().get("id") ?? "";
  const store = useStore();
  const { run } = useRun();
  if (!run || !store.profile) {
    return <Page step={3}><div className="stack"><h1>No project yet</h1><p className="soft">Route explanations are worked out against your answers.</p>
      <Link href="/project/" className="btn primary" style={{ alignSelf: "flex-start" }}>Tell us about your project →</Link></div></Page>;
  }
  const route = run.routes.find((r) => r.methodology_id === id);
  if (!route) {
    return <Page step={3}><div className="stack"><h1>Route not in your results</h1>
      <p className="soft">This route was not evaluated for your current answers. See <Link href="/other/">other routes we checked</Link>.</p></div></Page>;
  }
  const row = route.row, p = store.profile;
  const exp = DATA.explanations[id];
  const { rungs, credits } = ladder(route, p);
  const open = new Map(openItems(route, p).map((o) => [o.conditionId, o]));
  const docs = new Set<string>([...route.conditions.map((r) => r.citation?.doc), ...(exp?.points ?? []).map((x) => x.source.doc)]
    .filter((d): d is string => Boolean(d)));

  return (
    <Page step={3}>
      <div className="row" style={{ alignItems: "flex-start", ["--gap" as string]: "32px" }}>
        <div className="mainc stack" style={{ ["--gap" as string]: "20px" }}>
          <Link href="/results/" className="small" style={{ fontWeight: 600, textDecoration: "none" }}>← All routes</Link>
          <div className="stack" style={{ ["--gap" as string]: "10px" }}>
            <div className="row" style={{ ["--gap" as string]: "8px" }}>
              <span className="small soft" style={{ fontWeight: 600 }}>{STD_NAME[row.standard] ?? row.standard}</span>
              <span className="code">{routeTitle(row)}</span>
              <VerdictBadge v={route.overall} small />
            </div>
            <h1 style={{ fontSize: 34 }}>{exp?.plain ?? row.notes}</h1>
            {row.source_url ? <a href={String(row.source_url)} target="_blank" rel="noreferrer" className="small">Publisher page for {routeTitle(row)} ↗</a> : null}
          </div>

          {exp && (
            <section className="card stack">
              <h2 style={{ fontSize: 20 }}>Key points</h2>
              {exp.points.map((pt, i) => (
                <div key={i} className="stack" style={{ ["--gap" as string]: "4px" }}>
                  <span>{pt.text}</span>
                  {pt.source.quote && <blockquote>“{String(pt.source.quote)}”</blockquote>}
                  <Cite c={citation(pt.source)} />
                </div>
              ))}
            </section>
          )}

          <section className="card stack" style={{ ["--gap" as string]: "4px" }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Your project against each condition</h2>
            {route.conditions.map((r) => {
              const c = COND[r.condition_id];
              const o = open.get(r.condition_id);
              const [ic, word] = r.expert_check ? ["⚑", "Expert check"] : ICON[r.verdict];
              const type = c?.type ?? "hard";
              return (
                <div key={r.condition_id} className="check">
                  <span className={`ic ${r.expert_check ? "expert" : r.verdict}`} aria-hidden="true">{ic}</span>
                  <div className="stack" style={{ ["--gap" as string]: "4px" }}>
                    <span className="row" style={{ ["--gap" as string]: "8px" }}><b>{word}</b>
                      <span className="tiny muted">{type === "hard" ? "hard condition" : "soft condition (warning only)"}</span>
                      {r.condition_id.includes("_HF_") && <span className="tiny muted">screening check</span>}</span>
                    <span>{c?.text ?? r.reason}</span>
                    {r.expert_check && <span className="small" style={{ color: "var(--blue)" }}>{r.reason}</span>}
                    {o && !o.expert && o.question && <span className="small soft">Still needed: {o.question}{o.dontKnow ? " (you answered Not sure)" : ""}</span>}
                    {r.verdict === "not_met" && <span className="small soft">{r.reason}</span>}
                    {c?.source?.quote && <blockquote>“{String(c.source.quote)}”</blockquote>}
                    <Cite c={citation(r.citation ?? c?.source)} />
                  </div>
                </div>
              );
            })}
          </section>

          {credits.assumptions.length > 0 && (
            <section className="card stack">
              <h2 style={{ fontSize: 20 }}>How the credits estimate is built</h2>
              <p className="small soft">{rungs[1].value} · {rungs[1].detail}</p>
              <div className="ladder" style={{ borderTop: 0 }}>
                <table style={{ minWidth: 600 }}>
                  <thead><tr><th>Parameter</th><th>Value</th><th>Source</th><th>Status</th></tr></thead>
                  <tbody>{credits.assumptions.map((a, i) => (
                    <tr key={i}><td className="mono small">{a.param}</td><td className="small">{fmtValue(a.value)}</td>
                      <td className="small soft">{a.source}{a.note ? ` · ${a.note}` : ""}</td><td><Tag s={a.status} /></td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <aside className="side stack">
          <div className="card stack" style={{ ["--gap" as string]: "10px" }}>
            <span className="eyebrow">Sources cited on this page</span>
            {[...docs].map((d) => {
              const s = SOURCES[d];
              return (
                <div key={d} className="stack" style={{ ["--gap" as string]: "2px" }}>
                  {s?.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a> : <span>{s?.title ?? d}</span>}
                  {s?.kind === "list_page" && <span className="tiny muted">Publisher list page{s.note ? `: ${s.note}` : ""}</span>}
                </div>
              );
            })}
          </div>
          <div className="card stack" style={{ ["--gap" as string]: "6px" }}>
            <span style={{ fontWeight: 600 }}>No AI was used</span>
            <span className="small soft">The explanation was written in advance and every quote was checked word for word against its PDF page
              when the data was built. The checklist is computed by the rules engine in your browser, so it always matches the verdict.
              Page numbers are PDF page indexes.</span>
          </div>
        </aside>
      </div>
    </Page>
  );
}
