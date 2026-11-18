"use client";
import Link from "next/link";
import { Page } from "@/components/ui.tsx";
import { STD_NAME } from "@/lib/labels.ts";
import { otherRoutes, routeTitle, type OtherRoute } from "@/lib/routes.ts";
import { useRun } from "@/lib/session.ts";

const GROUPS: [OtherRoute["group"], string, string][] = [
  ["flag", "Article 6.4 (PACM) flag", "On India's Article 6.4 list with a PACM methodology. Flagged, never recommended: this tool does not assess PACM."],
  ["watchlist", "Pending: rules not final", "Would change when the standard publishes or finalises the rules named below."],
  ["excluded", "Closed or excluded for this project", "Would change only if the rule or your answer changes."],
  ["not_evaluated", "Not evaluated", "Would change when its conditions are extracted from the methodology PDF."],
];

export default function Other() {
  const { run } = useRun();
  if (!run) return <Page step={3}><div className="stack"><h1>No project yet</h1><Link href="/project/">Tell us about your project →</Link></div></Page>;
  const all = otherRoutes(run);
  return (
    <Page step={3}>
      <div className="stack" style={{ ["--gap" as string]: "22px" }}>
        <Link href="/results/" className="small" style={{ fontWeight: 600, textDecoration: "none" }}>← All routes</Link>
        <h1>Other routes we checked</h1>
        <p className="soft" style={{ maxWidth: 720 }}>Every route in your sector is screened. These ones are not recommended for your project, and each says why.</p>
        {GROUPS.map(([g, title, change]) => {
          const items = all.filter((x) => x.group === g);
          if (!items.length) return null;
          return (
            <section key={g} className="card stack" style={{ ["--gap" as string]: "4px" }}>
              <h2 style={{ fontSize: 20 }}>{title} ({items.length})</h2>
              <p className="small muted" style={{ marginBottom: 8 }}>{change}</p>
              {items.map((x) => (
                <div key={x.row.methodology_id} className="check" style={{ gridTemplateColumns: "1fr" }}>
                  <span className="row" style={{ ["--gap" as string]: "8px" }}>
                    <b>{STD_NAME[x.row.standard] ?? x.row.standard}</b><span className="code">{routeTitle(x.row)}</span></span>
                  <span className="small soft">{x.why}</span>
                  {x.row.source_url ? <a className="small" href={String(x.row.source_url)} target="_blank" rel="noreferrer">Publisher page ↗</a> : null}
                </div>
              ))}
            </section>
          );
        })}
        {!all.length && <p className="soft">None.</p>}
      </div>
    </Page>
  );
}
