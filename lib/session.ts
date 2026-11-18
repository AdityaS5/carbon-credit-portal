"use client";
import { useMemo } from "react";
import type { RunResult } from "@/engine-ts/src/pipeline.ts";
import { engine } from "./data.ts";
import { useStore } from "./store.tsx";

/** Re-run the engine on the stored profile (cheap: a few ms). */
export function useRun(): { run: RunResult | null; ready: boolean } {
  const { profile, ready } = useStore();
  const run = useMemo(() => (profile ? engine().evaluate(profile) : null), [profile]);
  return { run, ready };
}
