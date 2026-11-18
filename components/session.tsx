"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { authClient } from "@/lib/auth/auth-client";

/** `name` = username en MAYÚSCULAS. */
export type User = { name: string; email: string } | null;

// Cache de display (evita parpadeo del nav). Nunca guarda tokens ni ids.
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

function parseCache(raw: string | null): User {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.name === "string" && typeof v?.email === "string"
      ? { name: v.name, email: v.email }
      : null;
  } catch {
    return null;
  }
}

function writeCache(u: User) {
  try {
    const next = u ? JSON.stringify({ name: u.name, email: u.email }) : null;
    if (next === localStorage.getItem(KEY)) return;
    if (next) localStorage.setItem(KEY, next);
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

const Ctx = createContext<{
  user: User;
  isPending: boolean;
  signOut: () => Promise<void>;
}>({ user: null, isPending: true, signOut: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const cached = parseCache(
    useSyncExternalStore(subscribe, getSnapshot, () => null),
  );

  const live: User = data
    ? {
        name: (data.user.username ?? data.user.name).toUpperCase(),
        email: data.user.email,
      }
    : null;
  const user = isPending ? cached : live;

  const liveName = live?.name;
  const liveEmail = live?.email;
  useEffect(() => {
    if (isPending) return;
    writeCache(
      liveName && liveEmail ? { name: liveName, email: liveEmail } : null,
    );
  }, [isPending, liveName, liveEmail]);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      writeCache(null);
      router.refresh();
    }
  }, [router]);

  return (
    <Ctx.Provider value={{ user, isPending, signOut }}>{children}</Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
