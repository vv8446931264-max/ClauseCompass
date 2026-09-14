import { NextRequest, NextResponse } from "next/server";
import { generateStructured } from "@/lib/llm";
import {
  DecisionMapSchema,
  AnalyzeRequestSchema,
  type DecisionMap,
  type ValidatedDecisionMap,
  type ValidatedClaim,
} from "@/lib/schemas";
import { validateAllQuotes } from "@/lib/citations";
import * as store from "@/lib/store";
import { checkRateLimit, parseClientIp } from "@/lib/ratelimit";

// @architecture-audit: force dynamic so the LLM is invoked on every request (no route caching); align function timeout with the 60s LLM timeout
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RequestSchema = AnalyzeRequestSchema;
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

  const language = parsed.data.language ?? "English";

  const doc = store.getDoc(parsed.data.docId);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const cached = store.getDecisionMap(doc.id, language);
  if (cached) return NextResponse.json(cached);

  const prompt = `Analyze the following legal document and extract a structured Decision Map.

<document>
${doc.pages.map((p) => `--- Page ${p.n} ---\n${p.text}`).join("\n\n")}
</document>

Return a JSON object with:
- "title": short document title
- "summary": 2-3 sentence plain-language summary
- "claims": array of extracted clauses, each with:
  - "text": plain-language explanation of the clause
  - "category": one of "obligation", "right", "key_date", "payment", "termination", "risk_flag"
  - "severity": "low", "medium", or "high" (for risk_flag and obligation)
  - "sourceQuotes": array of EXACT quotes from the document that support this claim (copy verbatim)
- "questionsForLawyer": array of neutral questions a user should ask a legal professional about this document

Write "title", "summary", every claim "text", and all "questionsForLawyer" in ${language}.
CRITICAL: "sourceQuotes" must be EXACT verbatim quotes copied from the document in its ORIGINAL language — never translate quotes, or citation verification will fail. Only the explanations are in ${language}.`;

  try {
    const raw = await generateStructured<DecisionMap>(prompt, {
      temperature: 0.1,
    });

    const parseResult = DecisionMapSchema.safeParse(raw);
    if (!parseResult.success) {
      console.error("Model output failed schema validation:", parseResult.error);
      return NextResponse.json(
        { error: "Analysis produced invalid output. Please try again." },
        { status: 502 }
      );
    }

    const validated: ValidatedDecisionMap = {
      title: parseResult.data.title,
      summary: parseResult.data.summary,
      questionsForLawyer: parseResult.data.questionsForLawyer,
      claims: parseResult.data.claims.map((claim): ValidatedClaim => {
        const { spans, unverified } = validateAllQuotes(
          claim.sourceQuotes,
          doc.id,
          doc.pages
        );
        return {
          text: claim.text,
          category: claim.category,
          severity: claim.severity,
          sourceSpans: spans,
          unverifiedQuotes: unverified,
        };
      }),
    };

    store.setDecisionMap(doc.id, validated, language);
    return NextResponse.json(validated);
  } catch (e) {
    console.error("Analysis failed:", e);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
