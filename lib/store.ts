import type { ExtractedDoc, ValidatedDecisionMap, ValidatedCompareResult } from "./schemas";

interface DocSession {
  doc: ExtractedDoc;
  decisionMaps: Map<string, ValidatedDecisionMap>; // keyed by output language
  createdAt: number;
}

/** In-memory document store with automatic TTL expiry. No database by design — privacy-first, documents never hit disk. */
const TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_STORE_SIZE = 1000; // @architecture-audit: bound memory; evict oldest past this
const store = new Map<string, DocSession>();

function purgeExpired() {
  const now = Date.now();
  for (const [id, session] of store) {
    if (now - session.createdAt > TTL_MS) store.delete(id);
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(purgeExpired, CLEANUP_INTERVAL_MS);
}

export function setDoc(doc: ExtractedDoc): void {
  // @perf-audit: O(1) write — the interval sweep handles bulk expiry; here we only
  // evict the single oldest entry if we're at the cap (Map preserves insertion order).
  if (store.size >= MAX_STORE_SIZE) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(doc.id, { doc, decisionMaps: new Map(), createdAt: Date.now() });
}

// @perf-audit: O(1) freshness check on the read path instead of an O(n) full-store scan
// per request; the setInterval sweep handles bulk cleanup.
function live(id: string): DocSession | undefined {
  const s = store.get(id);
  if (!s) return undefined;
  if (Date.now() - s.createdAt > TTL_MS) {
    store.delete(id);
    return undefined;
  }
  return s;
}

export function getDoc(id: string): ExtractedDoc | undefined {
  return live(id)?.doc;
}

export function setDecisionMap(
  docId: string,
  map: ValidatedDecisionMap,
  language = "English"
): void {
  const session = live(docId);
  if (session) session.decisionMaps.set(language, map);
}

export function getDecisionMap(
  docId: string,
  language = "English"
): ValidatedDecisionMap | undefined {
  return live(docId)?.decisionMaps.get(language);
}

export function deleteDoc(id: string): boolean {
  // Drop any cached comparison that referenced this doc on either side
  for (const key of compareCache.keys()) {
    if (key.startsWith(`${id}:`) || key.endsWith(`:${id}`)) compareCache.delete(key);
  }
  return store.delete(id);
}

// @perf-audit: cache two-document comparisons so re-opening the same pair doesn't re-call Gemini
const compareCache = new Map<string, ValidatedCompareResult>();
const MAX_COMPARE_CACHE = 500;

export function getCompare(
  docId1: string,
  docId2: string
): ValidatedCompareResult | undefined {
  return compareCache.get(`${docId1}:${docId2}`);
}

export function setCompare(
  docId1: string,
  docId2: string,
  result: ValidatedCompareResult
): void {
  if (compareCache.size >= MAX_COMPARE_CACHE) {
    const oldest = compareCache.keys().next().value;
    if (oldest) compareCache.delete(oldest);
  }
  compareCache.set(`${docId1}:${docId2}`, result);
}
