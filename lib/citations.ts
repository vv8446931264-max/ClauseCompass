import type { SourceSpan, Page } from "./schemas";
import { v4 as uuid } from "uuid";

/** NFKC-normalize, fold smart quotes/dashes, collapse whitespace for fuzzy string matching. */
function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Match a single quote against document pages. Returns a SourceSpan with page and character offsets, or null if unverifiable. */
export function validateQuote(
  quote: string,
  docId: string,
  pages: Page[],
  precomputedFull?: string | null
): SourceSpan | null {
  const normalizedQuote = normalize(quote);
  if (normalizedQuote.length < 5) return null;

  for (const page of pages) {
    const normalizedPage = normalize(page.text);
    const idx = normalizedPage.indexOf(normalizedQuote);
    if (idx !== -1) {
      return {
        id: uuid(),
        docId,
        page: page.n,
        quote: quote.trim(),
        start: idx,
        end: idx + normalizedQuote.length,
      };
    }
  }

  if (pages.length > 1) {
    const normalizedFull =
      precomputedFull ?? normalize(pages.map((p) => p.text).join(" "));
    const idx = normalizedFull.indexOf(normalizedQuote);
    if (idx !== -1) {
      return {
        id: uuid(),
        docId,
        page: pages[0]!.n,
        quote: quote.trim(),
        start: idx,
        end: idx + normalizedQuote.length,
      };
    }
  }

  return null;
}

/**
 * Validate all quotes in a claim set. Returns validated spans and unverified quotes.
 */
export function validateAllQuotes(
  quotes: string[],
  docId: string,
  pages: Page[]
): { spans: SourceSpan[]; unverified: string[] } {
  const spans: SourceSpan[] = [];
  const unverified: string[] = [];
  // ponytail: pre-compute once instead of per-quote in validateQuote
  const normalizedFull =
    pages.length > 1
      ? normalize(pages.map((p) => p.text).join(" "))
      : null;

  for (const quote of quotes) {
    const span = validateQuote(quote, docId, pages, normalizedFull);
    if (span) {
      spans.push(span);
    } else {
      unverified.push(quote);
    }
  }

  return { spans, unverified };
}
