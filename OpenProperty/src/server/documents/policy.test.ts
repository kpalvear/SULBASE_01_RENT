import { describe, expect, it } from "vitest";
import {
  buildObjectKey,
  normalizeObjectName,
  orgQuotaAllows,
  sniffMime,
  validateUpload,
} from "./policy";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

describe("document object keys", () => {
  it("builds a server key and drops client paths", () => {
    const key = buildObjectKey({
      organizationId: "10000000-0000-4000-8000-000000000001",
      entityType: "property",
      entityId: "20000000-0000-4000-8000-000000000010",
      filename: "../../secret/Foto Portada.PNG",
      objectId: "30000000-0000-4000-8000-000000000099",
    });
    expect(key).toBe(
      "org/10000000-0000-4000-8000-000000000001/property/20000000-0000-4000-8000-000000000010/30000000-0000-4000-8000-000000000099-foto-portada.png",
    );
    expect(key.includes("..")).toBe(false);
    expect(normalizeObjectName("../../../etc/passwd")).toBe("passwd");
  });
});

describe("validateUpload", () => {
  it("accepts a png image and rejects a mismatched pdf header", () => {
    const ok = validateUpload({
      filename: "foto.png",
      declaredType: "image/png",
      bytes: PNG,
      size: PNG.byteLength,
      kind: "image",
      isCover: true,
    });
    expect(ok.ok).toBe(true);

    const bad = validateUpload({
      filename: "escritura.pdf",
      declaredType: "application/pdf",
      bytes: PNG,
      size: PNG.byteLength,
      kind: "deed",
      isCover: false,
    });
    expect(bad.ok).toBe(false);
    expect(sniffMime(PNG)).toBe("image/png");
  });

  it("rejects cover on a non-image kind", () => {
    const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const result = validateUpload({
      filename: "contrato.pdf",
      declaredType: "application/pdf",
      bytes: pdf,
      size: pdf.byteLength,
      kind: "deed",
      isCover: true,
    });
    expect(result.ok).toBe(false);
  });
});

describe("orgQuotaAllows", () => {
  it("blocks the next file past the organization cap", () => {
    expect(orgQuotaAllows({ fileCount: 500, totalBytes: 0, nextSize: 10 }).ok).toBe(false);
    expect(orgQuotaAllows({ fileCount: 0, totalBytes: 500 * 1024 * 1024 - 5, nextSize: 10 }).ok).toBe(
      false,
    );
    expect(orgQuotaAllows({ fileCount: 1, totalBytes: 100, nextSize: 100 }).ok).toBe(true);
  });
});
