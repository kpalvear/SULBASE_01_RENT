export const LEASE_SIGNATURE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "partially_signed",
  "completed",
  "declined",
  "expired",
  "cancelled",
] as const;

export type LeaseSignatureStatus = (typeof LEASE_SIGNATURE_STATUSES)[number];

export type RecipientStatus = "pending" | "viewed" | "signed" | "declined";

export type SignatureRecipientState = {
  email: string;
  providerRecipientId: string | null;
  status: RecipientStatus;
  signedAt: string | null;
};

export type SignatureState = {
  status: LeaseSignatureStatus;
  recipients: SignatureRecipientState[];
};

export type FirmaWebhookEvent = {
  type: string;
  signingRequestId: string;
  recipients: Array<{
    id?: string;
    email?: string;
    signedAt?: string | null;
  }>;
};

const RANK: Record<LeaseSignatureStatus, number> = {
  draft: 0,
  sent: 1,
  viewed: 2,
  partially_signed: 3,
  completed: 4,
  declined: 5,
  expired: 5,
  cancelled: 5,
};

function terminal(status: LeaseSignatureStatus): boolean {
  return RANK[status] >= RANK.declined || status === "completed";
}

function advance(current: LeaseSignatureStatus, next: LeaseSignatureStatus): LeaseSignatureStatus {
  if (terminal(current)) return current;
  return RANK[next] > RANK[current] ? next : current;
}

function matchRecipient(
  recipients: SignatureRecipientState[],
  incoming: { id?: string; email?: string },
): SignatureRecipientState | undefined {
  const email = incoming.email?.trim().toLowerCase();
  return recipients.find((recipient) => {
    if (incoming.id && recipient.providerRecipientId === incoming.id) return true;
    return Boolean(email) && recipient.email.trim().toLowerCase() === email;
  });
}

/** Pure status transition for a firma.dev webhook. Does not downgrade a finished request. */
export function reduceFirmaEvent(
  state: SignatureState,
  event: FirmaWebhookEvent,
): { state: SignatureState; archive: boolean } {
  const recipients = state.recipients.map((recipient) => ({ ...recipient }));
  let status = state.status;

  if (event.type === "signing_request.viewed") {
    status = advance(status, "viewed");
    for (const incoming of event.recipients) {
      const recipient = matchRecipient(recipients, incoming);
      if (recipient?.status === "pending") recipient.status = "viewed";
    }
  }

  if (event.type === "signing_request.recipient.signed") {
    for (const incoming of event.recipients) {
      const recipient = matchRecipient(recipients, incoming);
      if (!recipient || recipient.status === "signed") continue;
      recipient.status = "signed";
      recipient.signedAt = incoming.signedAt ?? new Date().toISOString();
    }
    status = advance(status, "partially_signed");
  }

  if (event.type === "signing_request.recipient.declined") {
    for (const incoming of event.recipients) {
      const recipient = matchRecipient(recipients, incoming);
      if (recipient && recipient.status !== "signed") recipient.status = "declined";
    }
    status = terminal(status) ? status : "declined";
  }

  if (event.type === "signing_request.expired") status = terminal(status) ? status : "expired";
  if (event.type === "signing_request.cancelled") status = terminal(status) ? status : "cancelled";

  if (event.type === "signing_request.completed") {
    for (const incoming of event.recipients) {
      const recipient = matchRecipient(recipients, incoming);
      if (!recipient) continue;
      recipient.status = "signed";
      recipient.signedAt = recipient.signedAt ?? incoming.signedAt ?? new Date().toISOString();
    }
    if (!terminal(status) || status === "completed") status = "completed";
  }

  const archive = event.type === "signing_request.completed" && status === "completed";
  return { state: { status, recipients }, archive };
}
