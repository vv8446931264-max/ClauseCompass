import type { ValidatedClaim } from "./schemas";

export interface RiskResult {
  score: number; // 0-10
  level: "low" | "medium" | "high";
}

/**
 * Overall document risk score (0-10) derived from high/medium severity clauses,
 * risk-flag count, and the ratio of unverifiable citations. Pure and deterministic.
 */
export function riskScore(claims: ValidatedClaim[]): RiskResult {
  if (claims.length === 0) return { score: 0, level: "low" };

  const high = claims.filter((c) => c.severity === "high").length;
  const medium = claims.filter((c) => c.severity === "medium").length;
  const flags = claims.filter((c) => c.category === "risk_flag").length;

  const verified = claims.reduce((n, c) => n + c.sourceSpans.length, 0);
  const unverified = claims.reduce((n, c) => n + c.unverifiedQuotes.length, 0);
  const total = verified + unverified;
  const unverifiedRatio = total > 0 ? unverified / total : 0;

  const raw = high * 2.5 + medium + flags * 1.5 + unverifiedRatio * 2;
  const score = Math.min(10, Math.round(raw));
  const level = score >= 7 ? "high" : score >= 4 ? "medium" : "low";

  return { score, level };
}
