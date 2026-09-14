# Traceability Matrix

## Requirement → Feature → Component → Test

| # | Requirement | Feature | Component | Test |
|---|---|---|---|---|
| R1 | Simplifying complex legal documents | Decision Map with plain-language claims | `api/analyze`, `analyze/[id]/page.tsx` | `citations.test.ts`, `schemas.test.ts` |
| R2 | Comparing contracts or policies | Two-document comparison with citation validation | `api/compare`, `compare/page.tsx` | `schemas.test.ts` |
| R3 | Highlighting clauses, obligations, risks | Category-grouped view with severity badges | `lib/schemas.ts`, analysis page | `schemas.test.ts` |
| R4 | Answering questions from documents | Grounded Q&A with streaming | `api/ask`, Q&A panel | Manual |
| R5 | Helping users understand next steps | "Questions for Your Lawyer" checklist | Analysis page | Manual |
| R6 | Generating actionable outputs | Summary + categorized claims + lawyer questions | Analysis page | Manual |
| R7 | Preparing for a legal professional | Neutral question generation | Analysis page | Manual |

## Security Controls

| Control | Implementation | Test/Evidence |
|---|---|---|
| Server-only API keys | `GEMINI_API_KEY` in env only | `.gitignore`, CI env |
| Upload validation | Type, size, page count, min content | `api/extract/route.ts` |
| Rate limiting | Per-IP token bucket, periodic cleanup | `ratelimit.test.ts` |
| IP header parsing | Last IP from x-forwarded-for (not spoofable first) | `ratelimit.test.ts` (parseClientIp) |
| Prompt injection defense | System instruction treats doc as data; filename sanitization in prompt templates | `lib/llm.ts`, `api/compare/route.ts` |
| Secret scanning | gitleaks in CI | `.github/workflows/ci.yml` |
| Memory cleanup | Periodic setInterval purge | `store.ts` |
| CSP | No unsafe-eval, frame-ancestors none | `next.config.ts` |
| Non-root container | USER nextjs in Dockerfile | `Dockerfile` |
| Citation validation | All 3 features (analyze, compare, Q&A prompt) | `citations.test.ts` |
| Text extraction | PDF and plain-text extraction with page numbering | `extract.test.ts` |
| Filename sanitization | User-controlled filenames stripped before prompt interpolation | `api/compare/route.ts` |

## Accessibility

| Feature | Implementation |
|---|---|
| Semantic HTML | `<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`, `<blockquote>` |
| ARIA | `role="tablist"`, `role="tab"`, `aria-selected`, `aria-label`, `aria-live` |
| Focus management | `focus:ring-*` on all interactive elements |
| Skip to content | Skip link in `layout.tsx` |
| Dark mode | `prefers-color-scheme` via CSS custom properties |
| Reduced motion | `prefers-reduced-motion` disables animations |
| Focus visible | Custom `:focus-visible` outline |
