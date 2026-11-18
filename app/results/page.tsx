"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cite, Meter, Page, Tag, VerdictBadge } from "@/components/ui.tsx";
import type { Route } from "@/engine-ts/src/pipeline.ts";
import type { Profile } from "@/engine-ts/src/types.ts";
import { ladder } from "@/lib/ladder.ts";
import { SECTORS, STATES, STD_NAME, TECHNOLOGIES } from "@/lib/labels.ts";
import { COND, distinctOpen, openItems, otherRoutes, riskWarnings, routeTitle } from "@/lib/routes.ts";
import { citation } from "@/lib/cite.ts";
import { DATA } from "@/lib/data.ts";
import { useRun } from "@/lib/session.ts";
import { MAX_ROUNDS, useStore } from "@/lib/store.tsx";

const CCP: Record<string, string> = { approved: "approved", conditional: "approved with conditions", not_approved: "not approved",
  not_assessed: "not assessed" };

function chips(p: Profile): string[] {
  const s = String(p.sector);
  const out = [TECHNOLOGIES[s]?.[String(p.technology)] ?? SECTORS[s]];
  if (p.capacity_mw) out.push(`${p.capacity_mw} MW`);
  if (p.annual_mwh) out.push(`${Number(p.annual_mwh).toLocaleString("en-IN")} MWh / yr`);
  if (p.head_count) out.push(`${Number(p.head_count).toLocaleString("en-IN")} animals`);
  if (p.area_ha) out.push(`${p.area_ha} ha`);
  if (p.annual_waste_tpy) out.push(`${Number(p.annual_waste_tpy).toLocaleString("en-IN")} t waste / yr`);
  if (p.has_storage) out.push("with storage");
  if (p.state) out.push(STATES[String(p.state)] ?? String(p.state));
  if (p.start_date) out.push(`Starts ${p.start_date}`);
  if (p.target_buyer) out.push({ domestic: "Domestic buyer", international: "International buyer", either: "Any buyer" }[String(p.target_buyer)] ?? "");
  return out.filter(Boolean);
}

export default function Results() {
  const router = useRouter();
  const store = useStore();
  const { run, ready } = useRun();
  useEffect(() => { if (ready && !store.profile) router.replace("/project/"); }, [ready, store.profile, router]);
  if (!run || !store.profile) return <Page step={3}><p className="muted">Loading…</p></Page>;
  const p = store.profile;
  const n = (v: string) => run.routes.filter((r) => r.overall === v).length;
  const others = otherRoutes(run);
  const canAsk = run.questions.length > 0 && store.rounds < MAX_ROUNDS;

  return (
    <Page step={3}>
      <div className="stack" style={{ ["--gap" as string]: "22px" }}>
        <div className="row between" style={{ alignItems: "flex-end", ["--gap" as string]: "20px" }}>
          <div className="stack" style={{ ["--gap" as string]: "10px" }}>
            <h1>Your routes</h1>
            <div className="row" style={{ ["--gap" as string]: "6px" }}>
              {chips(p).map((c) => <span key={c} className="chip">{c}</span>)}
              <Link href="/project/" className="small" style={{ fontWeight: 600, padding: "4px 10px" }}>Edit</Link>
            </div>
          </div>
          <div className="row" style={{ ["--gap" as string]: "10px" }}>
            <span className="count"><b style={{ color: "var(--forest)" }}>{n("eligible")}</b><span className="small soft">Eligible</span></span>
            <span className="count"><b style={{ color: "var(--amber)" }}>{n("needs_info")}</b><span className="small soft">Needs info</span></span>
            <span className="count"><b style={{ color: "var(--slate)" }}>{n("ineligible")}</b><span className="small soft">Not eligible</span></span>
            <Link href="/other/" className="count"><b>{others.length}</b><span className="small" style={{ color: "var(--forest)", fontWeight: 600 }}>Other routes →</span></Link>
          </div>
        </div>

        {canAsk && (
          <div className="note open row between">
            <span><b>{run.questions.length} more question{run.questions.length === 1 ? "" : "s"}</b> could settle the open routes.</span>
            <Link href="/questions/" className="btn ghost" style={{ padding: "8px 14px" }}>Answer now</Link>
          </div>
        )}
        {!run.routes.length && <div className="note info">No route passed the screening checks for this project. See <Link href="/other/">other routes we checked</Link> for the reasons.</div>}

        <div className="grid" style={{ ["--min" as string]: "320px", gap: 12 }}>
          <div className="card stack" style={{ ["--gap" as string]: "6px", padding: "16px 20px" }}>
            <span className="eyebrow">Order (rank_basis)</span>
            <span className="mono small">{run.rank_basis}</span>
            <span className="small muted">A labelled ordering, not a score.</span>
          </div>
          <div className="card stack" style={{ ["--gap" as string]: "8px", padding: "16px 20px" }}>
            <span className="eyebrow">Source status tags</span>
            <div className="row" style={{ ["--gap" as string]: "6px" }}>{["sourced", "verify", "assumption", "not_connected", "none"].map((s) => <Tag key={s} s={s} />)}</div>
          </div>
        </div>

        {run.routes.map((r, i) => <RouteCard key={r.methodology_id} r={r} rank={i + 1} p={p} canAsk={canAsk} />)}

        <Link href="/other/" className="card row between" style={{ borderStyle: "dashed", borderColor: "var(--mint)", textDecoration: "none", color: "var(--ink)" }}>
          <span className="stack" style={{ ["--gap" as string]: "2px" }}><b>Other routes we checked ({others.length})</b>
            <span className="small soft">{summary(others.map((o) => o.group))}</span></span>
          <span style={{ fontWeight: 600, color: "var(--forest)" }}>See why →</span>
        </Link>
        <p className="small muted">Screening estimates for a demo. Not investment, legal or certification advice; a validation body makes the final call.</p>
      </div>
    </Page>
  );
}

