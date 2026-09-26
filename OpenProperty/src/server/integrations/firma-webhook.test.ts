import { describe, expect, it } from "vitest";
import { signFirmaWebhook, verifyFirmaWebhook } from "./firma-webhook";

const SECRET = "whsec_test";
const BODY = JSON.stringify({ id: "evt_1", type: "signing_request.completed" });

describe("firma webhook signature", () => {
  it("accepts a current signature over the raw body", async () => {
    const now = 1_700_000_000_000;
    const header = await signFirmaWebhook(SECRET, BODY, Math.floor(now / 1000));
    const ok = await verifyFirmaWebhook({
      rawBody: BODY,
      signatureHeader: header,
      previousSignatureHeader: undefined,
      secret: SECRET,
      nowMs: now,
    });
    expect(ok).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const now = 1_700_000_000_000;
    const header = await signFirmaWebhook(SECRET, BODY, Math.floor(now / 1000));
    const ok = await verifyFirmaWebhook({
      rawBody: `${BODY} `,
      signatureHeader: header,
      previousSignatureHeader: undefined,
      secret: SECRET,
      nowMs: now,
    });
    expect(ok).toBe(false);
  });

  it("rejects a timestamp outside the five minute window", async () => {
    const signedAt = 1_700_000_000;
    const header = await signFirmaWebhook(SECRET, BODY, signedAt);
    const ok = await verifyFirmaWebhook({
      rawBody: BODY,
      signatureHeader: header,
      previousSignatureHeader: undefined,
      secret: SECRET,
      nowMs: (signedAt + 301) * 1000,
    });
    expect(ok).toBe(false);
  });

  it("accepts the previous signature header during secret rotation", async () => {
    const now = 1_700_000_000_000;
    const previous = await signFirmaWebhook(SECRET, BODY, Math.floor(now / 1000));
    const ok = await verifyFirmaWebhook({
      rawBody: BODY,
      signatureHeader: "t=1700000000,v1=deadbeef",
      previousSignatureHeader: previous,
      secret: SECRET,
      nowMs: now,
    });
    expect(ok).toBe(true);
  });
});
