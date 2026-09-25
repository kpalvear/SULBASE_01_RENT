import type { SupabaseClient } from "@supabase/supabase-js";

/** Wait for Supabase to consume #access_token from email confirmation links. */
export async function establishSessionFromUrl(supabase: SupabaseClient): Promise<void> {
  const hash = window.location.hash;
  if (!hash || !hash.includes("access_token")) {
    await supabase.auth.getSession();
    return;
  }

  for (let i = 0; i < 8; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const clean = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", clean);
      return;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}
