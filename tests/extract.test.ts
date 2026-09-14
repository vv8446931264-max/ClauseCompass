import { describe, it, expect } from "vitest";
import { extractTextPages } from "@/lib/extract";

describe("extractTextPages", () => {
  it("wraps text as a single page", () => {
    const pages = extractTextPages("Hello world");
    expect(pages).toHaveLength(1);
    expect(pages[0]!.n).toBe(1);
    expect(pages[0]!.text).toBe("Hello world");
  });

  it("preserves whitespace and newlines", () => {
    const text = "Line 1\n\nLine 2\n  indented";
    const pages = extractTextPages(text);
    expect(pages[0]!.text).toBe(text);
  });

  it("handles empty string", () => {
    const pages = extractTextPages("");
    expect(pages).toHaveLength(1);
    expect(pages[0]!.text).toBe("");
  });

  it("handles very long text", () => {
    const text = "a".repeat(100_000);
    const pages = extractTextPages(text);
    expect(pages[0]!.text.length).toBe(100_000);
  });

  it("handles unicode text", () => {
    const text = "§1. Die Mieterin zahlt €500 monatlich.";
    const pages = extractTextPages(text);
    expect(pages[0]!.text).toBe(text);
  });
});
