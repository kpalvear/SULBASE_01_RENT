const MAX_SKEW_SEC = 300;

export type FirmaSignatureCheck = {
  rawBody: string;
  signatureHeader: string | undefined;
  previousSignatureHeader: string | undefined;
  secret: string;
  nowMs?: number;
};

function parseSignatureHeader(
  header: string | undefined,
): { timestamp: number; signature: string } | null {
  if (!header) return null;
  const parts = new Map<string, string>();
  for (const piece of header.split(",")) {
    const eq = piece.indexOf("=");
    if (eq <= 0) continue;
    parts.set(piece.slice(0, eq).trim(), piece.slice(eq + 1).trim());
  }
  const timestamp = Number(parts.get("t"));
  const signature = parts.get("v1");
  if (!Number.isFinite(timestamp) || !signature) return null;
  return { timestamp, signature };
}

async function macMatches(secret: string, message: string, signatureHex: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(signatureHex)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number.parseInt(signatureHex.slice(i * 2, i * 2 + 2), 16);
  }
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(message));
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function headerMatches(
  rawBody: string,
  header: string | undefined,
  secret: string,
  nowMs: number,
): Promise<boolean> {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  const ageSec = Math.floor(nowMs / 1000) - parsed.timestamp;
  if (ageSec > MAX_SKEW_SEC || ageSec < -MAX_SKEW_SEC) return false;
  return macMatches(secret, `${parsed.timestamp}.${rawBody}`, parsed.signature);
}

/**
 * Verifies `X-Firma-Signature` (HMAC-SHA256 over `{timestamp}.{rawBody}`).
 * During secret rotation, the same stored secret may match `X-Firma-Signature-Old`.
 */
export async function verifyFirmaWebhook(input: FirmaSignatureCheck): Promise<boolean> {
  if (!input.secret) return false;
  const nowMs = input.nowMs ?? Date.now();
  if (await headerMatches(input.rawBody, input.signatureHeader, input.secret, nowMs)) {
    return true;
  }
  if (!input.previousSignatureHeader) return false;
  return headerMatches(input.rawBody, input.previousSignatureHeader, input.secret, nowMs);
}

export async function signFirmaWebhook(
  secret: string,
  rawBody: string,
  timestampSec: number,
): Promise<string> {
  const signature = await hmacHex(secret, `${timestampSec}.${rawBody}`);
  return `t=${timestampSec},v1=${signature}`;
}
