import Link from "next/link";
import { Footer, Header } from "@/components/ui.tsx";
import { LADDER, SEGMENTS } from "@/lib/ladder.ts";
import { N_CONDITIONS, OPEN_ROUTES } from "@/lib/data.ts";
import { SECTOR_SHORT } from "@/lib/labels.ts";

export default function Start() {
  return (
    <>
      <Header />
      <main>
        <section className="wrap stack" style={{ ["--gap" as string]: "40px", paddingTop: 32 }}>
          <div className="stack" style={{ maxWidth: 820, ["--gap" as string]: "18px" }}>
            <div className="row mono small soft" style={{ ["--gap" as string]: "8px" }}>
              {["Verra (VCS)", "Gold Standard", "CCTS · India", "Article 6.4 (PACM)"].map((s) => <span key={s} className="chip">{s}</span>)}
            </div>
            <h1 className="hero">Find the carbon-credit route your project can actually use.</h1>
            <p className="soft" style={{ fontSize: 19, maxWidth: 700 }}>
              Answer plain-language questions. We check your project against the applicability conditions of every
              methodology open to Indian projects today, then show what each route could earn, how long it takes and how
              sure we are.
            </p>
          </div>
          <div className="grid" style={{ ["--min" as string]: "340px", gap: 20 }}>
            <Link href="/project/" className="entry dark">
              <div className="row between"><HouseIcon /><span className="small" style={{ fontWeight: 600, color: "#BFE3CF" }}>Most people start here</span></div>
              <div className="stack" style={{ ["--gap" as string]: "8px" }}>
                <span className="t">I have a project</span>
                <span style={{ color: "#D7EBDF", maxWidth: 440 }}>Tell us what you&apos;re building. Get ranked routes with estimated credits, time to first
                  issuance, certification cost and price, each with a confidence level.</span>
              </div>
              <div className="bottom"><span className="small" style={{ color: "#BFE3CF" }}>About 12 intake questions · then up to 3 short rounds</span>
                <span className="btn cta">Check my project →</span></div>
            </Link>
            <div className="entry light disabled" aria-disabled="true">
              <div className="row between"><CompassIcon /><span className="tag verify">Coming next</span></div>
              <div className="stack" style={{ ["--gap" as string]: "8px" }}>
                <span className="t">I don&apos;t have a project yet</span>
                <span className="soft" style={{ maxWidth: 440 }}>Tell us about your land, budget and access to resources, and get a shortlist of project
                  types worth exploring. This mode is being built: its land and budget conversion data is still being checked
                  against sources.</span>
              </div>
              <div className="bottom"><span className="small muted">A heuristic shortlist, never an eligibility verdict</span>
                <Link href="/project/" className="btn ghost">Check a project instead →</Link></div>
            </div>
          </div>
        </section>

        <section id="how" className="wrap stack" style={{ paddingTop: 56 }}>
          <h2>How the answer is made</h2>
          <div className="grid" style={{ ["--min" as string]: "280px" }}>
            <Step n="01 · Rules from the source" t={`${N_CONDITIONS} applicability conditions`}
              d="Extracted from the methodology PDFs. Every quote is checked word for word against its page before the site is built." />
            <Step n="02 · Code decides" t="No AI decides eligibility"
              d="Reviewed rules run in your browser. Any failed hard condition means not eligible, any open one means we ask, otherwise eligible." />
            <Step n="03 · Honest numbers" t="Confidence on every output"
              d={'Each figure shows how sure we are and where it came from. Where we have no data, we say "not connected yet" instead of guessing.'} />
          </div>
        </section>

        <section id="ladder" className="wrap grid" style={{ paddingTop: 56, ["--min" as string]: "340px", gap: 32, alignItems: "start" }}>
          <div className="stack" style={{ ["--gap" as string]: "12px" }}>
            <h2>What you get for each route</h2>
            <p className="soft">Five outputs, in falling order of confidence. The top rung is a rule-checked verdict; the bottom is a dated market band.</p>
          </div>
          <ol className="ol-ladder">
            {LADDER.map(([k, label, c], i) => (
              <li key={k}>
                <span className="mono small muted" style={{ width: 20 }}>{i + 1}</span>
                <span style={{ flex: "1 1 auto", fontWeight: 500 }}>{label}</span>
                <span className="meter"><span className="segs" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((j) => <span key={j} className={`seg${j < SEGMENTS[c] ? " on" : ""}`} style={{ width: 16, height: 7 }} />)}
                </span><span style={{ width: 96, textAlign: "right" }}>{c.charAt(0).toUpperCase() + c.slice(1)}</span></span>
              </li>
            ))}
          </ol>
        </section>

        <section id="coverage" className="wrap stack" style={{ paddingTop: 56 }}>
          <h2>Sectors covered in v1</h2>
          <div className="row" style={{ ["--gap" as string]: "10px" }}>
            {Object.values(SECTOR_SHORT).map((s) => <span key={s} className="card" style={{ padding: "10px 16px", borderRadius: 12, fontWeight: 500 }}>{s}</span>)}
          </div>
          <p className="small muted">{OPEN_ROUTES.length} routes are open to new Indian projects today. Article 6.4 (PACM) routes are flagged where
            India&apos;s eligible-activity list and a PACM methodology overlap, never recommended. CDM is a reference library only.
            Every citation links to the publisher&apos;s page; see <Link href="/sources/">sources</Link>.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Step({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="card stack" style={{ ["--gap" as string]: "10px", padding: 24 }}>
      <span className="mono small" style={{ color: "var(--forest)" }}>{n}</span>
      <span style={{ fontWeight: 600, fontSize: 18 }}>{t}</span>
      <span className="soft" style={{ fontSize: 15 }}>{d}</span>
    </div>
  );
}
const HouseIcon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><rect x="1" y="1" width="42" height="42" rx="12" fill="none" stroke="#7FC4A1" strokeWidth="1.5" />
    <path d="M13 30V18l9-6 9 6v12" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinejoin="round" /><path d="M19 30v-7h6v7" stroke="#F2B84B" strokeWidth="2" fill="none" /></svg>
);
const CompassIcon = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><rect x="1" y="1" width="42" height="42" rx="12" fill="none" stroke="#9DB4A7" strokeWidth="1.5" />
    <circle cx="22" cy="22" r="9" stroke="#17573F" strokeWidth="2" fill="none" /><path d="M26 18l-2.5 6.5L17 27l2.5-6.5z" fill="#17573F" /></svg>
);
