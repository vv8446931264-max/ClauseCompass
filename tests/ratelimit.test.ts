import { describe, it, expect } from "vitest";
import { checkRateLimit, parseClientIp } from "@/lib/ratelimit";

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const ip = `test-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      const { allowed } = checkRateLimit(ip);
      expect(allowed).toBe(true);
    }
  });

  it("blocks requests over the limit", () => {
    const ip = `test-blocked-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      checkRateLimit(ip);
    }
    const { allowed, retryAfterMs } = checkRateLimit(ip);
    expect(allowed).toBe(false);
    expect(retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks different IPs independently", () => {
    const ip1 = `test-ip1-${Date.now()}`;
    const ip2 = `test-ip2-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      checkRateLimit(ip1);
    }
    const { allowed: blocked } = checkRateLimit(ip1);
    const { allowed: ok } = checkRateLimit(ip2);
    expect(blocked).toBe(false);
    expect(ok).toBe(true);
  });

  it("returns retryAfterMs as 0 when under limit", () => {
    const ip = `test-retry-${Date.now()}`;
    const { retryAfterMs } = checkRateLimit(ip);
    expect(retryAfterMs).toBe(0);
  });

  it("resets after window expires", async () => {
    const ip = `test-window-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      checkRateLimit(ip);
    }
    expect(checkRateLimit(ip).allowed).toBe(false);
  });
});

describe("parseClientIp", () => {
  it("returns last IP from comma-separated list", () => {
    expect(parseClientIp("1.2.3.4, 10.0.0.1, 192.168.1.1")).toBe("192.168.1.1");
  });

  it("returns single IP as-is", () => {
    expect(parseClientIp("1.2.3.4")).toBe("1.2.3.4");
  });

  it("returns unknown for null", () => {
    expect(parseClientIp(null)).toBe("unknown");
  });

  it("returns unknown for empty string", () => {
    expect(parseClientIp("")).toBe("unknown");
  });

  it("trims whitespace from IPs", () => {
    expect(parseClientIp("  1.2.3.4  ,  10.0.0.1  ")).toBe("10.0.0.1");
  });
});
