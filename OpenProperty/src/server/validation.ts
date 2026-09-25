import type { Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "./env";

export async function parseJson<T>(
  c: Context<AppEnv>,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, data: parsed.data };
}

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

/** Validate URL query string (unknown keys are stripped). */
export function parseQuery<T>(
  c: Context<AppEnv>,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; error: string } {
  const raw: Record<string, string> = {};
  const url = new URL(c.req.url);
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: zodErrorMessage(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}
