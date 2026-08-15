"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface SessionData {
  configured: boolean;
  authenticated: boolean;
  csrfToken: string | null;
  inviteUrl: string | null;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

interface SessionContextValue {
  session: SessionData | null;
  loading: boolean;
  refresh(): Promise<void>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
      setSession((await response.json()) as SessionData);
    } catch {
      setSession({ configured: false, authenticated: false, csrfToken: null, inviteUrl: null, user: null });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.json() as Promise<SessionData>)
      .then((data) => { if (active) setSession(data); })
      .catch(() => { if (active) setSession({ configured: false, authenticated: false, csrfToken: null, inviteUrl: null, user: null }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const logout = useCallback(async () => {
    if (!session?.csrfToken) return;
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "x-onyx-csrf": session.csrfToken } });
    window.location.href = "/";
  }, [session]);
  const value = useMemo(() => ({ session, loading, refresh, logout }), [session, loading, refresh, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
