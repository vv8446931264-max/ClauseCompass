import { NextRequest } from "next/server";
import { QARequestSchema } from "@/lib/schemas";
import { generateStream } from "@/lib/llm";
import * as store from "@/lib/store";
import { checkRateLimit, parseClientIp } from "@/lib/ratelimit";

// @architecture-audit: force dynamic so Gemini streams fresh on every question; align function timeout with the LLM timeout
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_JSON_BODY = 1_000_000; // 1 MB

export async function POST(req: NextRequest) {
  const ip = parseClientIp(req.headers.get("x-forwarded-for"));
  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return new Response("Too many requests", { status: 429 });
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_JSON_BODY) {
    return new Response("Request body too large", { status: 413 });
  }

  const body = await req.json().catch(() => null);
  const parsed = QARequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }

  const doc = store.getDoc(parsed.data.docId);
  if (!doc) {
    return new Response("Document not found", { status: 404 });
  }

  const language = parsed.data.language ?? "English";

  const prompt = `You are answering a question about a legal document. Answer ONLY based on the document content below. If the answer cannot be found in the document, say: "I can't verify that from this document."

Write your answer in ${language}. For every factual claim, cite the exact quote from the document in [Quote: "..."] format — keep the quoted text in the document's ORIGINAL language, do not translate quotes.

End every response with this exact sentence in ${language}: "This is information only, not legal advice. Consult a licensed legal professional for guidance specific to your situation."

<document>
${doc.pages.map((p) => `--- Page ${p.n} ---\n${p.text}`).join("\n\n")}
</document>

Question: ${parsed.data.question}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generateStream(prompt)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        console.error("Q&A stream error:", e);
        controller.enqueue(encoder.encode("\n\n[Error: Failed to generate answer]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
