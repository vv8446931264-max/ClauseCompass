const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_BUCKETS = 10_000; // @architecture-audit: bound memory against IP-rotating floods

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function purgeExpiredBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(ip);
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(purgeExpiredBuckets, CLEANUP_INTERVAL_MS);
}

/** Extract the last (load-balancer-appended) IP from x-forwarded-for. The first IP is client-spoofable. */
export function parseClientIp(headerValue: string | null): string {
  if (!headerValue) return "unknown";
  const ips = headerValue.split(",");
  const last = ips[ips.length - 1];
  return last?.trim() || "unknown";
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest) buckets.delete(oldest);
    }
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count++;
  return { allowed: true, retryAfterMs: 0 };
}
