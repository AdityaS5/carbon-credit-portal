import { Page } from "@/components/ui.tsx";
import { DATA, N_CONDITIONS, N_REVIEWED, SOURCES } from "@/lib/data.ts";

const KIND: Record<string, string> = { document: "document", page: "publisher page", list_page: "publisher list" };

export default function Sources() {
  const cited = new Map<string, number>();
  for (const c of DATA.conditions) { const d = c.source?.doc; if (d) cited.set(d, (cited.get(d) ?? 0) + 1); }
  const docs = Object.entries(SOURCES).sort((a, b) => a[1].title.localeCompare(b[1].title));
  return (
    <Page>
      <div className="stack" style={{ ["--gap" as string]: "22px" }}>
        <h1>Sources</h1>
        <p className="soft" style={{ maxWidth: 760 }}>
          The {N_CONDITIONS} applicability conditions ({N_REVIEWED} reviewed rules) were extracted from the methodology and eligibility PDFs
          below. The PDFs themselves are not republished here; each citation on the site links to the publisher&apos;s page instead. Page
          numbers are PDF page indexes (1-based), which can differ from the printed page number.
        </p>
        <div className="card lg">
          <div className="ladder" style={{ borderTop: 0 }}>
            <table style={{ minWidth: 640 }}>
              <thead><tr><th>Document</th><th>Link</th><th>Conditions citing it</th><th>URL checked</th></tr></thead>
              <tbody>
                {docs.map(([id, s]) => (
                  <tr key={id}>
                    <td><b>{s.title}</b>{s.publisher ? <span className="d">{s.publisher}</span> : null}{s.note ? <span className="d">{s.note}</span> : null}</td>
                    <td className="small">{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{KIND[s.kind ?? ""] ?? "link"} ↗</a> : "—"}</td>
                    <td className="small">{cited.get(id) ?? 0}</td>
                    <td className="small muted">{s.checked ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="small muted">Grid emission factors: CEA CO₂ Baseline Database v22.0. Issuance timelines: Verra and Gold Standard registry exports. Price bands carry
          their own dated sources on each route card.</p>
      </div>
    </Page>
  );
}
