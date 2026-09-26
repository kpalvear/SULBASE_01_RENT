import { z } from "zod";
import type { Context, Hono } from "hono";
import type { AppEnv } from "../env";
import {
  buildObjectKey,
  contentDisposition,
  DOCUMENT_ENTITY_TYPES,
  DOCUMENT_KINDS,
  MAX_UPLOAD_REQUEST_BYTES,
  orgQuotaAllows,
  validateUpload,
  type DocumentEntityType,
} from "../documents/policy";
import { deleteR2Keys, entityInOrg } from "../documents/storage";
import { get, normalizeRow, normalizeRows, orgId, query } from "../pg";

const EntityType = z.enum(DOCUMENT_ENTITY_TYPES);
const Kind = z.enum(DOCUMENT_KINDS);

const ListQuery = z.object({
  entity_type: EntityType,
  entity_id: z.string().uuid(),
});

const UploadFields = z.object({
  entity_type: EntityType,
  entity_id: z.string().uuid(),
  kind: Kind,
  is_cover: z.enum(["true", "false", "1", "0"]).optional(),
});

const PUBLIC_COLUMNS = `id, entity_type, entity_id, kind, filename, mime, size_bytes, uploaded_by, is_cover, created_at`;

function targetIds(entityType: DocumentEntityType, entityId: string) {
  return {
    property_id: entityType === "property" ? entityId : null,
    unit_id: entityType === "unit" ? entityId : null,
    lease_id: entityType === "lease" ? entityId : null,
    tenant_id: entityType === "tenant" ? entityId : null,
    work_order_id: entityType === "work_order" ? entityId : null,
    message_id: entityType === "message" ? entityId : null,
  };
}

function formText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function usage(c: Context<AppEnv>) {
  const row = await get<{ file_count: number | string; total_bytes: number | string }>(
    c,
    `SELECT COUNT(*)::int AS file_count, COALESCE(SUM(size_bytes), 0)::bigint AS total_bytes
     FROM documents WHERE organization_id = $1 AND deleted_at IS NULL`,
    [orgId(c)],
  );
  return {
    file_count: Number(row?.file_count ?? 0),
    total_bytes: Number(row?.total_bytes ?? 0),
  };
}

