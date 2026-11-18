/** Plain-language labels for vocabulary keys (from the Streamlit UI's ui/vocab.py, same keys as engine/vocab.py). */
export const STD_NAME: Record<string, string> = {
  Verra: "Verra (VCS)", GoldStandard: "Gold Standard", CCTS: "CCTS · India's carbon market", PACM: "PACM (Article 6.4)",
};
export const STD_SHORT: Record<string, string> = { Verra: "Verra", GoldStandard: "GS", CCTS: "CCTS", PACM: "PACM" };

export const SECTORS: Record<string, string> = {
  grid_re: "Renewable electricity sold to the grid",
  landfill_gas: "Landfill gas capture",
  biogas_manure: "Biogas from animal manure",
  ar: "Tree planting or mangrove restoration",
  industrial_ee_fs: "Factory energy saving or fuel switch",
};
export const SECTOR_SHORT: Record<string, string> = {
  grid_re: "Grid renewables", landfill_gas: "Landfill gas", biogas_manure: "Biogas & manure",
  ar: "Afforestation & mangroves", industrial_ee_fs: "Industrial efficiency & fuel switch",
};

export const TECHNOLOGIES: Record<string, Record<string, string>> = {
  grid_re: { solar_pv: "Solar PV", wind_onshore: "Onshore wind", wind_offshore: "Offshore wind", geothermal: "Geothermal", hydro: "Hydro" },
  landfill_gas: { lfg_capture: "Capture gas from a landfill / dumpsite" },
  biogas_manure: { household_biogas: "Household biogas plant", farm_digester: "Digester on a farm",
    centralised_digester: "Central plant taking manure from many farms" },
  ar: { plantation: "Plantation, agroforestry or native forest", mangrove: "Mangrove restoration" },
  industrial_ee_fs: { efficient_equipment: "More efficient motors, pumps, boilers etc.", fuel_switch: "Switch from coal/oil to natural gas",
    renewable_heat: "Renewable heat (e.g. biomass boiler replacing coal)", waste_heat: "Waste heat / waste gas recovery" },
};

export const SIZE_FIELD: Record<string, [string, string, string]> = {
  grid_re: ["capacity_mw", "Capacity", "MW"],
  landfill_gas: ["annual_waste_tpy", "Waste received", "tonnes per year"],
  biogas_manure: ["head_count", "Number of animals", "animals"],
  ar: ["area_ha", "Area to plant", "hectares"],
  industrial_ee_fs: ["mwh_saved", "Electricity saved", "MWh per year"],
};
export const FUEL_SWITCH_SIZE: [string, string, string] = ["fuel_saved_tpy", "Old fuel replaced", "tonnes per year"];

export const BASELINE: Record<string, Record<string, string>> = {
  grid_re: { grid: "Electricity would come from the grid anyway", captive_fossil: "A diesel/coal captive plant" },
  landfill_gas: { vented: "Gas escapes to the air", flared_partly: "Some gas is already flared" },
  biogas_manure: { uncovered_lagoon: "Kept in an open lagoon or pond", liquid_slurry: "Kept as liquid slurry in a pit or tank",
    solid_storage: "Piled or dried as solid manure", daily_spread: "Spread on fields daily", burned_for_fuel: "Dried and burnt as dung cakes" },
  ar: { degraded: "Degraded or barren land", cropland: "Cropland", grassland: "Grassland", forest: "Already forest" },
  industrial_ee_fs: { old_equipment: "Existing older equipment keeps running", coal: "Coal-fired", oil: "Oil/diesel-fired", grid_power: "Grid electricity" },
};

const FUELS_FROM = { bituminous_coal: "Coal (bituminous)", subbituminous_coal: "Coal (sub-bituminous)", lignite: "Lignite",
  diesel: "Diesel", fuel_oil: "Furnace oil", petcoke: "Petcoke", grid_power: "Grid electricity" };
const FUELS_TO = { natural_gas: "Natural gas", renewable_biomass: "Biomass (renewable)", lpg: "LPG" };

/** Optional sizing inputs per sector (sharpen the credits estimate). kind: number | year | options. */
export const SIZING: Record<string, [string, string, "number" | "year" | Record<string, string>][]> = {
  grid_re: [["annual_mwh", "Expected generation (MWh per year), if known", "number"]],
  landfill_gas: [["landfill_opening_year", "Year the landfill started taking waste", "year"],
    ["landfill_closure_year", "Year it stops (or stopped) taking waste, if known", "year"]],
  biogas_manure: [["animal_type", "Main animals", { dairy_cattle: "Dairy cattle", buffalo: "Buffalo", swine: "Pigs" }],
    ["productivity", "Type of farm", { low: "Typical Indian farm (default)", high: "High-yield commercial dairy" }]],
  ar: [["species_group", "Main tree type", { eucalyptus: "Eucalyptus", teak: "Teak", other: "Other / mixed" }],
    ["zone", "Climate zone", { tropical_moist_deciduous: "Tropical moist (most of central & east India)",
      tropical_dry: "Tropical dry (Deccan, Rajasthan fringe)", tropical_rainforest: "Tropical rainforest (Western Ghats, NE)",
      tropical_shrubland: "Tropical shrubland / semi-arid", tropical_mountain: "Tropical mountain",
      subtropical_humid: "Subtropical humid (northern plains, NE hills)", subtropical_dry: "Subtropical dry (Punjab, Haryana, west UP)" }]],
  industrial_ee_fs: [["fuel_from", "Fuel or power used today", FUELS_FROM], ["fuel_to", "Fuel after the switch (fuel-switch projects)", FUELS_TO]],
};

