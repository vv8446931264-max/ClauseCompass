import { describe, it, expect } from "vitest";
import { DecisionMapSchema, ClaimSchema, QARequestSchema } from "@/lib/schemas";

describe("ClaimSchema", () => {
  it("accepts a valid claim", () => {
    const result = ClaimSchema.safeParse({
      text: "Rent is $1,450 per month",
      category: "payment",
      severity: "medium",
      sourceQuotes: ["Monthly rent shall be $1,450.00"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects claim with empty sourceQuotes", () => {
    const result = ClaimSchema.safeParse({
      text: "Something",
      category: "obligation",
      sourceQuotes: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = ClaimSchema.safeParse({
      text: "Something",
      category: "invalid",
      sourceQuotes: ["quote"],
    });
    expect(result.success).toBe(false);
  });
});

describe("DecisionMapSchema", () => {
  it("accepts a valid decision map", () => {
    const result = DecisionMapSchema.safeParse({
      title: "Lease Agreement",
      summary: "A residential lease.",
      claims: [
        {
          text: "Rent is due monthly",
          category: "payment",
          sourceQuotes: ["Monthly rent shall be $1,450.00"],
        },
      ],
      questionsForLawyer: ["What happens if I break the lease?"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty claims array", () => {
    const result = DecisionMapSchema.safeParse({
      title: "Test",
      summary: "Test",
      claims: [],
      questionsForLawyer: ["Q?"],
    });
    expect(result.success).toBe(false);
  });
});

describe("QARequestSchema", () => {
  it("accepts a valid request", () => {
    const result = QARequestSchema.safeParse({
      docId: "abc123",
      question: "What is the rent?",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty question", () => {
    const result = QARequestSchema.safeParse({
      docId: "abc123",
      question: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing docId", () => {
    const result = QARequestSchema.safeParse({
      question: "What is the rent?",
    });
    expect(result.success).toBe(false);
  });
});

describe("ClaimSchema edge cases", () => {
  it("accepts claim without severity (optional)", () => {
    const result = ClaimSchema.safeParse({
      text: "The lease term is 12 months",
      category: "key_date",
      sourceQuotes: ["twelve (12) months"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid severity value", () => {
    const result = ClaimSchema.safeParse({
      text: "Something",
      category: "obligation",
      severity: "critical",
      sourceQuotes: ["quote"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid categories", () => {
    const categories = ["obligation", "right", "key_date", "payment", "termination", "risk_flag"];
    for (const category of categories) {
      const result = ClaimSchema.safeParse({
        text: "Test",
        category,
        sourceQuotes: ["quote text"],
      });
      expect(result.success).toBe(true);
    }
  });
});
