import { useEffect, useState } from "react";
import { api, apiBlob } from "@/api";
import { useApp } from "@/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Lease, LeaseSignature, LeaseSignatureStatus, PropertyDocument } from "@/types";

const STATUS_LABEL: Record<LeaseSignatureStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  viewed: "Visto",
  partially_signed: "Firma parcial",
  completed: "Firmado",
  declined: "Rechazado",
  expired: "Vencido",
  cancelled: "Cancelado",
};

const RECIPIENT_STATUS: Record<LeaseSignature["recipients"][number]["status"], string> = {
  pending: "Pendiente",
  viewed: "Visto",
  signed: "Firmó",
  declined: "Rechazó",
};

const OPEN = new Set<LeaseSignatureStatus>(["draft", "sent", "viewed", "partially_signed"]);

type RecipientDraft = {
  first_name: string;
  last_name: string;
  email: string;
  role: "owner" | "tenant";
};

export function LeaseSignaturePanel({ lease }: { lease: Lease }) {
  const app = useApp();
  const [signatures, setSignatures] = useState<LeaseSignature[]>([]);
  const [pdfs, setPdfs] = useState<PropertyDocument[]>([]);
  const [documentId, setDocumentId] = useState<string>("template");
  const [owner, setOwner] = useState<RecipientDraft>({
    first_name: "",
    last_name: "",
    email: "",
    role: "owner",
  });
  const [tenant, setTenant] = useState<RecipientDraft>({
    first_name: lease.tenant_first_name ?? "",
    last_name: lease.tenant_last_name ?? "",
    email: lease.tenant_email ?? "",
    role: "tenant",
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    const [signatureData, documentData] = await Promise.all([
      api<{ signatures: LeaseSignature[] }>("GET", `/api/leases/${lease.id}/signature`),
      api<{ documents: PropertyDocument[] }>(
        "GET",
        `/api/documents?entity_type=lease&entity_id=${lease.id}`,
      ),
    ]);
    setSignatures(signatureData.signatures);
    setPdfs(documentData.documents.filter((doc) => doc.mime === "application/pdf"));
  }

  useEffect(() => {
    load().catch((err: Error) => app.setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lease.id]);

  const current = signatures[0];
  const inProgress = current ? OPEN.has(current.status) : false;

  async function send() {
    const recipients = [owner, tenant].filter((person) => person.email.trim() && person.first_name.trim());
    if (recipients.length === 0) {
      app.setError("Añade al menos un firmante con nombre y correo");
      return;
    }
    setBusy(true);
    try {
      await api("POST", `/api/leases/${lease.id}/signature`, {
        document_id: documentId === "template" ? undefined : documentId,
        recipients: recipients.map((person, index) => ({
          ...person,
          last_name: person.last_name.trim() || person.first_name.trim(),
          order: index + 1,
        })),
      });
      await load();
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      await api("POST", `/api/leases/${lease.id}/signature/resend`);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api("POST", `/api/leases/${lease.id}/signature/cancel`, {});
      await load();
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openSigned(documentIdToOpen: string) {
    try {
      const blob = await apiBlob(`/api/documents/${documentIdToOpen}`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  return (
    <section className="space-y-3 border-t pt-3">
      <div>
        <h2 className="text-[1.0625rem] font-semibold leading-tight">Firma</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Envía el contrato a firma. El PDF firmado queda archivado en documentos.
        </p>
      </div>

      {current && (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{STATUS_LABEL[current.status]}</span>
            {current.document_id && (
              <Button type="button" variant="outline" size="sm" onClick={() => openSigned(current.document_id!)}>
                Ver PDF firmado
              </Button>
            )}
          </div>
          {current.last_error && <p className="text-xs text-destructive">{current.last_error}</p>}
          <ul className="space-y-1 text-xs text-muted-foreground">
            {current.recipients.map((recipient) => (
              <li key={recipient.id}>
                {recipient.name} · {recipient.email} · {recipient.role === "owner" ? "Arrendador" : "Inquilino"} ·{" "}
                {RECIPIENT_STATUS[recipient.status]}
                {recipient.signed_at ? ` · ${recipient.signed_at.slice(0, 10)}` : ""}
              </li>
            ))}
          </ul>
          {inProgress && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={resend}>
                Reenviar
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={cancel}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {!inProgress && (
        <div className="grid gap-2">
          <div>
            <Label>Documento</Label>
            <Select value={documentId} onValueChange={setDocumentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="template">Plantilla del contrato</SelectItem>
                {pdfs.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.filename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SignerFields label="Arrendador" value={owner} onChange={setOwner} />
          <SignerFields label="Inquilino" value={tenant} onChange={setTenant} />
          <Button type="button" size="sm" disabled={busy} onClick={send}>
            Enviar a firma
          </Button>
        </div>
      )}
    </section>
  );
}

function SignerFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RecipientDraft;
  onChange: (next: RecipientDraft) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Nombre"
          value={value.first_name}
          onChange={(event) => onChange({ ...value, first_name: event.target.value })}
        />
        <Input
          placeholder="Apellido"
          value={value.last_name}
          onChange={(event) => onChange({ ...value, last_name: event.target.value })}
        />
      </div>
      <Input
        type="email"
        placeholder="Correo"
        value={value.email}
        onChange={(event) => onChange({ ...value, email: event.target.value })}
      />
    </div>
  );
}