export function mountDocumentsRoutes(app: Hono<AppEnv>) {
  app.get("/api/documents", async (c) => {
    const parsed = ListQuery.safeParse({
      entity_type: c.req.query("entity_type"),
      entity_id: c.req.query("entity_id"),
    });
    if (!parsed.success) return c.json({ error: "Invalid query" }, 400);
    const { entity_type, entity_id } = parsed.data;
    if (!(await entityInOrg(c, entity_type, entity_id))) {
      return c.json({ error: "Not found" }, 404);
    }
    const rows = await query(
      c,
      `SELECT ${PUBLIC_COLUMNS} FROM documents
       WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3 AND deleted_at IS NULL
       ORDER BY is_cover DESC, created_at DESC`,
      [orgId(c), entity_type, entity_id],
    );
    const quota = await usage(c);
    return c.json({
      documents: normalizeRows(rows),
      usage: quota,
    });
  });

  app.get("/api/documents/:id", async (c) => {
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid ID" }, 400);
    const row = await get<{
      r2_key: string;
      filename: string;
      mime: string;
      size_bytes: number;
    }>(
      c,
      `SELECT r2_key, filename, mime, size_bytes FROM documents
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id.data, orgId(c)],
    );
    if (!row) return c.json({ error: "Not found" }, 404);
    const bucket = c.env.FILES;
    if (!bucket) return c.json({ error: "File storage is not configured" }, 503);
    const object = await bucket.get(row.r2_key);
    if (!object) return c.json({ error: "Not found" }, 404);
    const inline = row.mime.startsWith("image/") || row.mime === "application/pdf";
    const download = c.req.query("download") === "1";
    return new Response(object.body as unknown as BodyInit, {
      headers: {
        "Content-Type": row.mime,
        "Content-Length": String(row.size_bytes),
        "Content-Disposition": contentDisposition(row.filename, inline && !download),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  app.post("/api/documents", async (c) => {
    const bucket = c.env.FILES;
    if (!bucket) return c.json({ error: "File storage is not configured" }, 503);

    const declaredLength = Number(c.req.header("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_REQUEST_BYTES) {
      return c.json({ error: "File exceeds 10 MB" }, 413);
    }

    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: "File is required" }, 400);

    const fields = UploadFields.safeParse({
      entity_type: formText(body.entity_type),
      entity_id: formText(body.entity_id),
      kind: formText(body.kind),
      is_cover: formText(body.is_cover) || undefined,
    });
    if (!fields.success) return c.json({ error: "Invalid upload" }, 400);

    const isCover = fields.data.is_cover === "true" || fields.data.is_cover === "1";
    if (isCover && fields.data.entity_type === "message") {
      return c.json({ error: "Messages cannot have a cover image" }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = validateUpload({
      filename: file.name,
      declaredType: file.type,
      bytes,
      size: file.size,
      kind: fields.data.kind,
      isCover,
    });
    if (!checked.ok) {
      const status = checked.error === "File exceeds 10 MB" ? 413 : 400;
      return c.json({ error: checked.error }, status);
    }

    if (!(await entityInOrg(c, fields.data.entity_type, fields.data.entity_id))) {
      return c.json({ error: "Not found" }, 404);
    }

    const quota = await usage(c);
    const allowed = orgQuotaAllows({
      fileCount: quota.file_count,
      totalBytes: quota.total_bytes,
      nextSize: file.size,
    });
    if (!allowed.ok) return c.json({ error: allowed.error }, 409);

    const documentId = crypto.randomUUID();
    const r2Key = buildObjectKey({
      organizationId: orgId(c),
      entityType: fields.data.entity_type,
      entityId: fields.data.entity_id,
      filename: checked.filename,
    });
    await bucket.put(r2Key, bytes, {
      httpMetadata: { contentType: checked.mime },
    });

    const ids = targetIds(fields.data.entity_type, fields.data.entity_id);
    try {
      if (isCover) {
        await query(
          c,
          `UPDATE documents SET is_cover = false
           WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3
             AND is_cover = true AND deleted_at IS NULL`,
          [orgId(c), fields.data.entity_type, fields.data.entity_id],
        );
      }
      const row = await get(
        c,
        `INSERT INTO documents (
           id, organization_id, entity_type, entity_id,
           property_id, unit_id, lease_id, tenant_id, work_order_id, message_id,
           kind, r2_key, filename, mime, size_bytes, uploaded_by, is_cover
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17
         ) RETURNING ${PUBLIC_COLUMNS}`,
        [
          documentId,
          orgId(c),
          fields.data.entity_type,
          fields.data.entity_id,
          ids.property_id,
          ids.unit_id,
          ids.lease_id,
          ids.tenant_id,
          ids.work_order_id,
          ids.message_id,
          fields.data.kind,
          r2Key,
          checked.filename,
          checked.mime,
          file.size,
          c.get("userId"),
          isCover,
        ],
      );
      if (!row) {
        await bucket.delete(r2Key);
        return c.json({ error: "Insert failed" }, 500);
      }
      return c.json({ document: normalizeRow(row as Record<string, unknown>) }, 201);
    } catch (err) {
      await bucket.delete(r2Key);
      const code = (err as { code?: string }).code;
      if (code === "23505") return c.json({ error: "Could not save document" }, 409);
      throw err;
    }
  });

  app.post("/api/documents/:id/cover", async (c) => {
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid ID" }, 400);
    const current = await get<{ entity_type: string; entity_id: string; kind: string }>(
      c,
      `SELECT entity_type, entity_id, kind FROM documents
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id.data, orgId(c)],
    );
    if (!current) return c.json({ error: "Not found" }, 404);
    if (current.kind !== "image") return c.json({ error: "Only images can be the cover" }, 400);
    await query(
      c,
      `UPDATE documents SET is_cover = false
       WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3
         AND is_cover = true AND deleted_at IS NULL AND id <> $4`,
      [orgId(c), current.entity_type, current.entity_id, id.data],
    );
    const row = await get(
      c,
      `UPDATE documents SET is_cover = true
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING ${PUBLIC_COLUMNS}`,
      [id.data, orgId(c)],
    );
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ document: normalizeRow(row as Record<string, unknown>) });
  });

  app.delete("/api/documents/:id", async (c) => {
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "Invalid ID" }, 400);
    const row = await get<{ r2_key: string }>(
      c,
      `UPDATE documents SET deleted_at = now()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING r2_key`,
      [id.data, orgId(c)],
    );
    if (!row) return c.json({ error: "Not found" }, 404);
    await deleteR2Keys(c.env, [row.r2_key]);
    return c.json({ ok: true });
  });
}
