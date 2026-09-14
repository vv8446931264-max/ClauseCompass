import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { extractPdfPages, extractTextPages } from "@/lib/extract";
import { transcribeImage } from "@/lib/llm";
import { MAX_FILE_SIZE, MAX_PAGES, ALLOWED_TYPES, IMAGE_TYPES } from "@/lib/schemas";
import * as store from "@/lib/store";
import { checkRateLimit, parseClientIp } from "@/lib/ratelimit";

// @architecture-audit: force dynamic — uploads and extraction must never be cached
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ip = parseClientIp(req.headers.get("x-forwarded-for"));
  const { allowed, retryAfterMs } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const pastedText = formData.get("text") as string | null;

  if (!file && !pastedText) {
    return NextResponse.json(
      { error: "Provide a file or pasted text" },
      { status: 400 }
    );
  }

  if (pastedText && pastedText.length > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Pasted text too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024} MB` },
      { status: 400 }
    );
  }

  if (file) {
    if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Accepted: PDF, plain text` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 400 }
      );
    }
  }

  try {
    const id = uuid();
    let pages;

    if (file && file.type === "application/pdf") {
      const buffer = await file.arrayBuffer();
      pages = await extractPdfPages(buffer);
    } else if (file && IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
      // Photograph / scan of a legal document → Gemini vision OCR → same pipeline
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const text = await transcribeImage(base64, file.type);
      pages = extractTextPages(text);
    } else {
      const text = pastedText ?? (await file!.text());
      pages = extractTextPages(text);
    }

    if (pages.length > MAX_PAGES) {
      return NextResponse.json(
        { error: `Document has ${pages.length} pages. Maximum: ${MAX_PAGES}` },
        { status: 400 }
      );
    }

    const fullText = pages.map((p) => p.text).join("\n\n");

    if (fullText.trim().length < 50) {
      return NextResponse.json(
        { error: "Document is too short or empty. Please upload a document with meaningful content." },
        { status: 400 }
      );
    }
    const doc = { id, filename: file?.name ?? "pasted-text.txt", pages, fullText };
    store.setDoc(doc);

    return NextResponse.json({
      id: doc.id,
      filename: doc.filename,
      pageCount: pages.length,
      preview: fullText.slice(0, 500),
    });
  } catch (e) {
    console.error("Extraction failed:", e);
    return NextResponse.json(
      { error: "Failed to extract document text" },
      { status: 500 }
    );
  }
}
