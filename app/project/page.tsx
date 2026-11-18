"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/ui.tsx";
import { Choice, NumberField, TriChoice, YesNoRow, validMonth } from "@/components/inputs.tsx";
import { impliedFields } from "@/engine-ts/src/intake.ts";
import type { Profile } from "@/engine-ts/src/types.ts";
import { DATA, engine } from "@/lib/data.ts";
import { BASELINE, FUEL_SWITCH_SIZE, OPTION_LABELS, SECTORS, SIZE_FIELD, SIZING, STATES, TECHNOLOGIES } from "@/lib/labels.ts";
import { MAX_ROUNDS, useStore } from "@/lib/store.tsx";

const SECTOR_HINT: Record<string, string> = {
  grid_re: "Solar, wind, hydro, geothermal", landfill_gas: "Capture and flare or use landfill gas",
  biogas_manure: "Household, farm or central digesters", ar: "Plantations, agroforestry, mangroves",
  industrial_ee_fs: "Efficient equipment, fuel switch, renewable heat",
};

export default function Intake() {
  const router = useRouter();
  const store = useStore();
  const [p, setP] = useState<Profile>({ sector: "grid_re", technology: "solar_pv", grid_connected: true, has_storage: false, ccts_obligated: false });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (store.ready && store.profile) setP(store.profile); }, [store.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: unknown) => setP((cur) => ({ ...cur, [k]: v }));
  const s = String(p.sector);
  const [sizeKey, sizeLabel, sizeUnit] = p.technology === "fuel_switch" || p.technology === "renewable_heat" ? FUEL_SWITCH_SIZE : SIZE_FIELD[s];

  const counts = useMemo(() => {
    const rows = DATA.registry.filter((r) => r.sector === s);
    const c = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
    return { total: rows.length, open: c((r) => r.standard !== "PACM" && r.india_route === "open"),
      pending: c((r) => r.india_route === "pending"), closed: c((r) => r.standard !== "PACM" && r.india_route === "closed"),
      pacm: c((r) => r.standard === "PACM" && r.code !== "none") };
  }, [s]);

  function pickSector(k: string) {
    // a new sector starts from a clean slate, keeping only cross-sector answers
    const keep = ["state", "start_date", "carbon_considered_pre_investment", "ccts_obligated", "target_buyer"];
    const next: Profile = Object.fromEntries(keep.filter((x) => p[x] !== undefined).map((x) => [x, p[x]]));
    next.sector = k;
    next.technology = Object.keys(TECHNOLOGIES[k])[0];
    if (k === "grid_re") Object.assign(next, { grid_connected: true, has_storage: false });
    setP(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p.start_date && !validMonth(p.start_date)) { setError("Start date should look like 2027-03."); return; }
    setError(null);
    const clean: Profile = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
    const profile: Profile = { ...clean, ...impliedFields(DATA.intakeSpec, clean, store.profile ?? {}), _dont_know: [] };
    const run = engine().evaluate(profile);
    store.setProfile(profile, 0);
    router.push(run.questions.length && MAX_ROUNDS > 0 ? "/questions/" : "/results/");
  }

  return (
    <Page step={1}>
      <form onSubmit={submit} className="row" style={{ alignItems: "flex-start", ["--gap" as string]: "32px" }}>
        <div className="mainc stack" style={{ ["--gap" as string]: "18px" }}>
          <div className="stack" style={{ ["--gap" as string]: "10px" }}>
            <h1>Tell us about your project</h1>
            <p className="soft" style={{ maxWidth: 660 }}>Plain-language answers are enough. &quot;Not sure&quot; is always fine: the route stays open and we
              ask a more specific question later.</p>
          </div>

          <section className="card stack" aria-labelledby="g1">
            <h3 id="g1">1 · What kind of project?</h3>
            <div className="tiles" role="radiogroup" aria-label="Sector">
              {Object.entries(SECTORS).map(([k, t]) => (
                <button type="button" key={k} role="radio" aria-checked={s === k} className={`tile${s === k ? " sel" : ""}`} onClick={() => pickSector(k)}>
                  <b>{t}</b><span>{SECTOR_HINT[k]}</span>
                </button>
              ))}
            </div>
            <div className="grid" style={{ ["--min" as string]: "260px" }}>
              <label className="f">Technology
                <select value={String(p.technology)} onChange={(e) => set("technology", e.target.value)}>
                  {Object.entries(TECHNOLOGIES[s]).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </label>
              <label className="f">State / UT
                <select value={String(p.state ?? "")} onChange={(e) => set("state", e.target.value || null)}>
                  <option value="">Choose a state</option>
                  {Object.entries(STATES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="card stack" aria-labelledby="g2">
            <h3 id="g2">2 · Size and timing</h3>
            <div className="grid" style={{ ["--min" as string]: "260px" }}>
              <label className="f" htmlFor={sizeKey}>{sizeLabel}
                <NumberField id={sizeKey} value={p[sizeKey]} onChange={(v) => set(sizeKey, v)} unit={sizeUnit} placeholder="e.g. 50" />
              </label>
              <label className="f">Start of construction or operation
                <input type="month" value={String(p.start_date ?? "")} onChange={(e) => set("start_date", e.target.value || null)} />
                <span className="hint">CCTS needs a start on or after Jan 2025 (rule marked &quot;verify&quot;).</span>
              </label>
            </div>
            {SIZING[s].map(([k, label, kind]) => (
              <div key={k} className="stack" style={{ ["--gap" as string]: "6px" }}>
                <span style={{ fontWeight: 500, fontSize: 15 }}>{label} <span className="small muted">optional, sharpens the credits estimate</span></span>
                {kind === "number" || kind === "year"
                  ? <NumberField id={k} value={p[k]} onChange={(v) => set(k, v)} min={kind === "year" ? 1950 : 0} max={kind === "year" ? 2060 : undefined}
                    step={kind === "year" ? "1" : "any"} unit={kind === "number" ? "MWh/yr" : undefined} />
                  : <Choice name={k} value={p[k]} options={kind} onChange={(v) => set(k, v)} />}
              </div>
            ))}
          </section>

          <section className="card stack" aria-labelledby="g3">
            <h3 id="g3">3 · Site and finances</h3>
            <div className="stack" style={{ ["--gap" as string]: "6px" }}>
              <span style={{ fontWeight: 500 }}>Without this project, what happens today?</span>
              <Choice name="baseline" value={p.baseline} options={BASELINE[s]} onChange={(v) => set("baseline", v)} />
            </div>
            <div>
              <YesNoRow label="Was carbon revenue considered before the investment decision, with written evidence (board note, loan file)?"
                why="Most standards want proof that carbon income was part of the investment case.">
                <TriChoice name="ccpi" value={p.carbon_considered_pre_investment as boolean | null} onChange={(v) => set("carbon_considered_pre_investment", v)} />
              </YesNoRow>
              {["grid_re", "landfill_gas", "biogas_manure"].includes(s) && (
                <YesNoRow label="Will it supply electricity to the grid?" why="Grid renewables routes cover grid-connected plants only.">
                  <TriChoice name="grid" value={p.grid_connected as boolean | null} onChange={(v) => set("grid_connected", v)} />
                </YesNoRow>
              )}
              {s === "grid_re" && (<>
                <YesNoRow label="Will the plant include battery or other energy storage?" why="India's CCTS route accepts grid solar and onshore wind only as hybrids with storage.">
                  <TriChoice name="bess" value={p.has_storage as boolean | null} onChange={(v) => set("has_storage", v)} />
                </YesNoRow>
                <YesNoRow label="Will you also sell RECs or get a green-power subsidy for the same electricity?" why="Verra treats this as possible double claiming (a risk warning, not a rejection).">
                  <TriChoice name="recs" value={p.receives_recs as boolean | null} onChange={(v) => set("receives_recs", v)} />
                </YesNoRow>
              </>)}
              {s === "ar" && (<>
                <div className="yn"><span style={{ fontWeight: 500 }}>Who holds rights to the land?</span>
                  <Choice name="land" value={p.land_ownership} options={OPTION_LABELS.land_ownership} onChange={(v) => set("land_ownership", v)} /></div>
                <YesNoRow label="Was any natural forest cleared on this land in the last 10 years?">
                  <TriChoice name="cleared" value={p.forest_cleared_10y as boolean | null} onChange={(v) => set("forest_cleared_10y", v)} />
                </YesNoRow>
              </>)}
              <YesNoRow label="Is your company an obligated entity under India's carbon market (CCTS)?"
                why="Obligated entities are large emitters in sectors notified by BEE (e.g. cement, steel). They can't earn CCTS offset credits.">
                <TriChoice name="obl" value={p.ccts_obligated as boolean | null} onChange={(v) => set("ccts_obligated", v)} />
              </YesNoRow>
            </div>
          </section>

          <section className="card stack" aria-labelledby="g4">
            <h3 id="g4">4 · Who will buy the credits?</h3>
            <Choice name="buyer" value={p.target_buyer} options={OPTION_LABELS.target_buyer} onChange={(v) => set("target_buyer", v)} />
            <span className="small muted">Changes the order of routes only: domestic buyers see CCTS first, international buyers Verra and Gold Standard first.</span>
          </section>

          {error && <p className="err" role="alert">{error}</p>}
          <div className="row between">
            <button type="button" className="btn link" onClick={() => { store.reset(); pickSector("grid_re"); }}>Start over</button>
            <button type="submit" className="btn primary">Find routes →</button>
          </div>
        </div>

        <aside className="side stack">
          <div className="card stack" style={{ ["--gap" as string]: "10px" }}>
            <span className="eyebrow">Routes we will check</span>
            <span style={{ fontFamily: "var(--head)", fontSize: 28, fontWeight: 600 }}>{counts.total}</span>
            <span className="small soft">{counts.open} open to new Indian projects · {counts.pending} pending · {counts.closed} closed
              {counts.pacm ? ` · ${counts.pacm} Article 6.4 flag` : ""}</span>
          </div>
          <div className="card stack" style={{ ["--gap" as string]: "6px" }}>
            <span style={{ fontWeight: 600 }}>Your answers stay in this browser</span>
            <span className="small soft">The rules run on this page. Nothing is sent to a server and no AI is used.</span>
          </div>
        </aside>
      </form>
    </Page>
  );
}
