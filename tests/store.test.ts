import { describe, it, expect, vi } from "vitest";
import { setDoc, getDoc, setDecisionMap, getDecisionMap, deleteDoc } from "@/lib/store";
import type { ExtractedDoc, ValidatedDecisionMap } from "@/lib/schemas";

function makeDoc(id: string): ExtractedDoc {
  return {
    id,
    filename: "test.txt",
    pages: [{ n: 1, text: "Test content" }],
    fullText: "Test content",
  };
}

const fakeMap: ValidatedDecisionMap = {
  title: "Test",
  summary: "Test summary",
  claims: [
    {
      text: "Test claim",
      category: "obligation",
      severity: "low",
      sourceSpans: [],
      unverifiedQuotes: [],
    },
  ],
  questionsForLawyer: ["Test question?"],
};

describe("store", () => {
  it("stores and retrieves a document", () => {
    const doc = makeDoc(`store-get-${Date.now()}`);
    setDoc(doc);
    expect(getDoc(doc.id)).toEqual(doc);
  });

  it("returns undefined for unknown id", () => {
    expect(getDoc("nonexistent-id")).toBeUndefined();
  });

  it("deletes a document", () => {
    const doc = makeDoc(`store-del-${Date.now()}`);
    setDoc(doc);
    expect(deleteDoc(doc.id)).toBe(true);
    expect(getDoc(doc.id)).toBeUndefined();
  });

  it("returns false when deleting nonexistent doc", () => {
    expect(deleteDoc("nonexistent")).toBe(false);
  });

  it("stores and retrieves a decision map", () => {
    const doc = makeDoc(`store-map-${Date.now()}`);
    setDoc(doc);
    setDecisionMap(doc.id, fakeMap);
    expect(getDecisionMap(doc.id)).toEqual(fakeMap);
  });

  it("returns undefined for decision map on unknown doc", () => {
    expect(getDecisionMap("nonexistent")).toBeUndefined();
  });

  it("caches decision maps separately per language", () => {
    const doc = makeDoc(`store-lang-${Date.now()}`);
    setDoc(doc);
    setDecisionMap(doc.id, fakeMap, "English");
    const hindiMap = { ...fakeMap, title: "हिन्दी" };
    setDecisionMap(doc.id, hindiMap, "हिन्दी (Hindi)");
    expect(getDecisionMap(doc.id, "English")?.title).toBe("Test");
    expect(getDecisionMap(doc.id, "हिन्दी (Hindi)")?.title).toBe("हिन्दी");
    // a language that was never generated is a cache miss
    expect(getDecisionMap(doc.id, "Español (Spanish)")).toBeUndefined();
  });

  it("expires documents after TTL", () => {
    vi.useFakeTimers();
    const doc = makeDoc(`store-ttl-${Date.now()}`);
    setDoc(doc);
    expect(getDoc(doc.id)).toBeDefined();

    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(getDoc(doc.id)).toBeUndefined();

    vi.useRealTimers();
  });

  it("setDecisionMap is a no-op for nonexistent doc", () => {
    setDecisionMap("nonexistent-map-id", fakeMap);
    expect(getDecisionMap("nonexistent-map-id")).toBeUndefined();
  });

  it("overwrites existing document on re-set", () => {
    const id = `store-overwrite-${Date.now()}`;
    const doc1 = makeDoc(id);
    setDoc(doc1);
    const doc2 = { ...makeDoc(id), filename: "updated.txt" };
    setDoc(doc2);
    expect(getDoc(id)?.filename).toBe("updated.txt");
  });

  it("evicts oldest entries past the size cap", () => {
    const first = makeDoc(`cap-first-${Date.now()}`);
    setDoc(first);
    for (let i = 0; i < 1001; i++) {
      setDoc(makeDoc(`cap-fill-${Date.now()}-${i}`));
    }
    // the very first doc must have been evicted once the cap was exceeded
    expect(getDoc(first.id)).toBeUndefined();
  });
});
