function pdfEscape(text: string): string {
  return text.replace(/[()\\]/g, (ch) => `\\${ch}`).replace(/[^\x20-\x7E]/g, "?");
}

/** One-page lease summary used when the contract has no uploaded PDF. */
export function buildLeaseSummaryPdf(lines: string[]): Uint8Array {
  const commands = ["BT", "/F1 16 Tf", "72 740 Td"];
  const [title, ...rest] = lines.length > 0 ? lines : ["Contrato de arrendamiento"];
  commands.push(`(${pdfEscape(title ?? "Contrato")}) Tj`, "/F1 11 Tf");
  for (const line of rest) {
    commands.push("0 -18 Td", `(${pdfEscape(line)}) Tj`);
  }
  commands.push("ET");
  const stream = commands.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(body);
}