export const STATES: Record<string, string> = {
  AN: "Andaman & Nicobar", AP: "Andhra Pradesh", AR: "Arunachal Pradesh", AS: "Assam", BR: "Bihar", CH: "Chandigarh",
  CG: "Chhattisgarh", DH: "Dadra & Nagar Haveli and Daman & Diu", DL: "Delhi", GA: "Goa", GJ: "Gujarat", HR: "Haryana",
  HP: "Himachal Pradesh", JK: "Jammu & Kashmir", JH: "Jharkhand", KA: "Karnataka", KL: "Kerala", LA: "Ladakh",
  LD: "Lakshadweep", MP: "Madhya Pradesh", MH: "Maharashtra", MN: "Manipur", ML: "Meghalaya", MZ: "Mizoram",
  NL: "Nagaland", OD: "Odisha", PY: "Puducherry", PB: "Punjab", RJ: "Rajasthan", SK: "Sikkim", TN: "Tamil Nadu",
  TS: "Telangana", TR: "Tripura", UP: "Uttar Pradesh", UK: "Uttarakhand", WB: "West Bengal",
};

/** Option labels for questionnaire enums. Unknown keys fall back to a humanised key. */
export const OPTION_LABELS: Record<string, Record<string, string>> = {
  lfg_end_use: { flare: "Burn it in a flare", electricity: "Make electricity", heat: "Make heat", pipeline: "Clean it and supply it by pipeline",
    trucked: "Compress it and truck it" },
  scale: { small: "Under 60,000 t CO₂e a year", large: "60,000 t CO₂e a year or more" },
  farm_scale: { household: "One household", small_farm: "Small farm", large_farm: "Large farm / dairy", centralised: "Central plant serving many farms" },
  manure_baseline_system: BASELINE.biogas_manure,
  biogas_end_use: { cooking: "Cooking", heat: "Heat", electricity: "Electricity", flare: "Flared only" },
  land_ownership: { own: "We own it", lease: "Long-term lease", community: "Community land with agreement", government: "Government land with agreement" },
  target_buyer: { international: "International buyers", domestic: "Indian buyers / CCTS", either: "Either" },
  fuel_to: FUELS_TO, fuel_from: FUELS_FROM,
  animal_type: SIZING.biogas_manure[0][2] as Record<string, string>,
  productivity: SIZING.biogas_manure[1][2] as Record<string, string>,
  species_group: SIZING.ar[0][2] as Record<string, string>,
  zone: SIZING.ar[1][2] as Record<string, string>,
  project_activity_type: { greenfield: "New plant", capacity_addition: "Capacity addition", retrofit: "Retrofit", rehabilitation: "Rehabilitation", replacement: "Replacement" },
  hydro_reservoir: { run_of_river: "Run of river (no reservoir)", existing_no_volume_change: "Existing reservoir, volume unchanged",
    existing_enlarged_pd_gt_4: "Existing reservoir enlarged, power density > 4 W/m²", new_reservoir_pd_gt_4: "New reservoir, power density > 4 W/m²",
    pd_le_4: "Power density 4 W/m² or less" },
  biomass_source: { agro_residue: "Crop residue", forest_residue: "Forest residue", dedicated_plantation: "Dedicated plantation",
    non_renewable: "Non-renewable biomass", not_biomass: "Not biomass" },
  climate_zone: { tropical_wet: "Wet tropical", tropical_dry: "Dry tropical" },
  swds_type: { managed_anaerobic: "Managed, anaerobic", managed_semi_aerobic: "Managed, semi-aerobic", unmanaged_deep: "Unmanaged, deep (≥ 5 m)",
    unmanaged_shallow: "Unmanaged, shallow (< 5 m)", uncategorised: "Don't know the category" },
  ee_mode: { efficiency: "Efficiency upgrade", fuel_switch: "Fuel switch", both: "Both" },
  technology: Object.assign({}, ...Object.values(TECHNOLOGIES)),
};

export const humanise = (k: string): string => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");
export const optionLabel = (field: string, key: string): string => OPTION_LABELS[field]?.[key] ?? humanise(key);

export const VERDICT: Record<string, string> = { eligible: "Eligible", needs_info: "Needs info", ineligible: "Not eligible" };
export const STATUS: Record<string, string> = {
  sourced: "sourced", verify: "source to verify", assumption: "assumption", not_connected: "not connected yet", none: "n/a",
};
