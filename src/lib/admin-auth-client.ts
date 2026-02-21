"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";

export type AdminSessionState = {
  hasAuthConfig: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  session: Session | null;
  authStatus: "idle" | "loading" | "error";
  authError: string | null;
  signInWithGitHub: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAdminStatus: () => Promise<void>;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let cachedClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }

  return cachedClient;
}

export async function getCurrentAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return null;
  }

  return data.session?.access_token ?? null;
}

async function fetchAdminStatus(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/session", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { isAdmin?: boolean };
    return Boolean(data.isAdmin);
  } catch {
    return false;
  }
}

export function useAdminSession(): AdminSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "error">("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const syncRequestIdRef = useRef(0);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const hasAuthConfig = Boolean(supabase);

  const refreshAdminStatus = async () => {
    if (!session?.access_token) {
      setIsAdmin(false);
      return;
    }

    syncRequestIdRef.current += 1;
    const requestId = syncRequestIdRef.current;
    const nextIsAdmin = await fetchAdminStatus(session.access_token);
    if (requestId === syncRequestIdRef.current) {
      setIsAdmin(nextIsAdmin);
    }
  };

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    const syncSession = async (nextSession: Session | null) => {
      syncRequestIdRef.current += 1;
      const requestId = syncRequestIdRef.current;

      if (!active) {
        return;
      }

      setSession(nextSession);
      if (!nextSession?.access_token) {
        if (requestId === syncRequestIdRef.current) {
          setIsAdmin(false);
        }
        return;
      }

      const nextIsAdmin = await fetchAdminStatus(nextSession.access_token);
      if (active && requestId === syncRequestIdRef.current) {
        setIsAdmin(nextIsAdmin);
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      void syncSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithGitHub = async (redirectPath = "/") => {
    if (!supabase) {
      setAuthStatus("error");
      setAuthError("Supabase auth config is missing.");
      return;
    }

    setAuthStatus("loading");
    setAuthError(null);

    const redirectTo = `${window.location.origin}${redirectPath}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo,
        scopes: "read:user user:email",
      },
    });

    if (error) {
      setAuthStatus("error");
      setAuthError(error.message);
      return;
    }

    setAuthStatus("idle");
    setAuthError(null);
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setIsAdmin(false);
    setAuthStatus("idle");
    setAuthError(null);
  };

  return {
    hasAuthConfig,
    isAuthenticated: Boolean(session?.access_token),
    isAdmin,
    session,
    authStatus,
    authError,
    signInWithGitHub,
    signOut,
    refreshAdminStatus,
  };
}
