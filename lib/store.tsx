"use client";
/** The visitor's answers. Kept in this browser tab only (sessionStorage); nothing is sent anywhere. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Profile } from "@/engine-ts/src/types.ts";

export const MAX_ROUNDS = 3; // engine questionnaire: up to 3 rounds of 6

interface State { profile: Profile | null; rounds: number }
interface Store extends State {
  ready: boolean;
  setProfile: (p: Profile | null, rounds?: number) => void;
  reset: () => void;
}

const KEY = "carbon-route-finder.v1";
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ profile: null, rounds: 0 });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch { /* storage unavailable: keep in memory */ }
    setReady(true);
  }, []);
  const save = useCallback((s: State) => {
    setState(s);
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, []);
  const value = useMemo<Store>(() => ({
    ...state, ready,
    setProfile: (p, rounds) => save({ profile: p, rounds: rounds ?? state.rounds }),
    reset: () => save({ profile: null, rounds: 0 }),
  }), [state, ready, save]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
