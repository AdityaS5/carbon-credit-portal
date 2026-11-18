/** Smoke test for the public build: the synced engine + data load, and one profile per sector reaches a verdict.
 * The full parity check against the Python engine runs in the private repo before every sync. */
import { describe, expect, it } from "vitest";
import { Engine } from "../engine-ts/src/index.ts";
import { impliedFields } from "../engine-ts/src/intake.ts";
import { DATA, SOURCES } from "../lib/data.ts";
import { ladder } from "../lib/ladder.ts";
import { citation } from "../lib/cite.ts";

const eng = new Engine(DATA, "2026-12-01");
const base = { state: "MH", start_date: "2027-03", ccts_obligated: false, carbon_considered_pre_investment: true, target_buyer: "either" };
const PROFILES = [
  { sector: "grid_re", technology: "solar_pv", capacity_mw: 10, annual_mwh: 17500, grid_connected: true, has_storage: true, receives_recs: false },
  { sector: "landfill_gas", technology: "lfg_capture", annual_waste_tpy: 200000, landfill_opening_year: 2010, baseline: "vented" },
  { sector: "biogas_manure", technology: "farm_digester", head_count: 2000, animal_type: "dairy_cattle", baseline: "uncovered_lagoon" },
  { sector: "ar", technology: "plantation", area_ha: 40, baseline: "degraded", land_ownership: "own", forest_cleared_10y: false },
  { sector: "industrial_ee_fs", technology: "efficient_equipment", mwh_saved: 5000, baseline: "old_equipment" },
];

describe("public build", () => {
  for (const p0 of PROFILES) {
    it(`${p0.sector}: evaluates, ranks and fills the ladder`, () => {
      const p = { ...base, ...p0, ...impliedFields(DATA.intakeSpec, { ...base, ...p0 }), _dont_know: [] };
      const run = eng.evaluate(p);
      expect(run.routes.length).toBeGreaterThan(0);
      for (const r of run.routes) {
        expect(["eligible", "needs_info", "ineligible"]).toContain(r.overall);
        const { rungs } = ladder(r, p);
        expect(rungs).toHaveLength(5);
        for (const g of rungs) expect(g.value === null || g.confidence !== null).toBe(true);
      }
    });
  }
  it("every cited document has a publisher link", () => {
    for (const c of DATA.conditions) {
      const cit = citation(c.source);
      expect(cit.href, c.condition_id).toMatch(/^https:\/\//);
    }
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
  });
  it("Verra certification cost is tagged not connected until the VVB fee is set", () => {
    const p = { ...base, ...PROFILES[0], _dont_know: [] };
    const verra = eng.evaluate(p).routes.find((r) => r.standard === "Verra")!;
    expect(ladder(verra, p).rungs[3].status).toBe("not_connected");
  });
});
