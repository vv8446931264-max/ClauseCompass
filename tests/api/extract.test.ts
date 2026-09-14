import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";
import { MAX_FILE_SIZE } from "@/lib/schemas";

// Mock vision OCR so image tests never call Gemini.
vi.mock("@/lib/llm", () => ({
  transcribeImage: vi.fn(async () => "Transcribed legal contract text for testing purposes only."),
}));

import { POST } from "@/app/api/extract/route";

function req(form: FormData): NextRequest {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    body: form,
  }) as unknown as NextRequest;
}

describe("POST /api/extract", () => {
  it("400 when neither file nor text is provided", async () => {
    const res = await POST(req(new FormData()));
    expect(res.status).toBe(400);
  });

  it("400 for oversized pasted text", async () => {
    const form = new FormData();
    form.append("text", "a".repeat(MAX_FILE_SIZE + 1));
    const res = await POST(req(form));
    expect(res.status).toBe(400);
  });

  it("400 for content that is too short", async () => {
    const form = new FormData();
    form.append("text", "too short");
    const res = await POST(req(form));
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported file type", async () => {
    const form = new FormData();
    form.append("file", new File(["x"], "malware.exe", { type: "application/x-msdownload" }));
    const res = await POST(req(form));
    expect(res.status).toBe(400);
  });

  it("accepts valid pasted text and returns an id", async () => {
    const form = new FormData();
    form.append(
      "text",
      "This Residential Lease Agreement sets out the rent, deposit, and termination terms for the premises."
    );
    const res = await POST(req(form));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBeTruthy();
    expect(data.pageCount).toBe(1);
  });

  it("runs an image upload through vision OCR", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "contract.png", { type: "image/png" }));
    const res = await POST(req(form));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBeTruthy();
  });
});