function summary(groups: string[]): string {
  const c = (g: string) => groups.filter((x) => x === g).length;
  return [[c("excluded"), "closed or excluded"], [c("watchlist"), "pending"], [c("not_evaluated"), "not evaluated"], [c("flag"), "Article 6.4 flag"]]
    .filter(([k]) => k).map(([k, t]) => `${k} ${t}`).join(" · ") || "none";
}

function RouteCard({ r, rank, p, canAsk }: { r: Route; rank: number; p: Profile; canAsk: boolean }) {
  const row = r.row;
  const { rungs } = ladder(r, p);
  const open = distinctOpen(openItems(r, p));
  const questions = open.filter((o) => !o.expert);
  const experts = open.filter((o) => o.expert);
  const failed = r.conditions.filter((c) => c.verdict === "not_met" && COND[c.condition_id]?.type !== "soft");
  return (
    <article className="card lg">
      <div className="row" style={{ alignItems: "flex-start", padding: "24px 26px 18px", ["--gap" as string]: "18px" }}>
        <span className="rank" aria-label={`Rank ${rank}`}>{rank}</span>
        <div className="stack" style={{ flex: "1 1 420px", ["--gap" as string]: "6px" }}>
          <div className="row" style={{ ["--gap" as string]: "8px" }}>
            <span className="small soft" style={{ fontWeight: 600 }}>{STD_NAME[row.standard] ?? row.standard}</span>
            <span className="code">{routeTitle(row)}</span>
            <span className="tiny muted">CCP: {CCP[row.ccp_status ?? ""] ?? row.ccp_status}</span>
          </div>
          <h2 style={{ fontSize: 21, lineHeight: 1.3 }}>{DATA.explanations[r.methodology_id]?.plain ?? row.notes}</h2>
        </div>
        <VerdictBadge v={r.overall} />
      </div>

      <div className="stack" style={{ padding: "0 26px 14px", ["--gap" as string]: "10px" }}>
        {questions.map((o) => (
          <div key={o.conditionId} className="note open row between">
            <span><b>Open question:</b> {o.question ?? o.text}{o.dontKnow ? " You answered “Not sure”, so we won't ask again." : ""}</span>
            {canAsk && !o.dontKnow && <Link href="/questions/" className="btn ghost" style={{ padding: "8px 14px" }}>Answer now</Link>}
          </div>
        ))}
        {experts.map((o) => <div key={o.conditionId} className="note expert"><span aria-hidden="true">⚑</span><span>{o.expert}</span></div>)}
        {riskWarnings(r).map((w) => (
          <div key={w.text} className="note warn"><span aria-hidden="true">⚠</span>
            <span><b style={{ color: "var(--amber-ink)" }}>Risk warning:</b> {w.text}{w.source ? <>. A soft condition, so this is a warning, not a rejection. <Cite c={citation(w.source)} /></> : null}</span></div>
        ))}
        {r.overall === "ineligible" && (
          <div className="note info"><span><b>Why not:</b> {failed.map((c) => COND[c.condition_id]?.text ?? c.reason).join(" · ")}</span></div>
        )}
      </div>

      {r.overall !== "ineligible" && (
        <div className="ladder">
          <table>
            <thead><tr><th scope="col" style={{ width: "22%" }}>Output</th><th scope="col">Estimate and basis</th>
              <th scope="col" style={{ width: 160 }}>Confidence</th><th scope="col" style={{ width: 150 }}>Source</th></tr></thead>
            <tbody>
              {rungs.map((g, i) => (
                <tr key={g.key}>
                  <th scope="row" style={{ fontWeight: 500 }}><span className="mono tiny muted" style={{ marginRight: 8 }}>{i + 1}</span>{g.label}</th>
                  <td><span className="v">{g.value ?? (g.status === "not_connected" ? "Not connected yet" : "—")}</span><span className="d">{g.detail}</span></td>
                  <td><Meter c={g.confidence} /></td>
                  <td><Tag s={g.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="foot row between">
        <span className="small muted">Verdict decided by reviewed rules · no AI used</span>
        <Link href={`/route/?id=${encodeURIComponent(r.methodology_id)}`} style={{ fontWeight: 600, textDecoration: "none" }}>Explanation, checklist &amp; sources →</Link>
      </div>
    </article>
  );
}
