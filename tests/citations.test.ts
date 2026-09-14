import { describe, it, expect } from "vitest";
import { validateQuote, validateAllQuotes } from "@/lib/citations";
import type { Page } from "@/lib/schemas";

const pages: Page[] = [
  {
    n: 1,
    text: "The Tenant shall pay a security deposit of $2,900.00 upon execution of this Agreement. The deposit shall be returned within thirty days.",
  },
  {
    n: 2,
    text: "Either party may terminate this Agreement with ninety (90) days written notice. The Landlord may terminate immediately if the Tenant fails to pay rent.",
  },
];

describe("validateQuote", () => {
  it("finds an exact match", () => {
    const span = validateQuote(
      "security deposit of $2,900.00",
      "doc1",
      pages
    );
    expect(span).not.toBeNull();
    expect(span!.page).toBe(1);
    expect(span!.docId).toBe("doc1");
  });

  it("matches with whitespace normalization", () => {
    const span = validateQuote(
      "security  deposit   of  $2,900.00",
      "doc1",
      pages
    );
    expect(span).not.toBeNull();
    expect(span!.page).toBe(1);
  });

  it("matches case-insensitively", () => {
    const span = validateQuote(
      "THE TENANT SHALL PAY A SECURITY DEPOSIT",
      "doc1",
      pages
    );
    expect(span).not.toBeNull();
    expect(span!.page).toBe(1);
  });

  it("rejects a fabricated quote", () => {
    const span = validateQuote(
      "The tenant must pay a fee of $5,000 for early termination",
      "doc1",
      pages
    );
    expect(span).toBeNull();
  });

  it("rejects very short quotes", () => {
    const span = validateQuote("the", "doc1", pages);
    expect(span).toBeNull();
  });

  it("finds quotes on page 2", () => {
    const span = validateQuote(
      "ninety (90) days written notice",
      "doc1",
      pages
    );
    expect(span).not.toBeNull();
    expect(span!.page).toBe(2);
  });

  it("rejects empty string", () => {
    const span = validateQuote("", "doc1", pages);
    expect(span).toBeNull();
  });

  it("handles unicode and special characters", () => {
    const specialPages: Page[] = [
      { n: 1, text: 'The fee is $500 — payable "immediately" upon signing.' },
    ];
    const span = validateQuote('$500 — payable "immediately"', "doc1", specialPages);
    expect(span).not.toBeNull();
    expect(span!.page).toBe(1);
  });

  it("returns correct character offsets", () => {
    const span = validateQuote(
      "security deposit of $2,900.00",
      "doc1",
      pages
    );
    expect(span).not.toBeNull();
    expect(span!.start).toBeGreaterThanOrEqual(0);
    expect(span!.end).toBeGreaterThan(span!.start);
  });

  it("normalizes smart quotes to straight quotes", () => {
    const smartPages: Page[] = [
      { n: 1, text: 'The "Agreement" shall be binding.' },
    ];
    const span = validateQuote('The “Agreement” shall be binding', "doc1", smartPages);
    expect(span).not.toBeNull();
  });

  it("normalizes em-dashes to hyphens", () => {
    const dashPages: Page[] = [
      { n: 1, text: "The tenant - not the landlord - is responsible." },
    ];
    const span = validateQuote("The tenant — not the landlord — is responsible", "doc1", dashPages);
    expect(span).not.toBeNull();
  });

  it("matches quotes spanning page breaks", () => {
    const multiPages: Page[] = [
      { n: 1, text: "The tenant shall pay rent" },
      { n: 2, text: "on the first day of each month" },
    ];
    const span = validateQuote("pay rent on the first day", "doc1", multiPages);
    expect(span).not.toBeNull();
  });

  it("rejects fabricated quotes that share a prefix with real text", () => {
    const span = validateQuote(
      "The Tenant shall pay a security deposit of $2,900.00 and also sacrifice their firstborn to the landlord",
      "doc1",
      pages
    );
    expect(span).toBeNull();
  });
});

describe("validateAllQuotes", () => {
  it("separates verified and unverified quotes", () => {
    const { spans, unverified } = validateAllQuotes(
      [
        "security deposit of $2,900.00",
        "This is a completely made up quote that does not exist in the document at all",
      ],
      "doc1",
      pages
    );
    expect(spans).toHaveLength(1);
    expect(unverified).toHaveLength(1);
    expect(spans[0]!.page).toBe(1);
  });

  it("handles all verified quotes", () => {
    const { spans, unverified } = validateAllQuotes(
      ["security deposit of $2,900.00", "ninety (90) days written notice"],
      "doc1",
      pages
    );
    expect(spans).toHaveLength(2);
    expect(unverified).toHaveLength(0);
  });

  it("handles all unverified quotes", () => {
    const { spans, unverified } = validateAllQuotes(
      ["made up quote one that is long enough", "made up quote two that is also long enough"],
      "doc1",
      pages
    );
    expect(spans).toHaveLength(0);
    expect(unverified).toHaveLength(2);
  });

  it("handles empty quotes array", () => {
    const { spans, unverified } = validateAllQuotes([], "doc1", pages);
    expect(spans).toHaveLength(0);
    expect(unverified).toHaveLength(0);
  });

  it("uses precomputed full text for cross-page matches", () => {
    const multiPages: Page[] = [
      { n: 1, text: "The tenant shall pay rent" },
      { n: 2, text: "on the first day of each month" },
    ];
    const { spans } = validateAllQuotes(
      ["pay rent on the first day"],
      "doc1",
      multiPages
    );
    expect(spans).toHaveLength(1);
  });
});

describe("validateQuote with single page", () => {
  it("skips cross-page path for single page docs", () => {
    const singlePage: Page[] = [{ n: 1, text: "Only one page of content here" }];
    const span = validateQuote("Only one page", "doc1", singlePage);
    expect(span).not.toBeNull();
    expect(span!.page).toBe(1);
  });
});
