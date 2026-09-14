import { describe, it, expect } from "vitest";
import { riskScore } from "@/lib/risk";
import type { ValidatedClaim } from "@/lib/schemas";

function claim(over: Partial<ValidatedClaim>): ValidatedClaim {
  return {
    text: "x",
    category: "obligation",
    sourceSpans: [],
    unverifiedQuotes: [],
    ...over,
  };
}

describe("riskScore", () => {
  it("returns 0/low for no claims", () => {
    expect(riskScore([])).toEqual({ score: 0, level: "low" });
  });

  it("scores high-severity clauses heavily", () => {
    const r = riskScore([
      claim({ severity: "high" }),
      claim({ severity: "high" }),
      claim({ category: "risk_flag", severity: "high" }),
    ]);
    expect(r.level).toBe("high");
    expect(r.score).toBeGreaterThanOrEqual(7);
  });

  it("caps score at 10", () => {
    const many = Array.from({ length: 20 }, () =>
      claim({ severity: "high", category: "risk_flag" })
    );
    expect(riskScore(many).score).toBe(10);
  });

  it("treats a clean low-severity doc as low risk", () => {
    const r = riskScore([
      claim({ severity: "low", sourceSpans: [{ id: "1", docId: "d", page: 1, quote: "q", start: 0, end: 1 }] }),
    ]);
    expect(r.level).toBe("low");
  });

  it("raises risk when citations are unverified", () => {
    const withUnverified = riskScore([
      claim({ severity: "medium", unverifiedQuotes: ["a", "b", "c"] }),
    ]);
    const withVerified = riskScore([
      claim({ severity: "medium", sourceSpans: [{ id: "1", docId: "d", page: 1, quote: "q", start: 0, end: 1 }] }),
    ]);
    expect(withUnverified.score).toBeGreaterThan(withVerified.score);
  });
});
