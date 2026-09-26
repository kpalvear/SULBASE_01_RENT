import { useEffect, useState } from "react";
import { FileText, Star, Trash2, Upload } from "lucide-react";
import { api, apiBlob, apiForm } from "@/api";
import { useApp } from "@/context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocumentEntityType, DocumentKind, PropertyDocument } from "@/types";

const KINDS: { value: DocumentKind; label: string }[] = [
  { value: "image", label: "Imagen" },
  { value: "deed", label: "Escritura" },
  { value: "certificate", label: "Certificado" },
  { value: "invoice", label: "Factura" },
  { value: "signed_lease", label: "Contrato firmado" },
  { value: "other", label: "Otro" },
];

type ListResponse = {
  documents: PropertyDocument[];
  usage: { file_count: number; total_bytes: number };
};

export function DocumentsPanel({
  entityType,
  entityId,
}: {
  entityType: DocumentEntityType;
  entityId: string;
}) {
  const app = useApp();
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [usage, setUsage] = useState<ListResponse["usage"] | null>(null);
  const [kind, setKind] = useState<DocumentKind>("image");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  async function load() {
    const data = await api<ListResponse>(
      "GET",
      `/api/documents?entity_type=${entityType}&entity_id=${entityId}`,
    );
    setDocuments(data.documents);
    setUsage(data.usage);
    return data.documents;
  }

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      try {
        setLoading(true);
        const docs = await load();
        const next: Record<string, string> = {};
        await Promise.all(
          docs
            .filter((doc) => doc.mime.startsWith("image/"))
            .map(async (doc) => {
              const blob = await apiBlob(`/api/documents/${doc.id}`);
              const url = URL.createObjectURL(blob);
              urls.push(url);
              next[doc.id] = url;
            }),
        );
        if (!cancelled) setPreviews(next);
      } catch (err) {
        if (!cancelled) app.setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function refresh() {
    const docs = await load();
    const next: Record<string, string> = {};
    const created: string[] = [];
    await Promise.all(
      docs
        .filter((doc) => doc.mime.startsWith("image/"))
        .map(async (doc) => {
          const blob = await apiBlob(`/api/documents/${doc.id}`);
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[doc.id] = url;
        }),
    );
    setPreviews((current) => {
      for (const url of Object.values(current)) URL.revokeObjectURL(url);
      return next;
    });
    return created;
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.set("entity_type", entityType);
        form.set("entity_id", entityId);
        form.set("kind", kind);
        form.set("file", file);
        const images = documents.filter((doc) => doc.kind === "image");
        if (kind === "image" && images.length === 0) form.set("is_cover", "true");
        await apiForm("/api/documents", form);
      }
      await refresh();
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function makeCover(id: string) {
    try {
      await api("POST", `/api/documents/${id}/cover`);
      await refresh();
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await api("DELETE", `/api/documents/${id}`);
      await refresh();
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  async function download(doc: PropertyDocument) {
    try {
      const blob = await apiBlob(`/api/documents/${doc.id}?download=1`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = doc.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  const images = documents.filter((doc) => doc.mime.startsWith("image/"));
  const files = documents.filter((doc) => !doc.mime.startsWith("image/"));
  const cover = images.find((doc) => doc.is_cover) ?? images[0];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[1.0625rem] font-semibold leading-tight">Documentos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG, WebP, GIF o PDF. Máximo 10 MB por archivo
            {usage ? ` · ${usage.file_count} en la organización` : ""}.
          </p>
        </div>
        <div className="w-44">
          <Select value={kind} onValueChange={(value) => setKind(value as DocumentKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground transition-colors",
          dragOver && "border-foreground bg-muted",
          uploading && "pointer-events-none opacity-60",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void uploadFiles([...event.dataTransfer.files]);
        }}
      >
        <Upload className="size-5" aria-hidden />
        <span>{uploading ? "Subiendo…" : "Arrastra archivos o haz clic para elegirlos"}</span>
        <input
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          multiple
          onChange={(event) => {
            const list = event.target.files ? [...event.target.files] : [];
            event.target.value = "";
            void uploadFiles(list);
          }}
        />
      </label>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Cargando documentos…</Card>
      ) : documents.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Todavía no hay documentos.
        </Card>
      ) : (
        <>
          {cover && previews[cover.id] && (
            <Card className="overflow-hidden">
              <img src={previews[cover.id]} alt={cover.filename} className="max-h-64 w-full object-cover" />
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
                <span className="truncate">{cover.filename}</span>
                <span>Portada</span>
              </div>
            </Card>
          )}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {images.map((doc) => (
                <Card key={doc.id} className="overflow-hidden">
                  {previews[doc.id] ? (
                    <img src={previews[doc.id]} alt={doc.filename} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                      Imagen
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1 p-2">
                    <button
                      type="button"
                      className="min-w-0 truncate text-left text-xs"
                      onClick={() => download(doc)}
                    >
                      {doc.filename}
                    </button>
                    <div className="flex shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={doc.is_cover ? "secondary" : "ghost"}
                        aria-label="Usar como portada"
                        onClick={() => makeCover(doc.id)}
                      >
                        <Star className={cn("size-3.5", doc.is_cover && "fill-current")} />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label="Eliminar documento"
                        onClick={() => remove(doc.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <Card className="divide-y">
              {files.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-3">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-2 text-left text-sm"
                    onClick={() => download(doc)}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{doc.filename}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {KINDS.find((item) => item.value === doc.kind)?.label ?? doc.kind}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="Eliminar documento"
                      onClick={() => remove(doc.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </section>
  );
}
