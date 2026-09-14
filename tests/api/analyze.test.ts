import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

// Mock the Gemini call — the route's job under test is validation + citation checking, not the model.
vi.mock("@/lib/llm", () => ({
  generateStructured: vi.fn(async () => ({
    title: "Test Lease",
    summary: "A short test lease.",
    claims: [
      {
        text: "Rent is $1,450 per month",
        category: "payment",
        severity: "low",
        sourceQuotes: ["Monthly rent shall be $1,450.00"],
      },
      {
        text: "A fabricated claim the model made up",
        category: "risk_flag",
        severity: "high",
        sourceQuotes: ["This quote does not appear in the document at all"],
      },
    ],
    questionsForLawyer: ["What happens if I pay late?"],
  })),
}));

import { POST } from "@/app/api/analyze/route";
import * as store from "@/lib/store";

function jreq(body: unknown): NextRequest {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/analyze", () => {
  it("400 for an invalid body", async () => {
    const res = await POST(jreq({ notDocId: 1 }));
    expect(res.status).toBe(400);
  });

  it("404 for an unknown document", async () => {
    const res = await POST(jreq({ docId: "does-not-exist" }));
    expect(res.status).toBe(404);
  });

  it("verifies real quotes and rejects fabricated ones", async () => {
    const id = `analyze-${Date.now()}`;
    const text = "Monthly rent shall be $1,450.00 due on the first of each month.";
    store.setDoc({ id, filename: "lease.txt", pages: [{ n: 1, text }], fullText: text });

    const res = await POST(jreq({ docId: id }));
    expect(res.status).toBe(200);
    const data = await res.json();

    // Real quote → verified span; fabricated quote → unverified, never rendered as fact.
    expect(data.claims[0].sourceSpans).toHaveLength(1);
    expect(data.claims[1].sourceSpans).toHaveLength(0);
    expect(data.claims[1].unverifiedQuotes).toHaveLength(1);
  });

  it("caches the decision map (second call returns the same result)", async () => {
    const id = `analyze-cache-${Date.now()}`;
    const text = "Monthly rent shall be $1,450.00 due on the first of each month.";
    store.setDoc({ id, filename: "lease.txt", pages: [{ n: 1, text }], fullText: text });

    const first = await (await POST(jreq({ docId: id }))).json();
    const second = await (await POST(jreq({ docId: id }))).json();
    expect(second).toEqual(first);
  });
});
