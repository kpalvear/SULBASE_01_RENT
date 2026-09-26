import { useEffect, useState } from "react";
import { api, apiBlob, apiForm } from "@/api";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Box = "inbox" | "sent";

type RecipientChoice = {
  kind: "membership" | "tenant";
  id: string;
  email: string;
  label: string;
};

type Participant = {
  participant_kind: "membership" | "tenant";
  email: string;
  role: "from" | "to" | "cc";
  user_id: string | null;
  tenant_id: string | null;
};

type ThreadRow = {
  id: string;
  subject: string;
  last_message_at: string;
  unread_count: number;
  participants: Participant[];
};

type Attachment = { id: string; filename: string; mime: string };

type MailMessage = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  attachments: Attachment[];
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
}

function people(participants: Participant[], roles: Array<"from" | "to" | "cc">) {
  return participants
    .filter((row) => roles.includes(row.role))
    .map((row) => row.email)
    .join(", ");
}

export function MessagesPage() {
  const [box, setBox] = useState<Box>("inbox");
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState({ subject: "", body: "", forward: false });
  const [toId, setToId] = useState("");
  const [ccId, setCcId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [directory, setDirectory] = useState<RecipientChoice[]>([]);

  async function loadThreads(nextBox = box) {
    const data = await api<{ threads: ThreadRow[]; unread_count: number }>(
      "GET",
      `/api/messages?box=${nextBox}`,
    );
    setThreads(data.threads);
    setUnread(data.unread_count);
  }

  async function openThread(id: string, nextBox = box) {
    setSelectedId(id);
    const data = await api<{
      thread: { subject: string };
      participants: Participant[];
      messages: MailMessage[];
    }>("GET", `/api/messages/${id}`);
    setSubject(data.thread.subject);
    setParticipants(data.participants);
    setMessages(data.messages);
    await api("POST", `/api/messages/${id}/read`);
    await loadThreads(nextBox);
  }

  useEffect(() => {
    void loadThreads().catch((err: Error) => setError(err.message));
  }, [box]);

  useEffect(() => {
    void api<{
      members: { user_id: string; email: string }[];
      tenants: { id: string; first_name: string; last_name: string; email: string }[];
    }>("GET", "/api/messages/recipients")
      .then((data) => {
        setDirectory([
          ...data.members.map((member) => ({
            kind: "membership" as const,
            id: member.user_id,
            email: member.email,
            label: member.email,
          })),
          ...data.tenants.map((tenant) => ({
            kind: "tenant" as const,
            id: tenant.id,
            email: tenant.email,
            label: `${tenant.first_name} ${tenant.last_name} · ${tenant.email}`,
          })),
        ]);
      })
      .catch(() => undefined);
  }, []);

  function choice(key: string) {
    const [kind, id] = key.split(":");
    return directory.find((row) => row.kind === kind && row.id === id);
  }

  async function sendNew() {
    const to = choice(toId);
    if (!to) {
      setError("Elige un destinatario de la organización.");
      return;
    }
    const cc = ccId ? choice(ccId) : undefined;
    if (ccId && !cc) {
      setError("El CC no pertenece a la organización.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ thread: { id: string }; message: { id: string } }>(
        "POST",
        "/api/messages",
        {
          subject: draft.subject,
          body: draft.body,
          recipients: [
            { kind: to.kind, id: to.id, role: "to" },
            ...(cc && cc.id !== to.id ? [{ kind: cc.kind, id: cc.id, role: "cc" as const }] : []),
          ],
        },
      );
      for (const file of files) {
        const form = new FormData();
        form.set("entity_type", "message");
        form.set("entity_id", created.message.id);
        form.set("kind", file.type.startsWith("image/") ? "image" : "other");
        form.set("file", file);
        await apiForm("/api/documents", form);
      }
      setComposeOpen(false);
      setDraft({ subject: "", body: "", forward: false });
      setFiles([]);
      setToId("");
      setCcId("");
      setBox("sent");
      await openThread(created.thread.id, "sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("POST", `/api/messages/${selectedId}/replies`, { body: reply });
      setReply("");
      await openThread(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo responder");
    } finally {
      setBusy(false);
    }
  }

  async function openAttachment(file: Attachment) {
    const blob = await apiBlob(`/api/documents/${file.id}`);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function startForward() {
    const quoted = messages.map((message) => message.body).join("\n\n");
    setDraft({
      subject: subject.startsWith("Fwd:") ? subject : `Fwd: ${subject}`,
      body: `\n\n---------- Mensaje reenviado ----------\n${quoted}`,
      forward: true,
    });
    setToId("");
    setCcId("");
    setFiles([]);
    setComposeOpen(true);
  }

  return (
    <PageShell
      title="Correo"
      meta={unread > 0 ? `${unread} sin leer` : "Mensajes de la organización"}
      actions={
        <Button
          onClick={() => {
            setDraft({ subject: "", body: "", forward: false });
            setComposeOpen(true);
          }}
        >
          Redactar
        </Button>
      }
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        {(["inbox", "sent"] as const).map((item) => (
          <Button
            key={item}
            variant={box === item ? "default" : "secondary"}
            onClick={() => {
              setBox(item);
              setSelectedId(null);
            }}
          >
            {item === "inbox" ? "Entrada" : "Enviados"}
          </Button>
        ))}
      </div>
      <div className="grid min-h-[28rem] gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-md border border-border">
          {threads.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No hay mensajes en esta bandeja.</p>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={cn(
                  "block w-full border-b border-border px-3 py-3 text-left last:border-b-0",
                  selectedId === thread.id ? "bg-muted" : "hover:bg-muted/60",
                )}
                onClick={() => void openThread(thread.id).catch((err: Error) => setError(err.message))}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{thread.subject}</span>
                  {thread.unread_count > 0 && (
                    <span className="text-xs text-muted-foreground">{thread.unread_count}</span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {people(thread.participants, ["from", "to"]) || "Sin destinatarios"}
                </p>
                <p className="text-xs text-muted-foreground">{formatWhen(thread.last_message_at)}</p>
              </button>
            ))
          )}
        </div>
        <div className="flex min-h-0 flex-col rounded-md border border-border">
          {!selectedId ? (
            <p className="p-4 text-sm text-muted-foreground">Selecciona un hilo para leerlo.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold">{subject}</h2>
                  <p className="text-xs text-muted-foreground">
                    Para: {people(participants, ["to"]) || "—"}
                    {people(participants, ["cc"]) ? ` · CC: ${people(participants, ["cc"])}` : ""}
                  </p>
                </div>
                <Button variant="secondary" onClick={startForward}>
                  Reenviar
                </Button>
              </div>
              <div className="flex-1 space-y-4 overflow-auto p-4">
                {messages.map((message) => (
                  <article key={message.id} className="space-y-2">
                    <p className="text-xs text-muted-foreground">{formatWhen(message.created_at)}</p>
                    <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                    {message.attachments.length > 0 && (
                      <ul className="text-sm">
                        {message.attachments.map((file) => (
                          <li key={file.id}>
                            <button
                              type="button"
                              className="underline"
                              onClick={() => void openAttachment(file)}
                            >
                              {file.filename}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
              <form
                className="space-y-2 border-t border-border p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendReply();
                }}
              >
                <Label htmlFor="reply-body">Responder</Label>
                <Textarea
                  id="reply-body"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Escribe un mensaje de texto"
                />
                <Button type="submit" disabled={busy || reply.trim().length === 0}>
                  Enviar respuesta
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.forward ? "Reenviar" : "Nuevo mensaje"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="mail-to">Para</Label>
              <select
                id="mail-to"
                className="h-8 w-full rounded-sm bg-card px-2 text-sm shadow-edge"
                value={toId}
                onChange={(event) => setToId(event.target.value)}
              >
                <option value="">Selecciona un miembro o inquilino</option>
                {directory.map((row) => (
                  <option key={`${row.kind}:${row.id}`} value={`${row.kind}:${row.id}`}>
                    {row.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mail-cc">CC</Label>
              <select
                id="mail-cc"
                className="h-8 w-full rounded-sm bg-card px-2 text-sm shadow-edge"
                value={ccId}
                onChange={(event) => setCcId(event.target.value)}
              >
                <option value="">Ninguno</option>
                {directory.map((row) => (
                  <option key={`${row.kind}:${row.id}`} value={`${row.kind}:${row.id}`}>
                    {row.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mail-subject">Asunto</Label>
              <Input
                id="mail-subject"
                value={draft.subject}
                onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mail-body">Mensaje</Label>
              <Textarea
                id="mail-body"
                className="min-h-40"
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mail-files">Adjuntos</Label>
              <Input
                id="mail-files"
                type="file"
                multiple
                onChange={(event) => setFiles([...(event.target.files ?? [])])}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setComposeOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => void sendNew()}>
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
