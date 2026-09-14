import type { Page } from "./schemas";

/**
 * Extract text from a PDF buffer using pdfjs-dist.
 * Returns pages with their text content and page numbers.
 */
export async function extractPdfPages(buffer: ArrayBuffer): Promise<Page[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
    .promise;
  const pages: Page[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push({ n: i, text });
  }

  return pages;
}

/**
 * Parse plain text into a single "page".
 */
export function extractTextPages(text: string): Page[] {
  return [{ n: 1, text }];
}
