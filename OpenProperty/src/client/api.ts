import type { AppType } from "../server/app";
import { authConfigured, getSupabase } from "./lib/supabase";
import { getStoredOrganizationId } from "./lib/session";

/** Shared API surface type for Hono RPC (`createApiClient` in `./rpc`). */
export type { AppType };

export type ApiAuthOptions = {
  accessToken?: string;
  organizationId?: string | null;
};

async function resolveAuthHeaders(options?: ApiAuthOptions): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  let token = options?.accessToken;
  if (!token && authConfigured) {
    const supabase = getSupabase();
    const { data } = await supabase!.auth.getSession();
    token = data.session?.access_token;
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const org =
    options?.organizationId !== undefined
      ? options.organizationId
      : getStoredOrganizationId();
  if (org) headers["X-Organization-Id"] = org;

  return headers;
}

export async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  auth?: ApiAuthOptions,
): Promise<T> {
  const authHeaders = await resolveAuthHeaders(auth);
  const opts: RequestInit = { method, headers: { ...authHeaders } };
  if (body !== undefined) {
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  let data: unknown = null;
  try {
    data = await r.json();
  } catch {
    /* empty body */
  }
  if (!r.ok) {
    const msg = (data as { error?: string } | null)?.error || `${r.status} ${r.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}
