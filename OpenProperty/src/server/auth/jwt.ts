import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

export type VerifiedUser = {
  sub: string;
  email?: string;
};

function userFromPayload(payload: Record<string, unknown>): VerifiedUser {
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

async function verifyWithJwks(token: string, issuer: string): Promise<VerifiedUser> {
  const base = issuer.endsWith("/") ? issuer : `${issuer}/`;
  const jwksUrl = new URL(".well-known/jwks.json", base);
  const JWKS = createRemoteJWKSet(jwksUrl);
  const { payload } = await jwtVerify(token, JWKS, {
    issuer,
    clockTolerance: 60,
  });
  return userFromPayload(payload as Record<string, unknown>);
}

async function verifyWithSecret(token: string, jwtSecret: string): Promise<VerifiedUser> {
  const secret = new TextEncoder().encode(jwtSecret);
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
    clockTolerance: 60,
  });
  return userFromPayload(payload as Record<string, unknown>);
}

/**
 * Supabase access tokens may be HS256 (legacy JWT secret) or ES256 (JWKS).
 * JWKS issuer is read from the token when present.
 */
export async function verifySupabaseAccessToken(
  token: string,
  jwtSecret?: string,
): Promise<VerifiedUser> {
  let issuer: string | undefined;
  try {
    const claims = decodeJwt(token);
    if (typeof claims.iss === "string") issuer = claims.iss;
  } catch {
    /* fall through */
  }

  if (issuer?.includes("supabase.co")) {
    try {
      return await verifyWithJwks(token, issuer);
    } catch {
      if (!jwtSecret?.trim()) throw new Error("JWT verification failed");
    }
  }

  if (jwtSecret?.trim()) {
    return await verifyWithSecret(token, jwtSecret);
  }

  throw new Error("JWT verification failed");
}

export function bearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authorization);
  return m?.[1]?.trim() || null;
}
