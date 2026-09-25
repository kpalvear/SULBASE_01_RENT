import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { api } from "../api";
import { getEmailRedirectUrl } from "../lib/auth-redirect";
import { authConfigured, getSupabase } from "../lib/supabase";
import { getStoredOrganizationId, setStoredOrganizationId } from "../lib/session";

export type MembershipInfo = {
  organization_id: string;
  name: string;
  slug: string;
  role: string;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  memberships: MembershipInfo[];
  organizationId: string | null;
  role: string | null;
  devBypass: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setActiveOrganization: (organizationId: string) => Promise<void>;
  bootstrapOrganization: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(authConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<MembershipInfo[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [devBypass, setDevBypass] = useState(!authConfigured);

  const refreshProfile = useCallback(async () => {
    if (!authConfigured) {
      setDevBypass(true);
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;

    const { data } = await supabase.auth.getSession();
    const current = data.session;
    setSession(current);

    if (!current) {
      setMemberships([]);
      setOrganizationId(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const storedOrg = getStoredOrganizationId();
    const me = await api<{
      mode: string;
      memberships: MembershipInfo[];
      organization_id: string | null;
      role: string | null;
    }>("GET", "/api/me", undefined, {
      accessToken: current.access_token,
      organizationId: storedOrg,
    });

    if (me.mode === "dev_bypass") {
      setDevBypass(true);
      setOrganizationId(me.organization_id);
      setRole(me.role);
      setMemberships([]);
      setLoading(false);
      return;
    }

    setDevBypass(false);
    setMemberships(me.memberships);

    let active = me.organization_id;
    if (!active && me.memberships.length === 1) {
      active = me.memberships[0].organization_id;
      setStoredOrganizationId(active);
    }
    if (!active && storedOrg && me.memberships.some((m) => m.organization_id === storedOrg)) {
      active = storedOrg;
    }

    setOrganizationId(active);
    setRole(me.role);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authConfigured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase()!;
    void (async () => {
      // Pick up session from email confirmation / magic-link callback in the URL.
      await supabase.auth.getSession();
      await refreshProfile();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      void refreshProfile();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Auth not configured");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refreshProfile();
  }, [refreshProfile]);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Auth not configured");
    const redirectTo = getEmailRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    if (data.session) {
      await refreshProfile();
      return;
    }
    throw new Error(
      `Account created. Check your email to confirm, then sign in. The link will return to ${redirectTo}`,
    );
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setStoredOrganizationId(null);
    setSession(null);
    setMemberships([]);
    setOrganizationId(null);
    setRole(null);
  }, []);

  const setActiveOrganization = useCallback(
    async (id: string) => {
      if (!session) return;
      setStoredOrganizationId(id);
      await api("PUT", "/api/auth/active-organization", { organization_id: id }, {
        accessToken: session.access_token,
        organizationId: id,
      });
      await refreshProfile();
    },
    [session, refreshProfile],
  );

  const bootstrapOrganization = useCallback(
    async (name: string) => {
      if (!session) throw new Error("Sign in required");
      const res = await api<{ organization: { id: string } }>(
        "POST",
        "/api/auth/bootstrap",
        { name },
        { accessToken: session.access_token },
      );
      setStoredOrganizationId(res.organization.id);
      await refreshProfile();
    },
    [session, refreshProfile],
  );

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      memberships,
      organizationId,
      role,
      devBypass,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      setActiveOrganization,
      bootstrapOrganization,
    }),
    [
      loading,
      session,
      memberships,
      organizationId,
      role,
      devBypass,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      setActiveOrganization,
      bootstrapOrganization,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
