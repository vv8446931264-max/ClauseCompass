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

interface NormalizedIndex {
  pages: { n: number; text: string }[];
  full: string | null;
}

// @perf-audit: normalize each page (and the cross-page join) ONCE per document,
// not once per quote — turns validation from O(quotes × pages) into O(pages + quotes).
function buildIndex(pages: Page[]): NormalizedIndex {
  return {
    pages: pages.map((p) => ({ n: p.n, text: normalize(p.text) })),
    full: pages.length > 1 ? normalize(pages.map((p) => p.text).join(" ")) : null,
  };
}

/** Match a single quote against document pages. Returns a SourceSpan with page and character offsets, or null if unverifiable. */
export function validateQuote(
  quote: string,
  docId: string,
  pages: Page[],
  index?: NormalizedIndex
): SourceSpan | null {
  const normalizedQuote = normalize(quote);
  if (normalizedQuote.length < 5) return null;

  const idx = index ?? buildIndex(pages);

  for (const page of idx.pages) {
    const at = page.text.indexOf(normalizedQuote);
    if (at !== -1) {
      return {
        id: uuid(),
        docId,
        page: page.n,
        quote: quote.trim(),
        start: at,
        end: at + normalizedQuote.length,
      };
    }
  }

  if (idx.full) {
    const at = idx.full.indexOf(normalizedQuote);
    if (at !== -1) {
      return {
        id: uuid(),
        docId,
        page: pages[0]!.n,
        quote: quote.trim(),
        start: at,
        end: at + normalizedQuote.length,
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
  const index = buildIndex(pages); // @perf-audit: computed once, reused for every quote

  for (const quote of quotes) {
    const span = validateQuote(quote, docId, pages, index);
    if (span) {
      spans.push(span);
    } else {
      unverified.push(quote);
    }
  }

  return { spans, unverified };
}
