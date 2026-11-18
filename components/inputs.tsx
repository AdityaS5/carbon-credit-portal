"use client";
import type { ReactNode } from "react";

type Tri = boolean | null | undefined;

/** Yes / No / Not sure (null = not answered; never treated as "no"). */
export function TriChoice({ name, value, onChange, labels }: { name: string; value: Tri; onChange: (v: boolean | null) => void;
  labels?: [string, string] }) {
  const opts: [boolean | null, string][] = [[true, labels?.[0] ?? "Yes"], [false, labels?.[1] ?? "No"], [null, "Not sure"]];
  return (
    <div className="opts" role="radiogroup">
      {opts.map(([v, t]) => {
        const sel = (value ?? null) === v;
        return (
          <label key={t} className={`opt${sel ? " sel" : ""}${v === null ? " unsure" : ""}`}>
            <input type="radio" name={name} checked={sel} onChange={() => onChange(v)} />{t}
          </label>
        );
      })}
    </div>
  );
}

export function Choice({ name, value, options, onChange, unsure = true }: { name: string; value: unknown;
  options: Record<string, string>; onChange: (v: string | null) => void; unsure?: boolean }) {
  const entries: [string | null, string][] = [...Object.entries(options), ...(unsure ? [[null, "Not sure"] as [null, string]] : [])];
  return (
    <div className="opts" role="radiogroup">
      {entries.map(([k, t]) => {
        const sel = (value ?? null) === k;
        return (
          <label key={String(k)} className={`opt${sel ? " sel" : ""}${k === null ? " unsure" : ""}`}>
            <input type="radio" name={name} checked={sel} onChange={() => onChange(k)} />{t}
          </label>
        );
      })}
    </div>
  );
}

export function Multi({ name, value, options, onChange }: { name: string; value: string[] | null | undefined;
  options: Record<string, string>; onChange: (v: string[] | null) => void }) {
  const cur = value ?? [];
  return (
    <div className="opts">
      {Object.entries(options).map(([k, t]) => {
        const sel = cur.includes(k);
        return (
          <label key={k} className={`opt${sel ? " sel" : ""}`}>
            <input type="checkbox" name={name} checked={sel}
              onChange={() => { const n = sel ? cur.filter((x) => x !== k) : [...cur, k]; onChange(n.length ? n : null); }} />{t}
          </label>
        );
      })}
    </div>
  );
}

export function NumberField({ id, value, onChange, unit, placeholder, min = 0, max, step = "any" }: { id: string; value: unknown;
  onChange: (v: number | null) => void; unit?: string; placeholder?: string; min?: number; max?: number; step?: string }) {
  return (
    <span className="unit">
      <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} placeholder={placeholder}
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      {unit && <span>{unit}</span>}
    </span>
  );
}

export function YesNoRow({ label, why, children }: { label: string; why?: string; children: ReactNode }) {
  return (
    <div className="yn">
      <div className="stack" style={{ ["--gap" as string]: "2px" }}><span style={{ fontWeight: 500 }}>{label}</span>{why && <span className="small muted">{why}</span>}</div>
      {children}
    </div>
  );
}

export const validMonth = (v: unknown): boolean => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
