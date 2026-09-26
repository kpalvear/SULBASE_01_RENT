import { describe, expect, it } from "vitest";
import { signatureEventDraft, signatureFailureDraft } from "./signature-alerts";

describe("signature mailbox drafts", () => {
  it("keeps one logical period per signer and per terminal event", () => {
    const signed = signatureEventDraft({
      organizationId: "org",
      signatureId: "sig",
      event: "signed",
      signerEmail: "Ana@Example.com",
      detail: "Ana@Example.com firmó el contrato",
    });
    expect(signed.kind).toBe("signature");
    expect(signed.period).toBe("signed:ana@example.com");
    expect(signed.entityId).toBe("sig");

    const completed = signatureEventDraft({
      organizationId: "org",
      signatureId: "sig",
      event: "completed",
      detail: "Todos los firmantes completaron el contrato",
    });
    expect(completed.period).toBe("completed");
    expect(completed.period).not.toBe(signed.period);
  });

  it("records rate-limit failures as a warning on the error period", () => {
    const draft = signatureFailureDraft({
      organizationId: "org",
      signatureId: "sig",
      message: "firma.dev rate limit exceeded",
    });
    expect(draft.period).toBe("error");
    expect(draft.severity).toBe("warning");
    expect(draft.title).toBe("Límite de firma.dev");
  });
});
