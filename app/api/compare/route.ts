import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/llm";
import { CompareResultSchema, type CompareResult, type Claim, type ValidatedClaim, type ValidatedCompareResult, type Page } from "@/lib/schemas";
import { validateAllQuotes } from "@/lib/citations";
import * as store from "@/lib/store";
import { checkRateLimit, parseClientIp } from "@/lib/ratelimit";

// @architecture-audit: force dynamic so the LLM is invoked on every request; align function timeout with the LLM timeout
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RequestSchema = z
  .object({
    docId1: z.string().min(1),
    docId2: z.string().min(1),
  })
  .strict();
const MAX_JSON_BODY = 1_000_000; // 1 MB

export async function POST(req: NextRequest) {
  const ip = parseClientIp(req.headers.get("x-forwarded-for"));
  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_JSON_BODY) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const doc1 = store.getDoc(parsed.data.docId1);
  const doc2 = store.getDoc(parsed.data.docId2);
  if (!doc1 || !doc2) {
    return NextResponse.json(
      { error: "One or both documents not found" },
      { status: 404 }
    );
  }

  const safeName = (s: string) => s.replace(/[^a-zA-Z0-9 ._-]/g, "").slice(0, 100);

  const prompt = `Compare these two legal documents and identify clause-level changes.

<document_1 name="${safeName(doc1.filename)}">
${doc1.fullText}
</document_1>

<document_2 name="${safeName(doc2.filename)}">
${doc2.fullText}
</document_2>

Return a JSON object with:
- "added": clauses present in document 2 but not in document 1
- "removed": clauses present in document 1 but not in document 2
- "changed": clauses that exist in both but were modified, each with "before" (from doc 1), "after" (from doc 2), and "explanation" of the change
- "unchanged": major clauses that remained the same

Each clause has: "text" (plain language), "category" (obligation|right|key_date|payment|termination|risk_flag), "severity" (low|medium|high), "sourceQuotes" (exact quotes from the respective document).`;

  try {
    const raw = await generateStructured<CompareResult>(prompt, {
      temperature: 0.1,
    });

    const parseResult = CompareResultSchema.safeParse(raw);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Comparison produced invalid output" },
        { status: 502 }
      );
    }

    function validateClaim(claim: Claim, docId: string, pages: Page[]): ValidatedClaim {
      const { spans, unverified } = validateAllQuotes(claim.sourceQuotes, docId, pages);
      return { text: claim.text, category: claim.category, severity: claim.severity, sourceSpans: spans, unverifiedQuotes: unverified };
    }

    const validated: ValidatedCompareResult = {
      added: parseResult.data.added.map((c) => validateClaim(c, doc2.id, doc2.pages)),
      removed: parseResult.data.removed.map((c) => validateClaim(c, doc1.id, doc1.pages)),
      changed: parseResult.data.changed.map((c) => ({
        before: validateClaim(c.before, doc1.id, doc1.pages),
        after: validateClaim(c.after, doc2.id, doc2.pages),
        explanation: c.explanation,
      })),
      unchanged: parseResult.data.unchanged.map((c) => validateClaim(c, doc1.id, doc1.pages)),
    };

    return NextResponse.json(validated);
  } catch (e) {
    console.error("Compare failed:", e);
    return NextResponse.json(
      { error: "Comparison failed" },
      { status: 500 }
    );
  }
}
