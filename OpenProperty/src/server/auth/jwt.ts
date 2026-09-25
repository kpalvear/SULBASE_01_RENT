import { jwtVerify } from "jose";

export type VerifiedUser = {
  sub: string;
  email?: string;
};

export async function verifySupabaseAccessToken(
  token: string,
  jwtSecret: string,
): Promise<VerifiedUser> {
  const secret = new TextEncoder().encode(jwtSecret);
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
  });
  const sub = payload.sub;
  if (!sub || typeof sub !== "string") {
    throw new Error("Invalid token: missing sub");
  }
  const email =
    typeof payload.email === "string"
      ? payload.email
      : typeof payload.user_metadata === "object" &&
          payload.user_metadata &&
          typeof (payload.user_metadata as { email?: unknown }).email === "string"
        ? (payload.user_metadata as { email: string }).email
        : undefined;
  return { sub, email };
}

export function bearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authorization);
  return m?.[1]?.trim() || null;
}
