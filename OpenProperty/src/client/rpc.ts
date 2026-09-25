import { hc } from "hono/client";
import type { AppType } from "../server/app";

/** Type-safe Hono RPC client (same origin as the SPA + Worker). */
export function createApiClient(baseUrl = "") {
  const base =
    baseUrl ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:8787");
  return hc<AppType>(base);
}

export type ApiClient = ReturnType<typeof createApiClient>;
