import { z } from "zod";

// --- Source spans: the ground truth ---

export const SourceSpanSchema = z.object({
  id: z.string(),
  docId: z.string(),
  page: z.number().int().min(1),
  quote: z.string().min(1),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});
export type SourceSpan = z.infer<typeof SourceSpanSchema>;

// --- Extracted pages ---

export const PageSchema = z.object({
  n: z.number().int().min(1),
  text: z.string(),
});
export type Page = z.infer<typeof PageSchema>;

export const ExtractedDocSchema = z.object({
  id: z.string(),
  filename: z.string(),
  pages: z.array(PageSchema).min(1),
  fullText: z.string(),
});
export type ExtractedDoc = z.infer<typeof ExtractedDocSchema>;

// --- Claims & clauses ---

export const ClauseCategory = z.enum([
  "obligation",
  "right",
  "key_date",
  "payment",
  "termination",
  "risk_flag",
]);
export type ClauseCategory = z.infer<typeof ClauseCategory>;

export const Severity = z.enum(["low", "medium", "high"]);
export type Severity = z.infer<typeof Severity>;

export const ClaimSchema = z.object({
  text: z.string().min(1),
  category: ClauseCategory,
  severity: Severity.optional(),
  sourceQuotes: z.array(z.string().min(1)).min(1),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const DecisionMapSchema = z.object({
  title: z.string(),
  summary: z.string(),
  claims: z.array(ClaimSchema).min(1),
  questionsForLawyer: z.array(z.string()).min(1),
});
export type DecisionMap = z.infer<typeof DecisionMapSchema>;

// --- Validated claim (after citation validation) ---

export interface ValidatedClaim extends Omit<Claim, "sourceQuotes"> {
  sourceSpans: SourceSpan[];
  unverifiedQuotes: string[];
}

export interface ValidatedDecisionMap
  extends Omit<DecisionMap, "claims"> {
  claims: ValidatedClaim[];
}

// --- Q&A ---

// --- Output languages (the "Access" story: understand legal docs in your own language) ---
// Source quotes always stay in the document's original language so citation validation still matches.
export const SUPPORTED_LANGUAGES = [
  "English",
  "हिन्दी (Hindi)",
  "বাংলা (Bengali)",
  "தமிழ் (Tamil)",
  "తెలుగు (Telugu)",
  "मराठी (Marathi)",
  "Español (Spanish)",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
const LanguageSchema = z.enum(SUPPORTED_LANGUAGES).optional();

// @architecture-audit: .strict() rejects unexpected keys on client input
export const QARequestSchema = z
  .object({
    docId: z.string().min(1),
    question: z.string().min(1).max(2000),
    language: LanguageSchema,
  })
  .strict();
export type QARequest = z.infer<typeof QARequestSchema>;

export const AnalyzeRequestSchema = z
  .object({
    docId: z.string().min(1),
    language: LanguageSchema,
  })
  .strict();

// --- Comparison ---

export const CompareResultSchema = z.object({
  added: z.array(ClaimSchema),
  removed: z.array(ClaimSchema),
  changed: z.array(
    z.object({
      before: ClaimSchema,
      after: ClaimSchema,
      explanation: z.string(),
    })
  ),
  unchanged: z.array(ClaimSchema),
});
export type CompareResult = z.infer<typeof CompareResultSchema>;

export interface ValidatedCompareResult {
  added: ValidatedClaim[];
  removed: ValidatedClaim[];
  changed: { before: ValidatedClaim; after: ValidatedClaim; explanation: string }[];
  unchanged: ValidatedClaim[];
}

// --- Upload validation ---

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_PAGES = 100;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const;
export const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  DOCX_TYPE,
  ...IMAGE_TYPES,
] as const;
