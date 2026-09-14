# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ClauseCompass, please report it by opening a GitHub issue.

## Security Controls

| Control | Implementation |
|---|---|
| Server-only API keys | `GEMINI_API_KEY` stored in environment variables, never exposed to client |
| Content Security Policy | `script-src 'self' 'unsafe-inline'`; `frame-ancestors 'none'`; no `unsafe-eval` |
| HSTS | `max-age=63072000; includeSubDomains; preload` |
| Rate limiting | Per-IP token bucket (20 req/min) with periodic cleanup |
| IP header parsing | Last IP from `x-forwarded-for` (load-balancer-appended, not client-spoofable first) |
| Upload validation | File type (PDF/text only), size (10 MB max), page count (100 max), minimum content |
| Prompt injection defense | System instruction treats document content as data; filename sanitization in prompts |
| Input sanitization | Zod schema validation at every API boundary |
| Secret scanning | gitleaks in CI pipeline |
| Non-root container | Dockerfile runs as unprivileged `nextjs` user |
| Memory-only storage | Documents never persist to disk; auto-purged after 30 minutes |
| Security headers | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control |

## Dependencies

Dependencies are pinned and reviewed. No known vulnerabilities at time of submission.
