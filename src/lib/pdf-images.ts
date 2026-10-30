const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

export type PdfImagePage = {
  jpeg: Uint8Array;
  width: number;
  height: number;
};

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function ascii(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) out[index] = value.charCodeAt(index) & 0xff;
  return out;
}

/** PDF, v ktorom je každá strana len JPEG. Nie je v ňom text, ktorý by šiel označiť. */
export function buildImagePdf(pages: PdfImagePage[]): Uint8Array {
  if (!pages.length) throw new Error("PDF nemá žiadnu stranu.");

  const objects = new Map<number, Uint8Array>();
  const pageCount = pages.length;
  const pageObject = (index: number) => 3 + index * 3;
  const contentObject = (index: number) => 4 + index * 3;
  const imageObject = (index: number) => 5 + index * 3;

  objects.set(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  const kids = pages.map((_, index) => `${pageObject(index)} 0 R`).join(" ");
  objects.set(2, ascii(`<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`));

  pages.forEach((page, index) => {
    const draw = `q\n${A4_WIDTH} 0 0 ${A4_HEIGHT} 0 0 cm\n/Im0 Do\nQ\n`;
    objects.set(
      pageObject(index),
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Resources << /XObject << /Im0 ${imageObject(index)} 0 R >> >> /Contents ${contentObject(index)} 0 R >>`
      )
    );
    objects.set(contentObject(index), ascii(`<< /Length ${draw.length} >>\nstream\n${draw}endstream`));
    const header = ascii(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`
    );
    const footer = ascii("\nendstream");
    objects.set(imageObject(index), concatBytes([header, page.jpeg, footer]));
  });

  const maxId = 2 + pageCount * 3;
  const chunks: Uint8Array[] = [ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets = new Array<number>(maxId + 1).fill(0);
  let cursor = chunks[0].length;
  for (let id = 1; id <= maxId; id += 1) {
    const body = objects.get(id);
    if (!body) continue;
    offsets[id] = cursor;
    const head = ascii(`${id} 0 obj\n`);
    const tail = ascii("\nendobj\n");
    chunks.push(head, body, tail);
    cursor += head.length + body.length + tail.length;
  }

  const xrefAt = cursor;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  chunks.push(ascii(xref));
  return concatBytes(chunks);
}
