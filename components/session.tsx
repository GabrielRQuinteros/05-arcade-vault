"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

export type User = { name: string } | null;

const KEY = "av_user";
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const getSnapshot = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const Ctx = createContext<{
  user: User;
  signIn: (u: User) => void;
  signOut: () => void;
}>({ user: null, signIn: () => {}, signOut: () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  let user: User = null;
  try {
    user = raw ? JSON.parse(raw) : null;
  } catch {}

  const write = useCallback((u: User) => {
    try {
      if (u) localStorage.setItem(KEY, JSON.stringify(u));
      else localStorage.removeItem(KEY);
    } catch {}
    listeners.forEach((l) => l());
  }, []);

  return (
    <Ctx.Provider value={{ user, signIn: write, signOut: () => write(null) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
