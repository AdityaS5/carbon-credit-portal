/** Node-only helpers: load Data/Derived and the exported eval set from disk. The engine itself does no I/O. */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EngineData } from "./types.ts";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA_DIR = process.env.CCR_DATA_DIR ? resolve(process.env.CCR_DATA_DIR) : join(REPO, "Data", "Derived");

export const readJson = <T = any>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

export function loadData(dir: string = DATA_DIR): Required<EngineData> {
  return {
    registry: readJson(join(dir, "registry.json")),
    conditions: readJson(join(dir, "conditions.json")),
    vocab: readJson(join(dir, "vocab.json")),
    explanations: readJson(join(dir, "explanations.json")),
    intakeSpec: readJson(join(dir, "intake_spec.json")),
  };
}
