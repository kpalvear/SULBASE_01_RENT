import { describe, expect, it } from "vitest";
import { reduceFirmaEvent, type SignatureState } from "./reduce-event";

const base = (): SignatureState => ({
  status: "sent",
  recipients: [
    {
      email: "ana@example.com",
      providerRecipientId: "rec_ana",
      status: "pending",
      signedAt: null,
    },
    {
      email: "luis@example.com",
      providerRecipientId: "rec_luis",
      status: "pending",
      signedAt: null,
    },
  ],
});

describe("reduceFirmaEvent", () => {
  it("marks one recipient and keeps the request partial", () => {
    const next = reduceFirmaEvent(base(), {
      type: "signing_request.recipient.signed",
      signingRequestId: "sr_1",
      recipients: [{ id: "rec_ana", email: "ana@example.com", signedAt: "2026-09-25T12:00:00Z" }],
    });
    expect(next.state.status).toBe("partially_signed");
    expect(next.state.recipients[0]?.status).toBe("signed");
    expect(next.state.recipients[1]?.status).toBe("pending");
    expect(next.archive).toBe(false);
  });

  it("completes and asks to archive the PDF", () => {
    const next = reduceFirmaEvent(base(), {
      type: "signing_request.completed",
      signingRequestId: "sr_1",
      recipients: [
        { email: "ana@example.com", signedAt: "2026-09-25T12:00:00Z" },
        { email: "luis@example.com", signedAt: "2026-09-25T12:05:00Z" },
      ],
    });
    expect(next.state.status).toBe("completed");
    expect(next.archive).toBe(true);
    expect(next.state.recipients.every((recipient) => recipient.status === "signed")).toBe(true);
  });

  it("does not reopen a declined request", () => {
    const declined: SignatureState = { ...base(), status: "declined" };
    const next = reduceFirmaEvent(declined, {
      type: "signing_request.viewed",
      signingRequestId: "sr_1",
      recipients: [],
    });
    expect(next.state.status).toBe("declined");
    expect(next.archive).toBe(false);
  });
});
