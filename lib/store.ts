import type { ExtractedDoc, ValidatedDecisionMap, ValidatedCompareResult } from "./schemas";

interface DocSession {
  doc: ExtractedDoc;
  decisionMaps: Map<string, ValidatedDecisionMap>;
  createdAt: number;
  estimatedBytes: number;
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_STORE_SIZE = 1000;
const MAX_DOC_TEXT_BYTES = 2 * 1024 * 1024; // 2 MB extracted text per document
const MAX_TOTAL_BYTES = 512 * 1024 * 1024; // 512 MB total memory budget — backpressure via 503
// ponytail: swap this module for Redis/Firestore for horizontal scaling — interface stays the same

const store = new Map<string, DocSession>();
let totalStoredBytes = 0;

function estimateBytes(doc: ExtractedDoc): number {
  let bytes = doc.fullText.length * 2; // JS strings are UTF-16
  for (const p of doc.pages) bytes += p.text.length * 2;
  return bytes + 512;
}

function removeSession(id: string): boolean {
  const session = store.get(id);
  if (!session) return false;
  totalStoredBytes -= session.estimatedBytes;
  store.delete(id);
  return true;
}

function purgeExpired() {
  const now = Date.now();
  for (const [id, session] of store) {
    if (now - session.createdAt > TTL_MS) removeSession(id);
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(purgeExpired, CLEANUP_INTERVAL_MS);
}

export function memoryPressureOk(): boolean {
  if (typeof process === "undefined" || !process.memoryUsage) return true;
  // RSS = actual physical memory; heapUsed/heapTotal ratio is unreliable because V8 resizes heapTotal dynamically
  const RSS_LIMIT = 900 * 1024 * 1024; // 900 MB — leaves headroom on a 1 Gi Cloud Run container
  return process.memoryUsage().rss < RSS_LIMIT;
}

export function setDoc(doc: ExtractedDoc): { stored: boolean; reason?: string } {
  const bytes = estimateBytes(doc);

  if (bytes > MAX_DOC_TEXT_BYTES) {
    return { stored: false, reason: "Document text exceeds per-document size limit" };
  }

  if (!memoryPressureOk()) {
    return { stored: false, reason: "Server under memory pressure — try again shortly" };
  }

  if (store.has(doc.id)) removeSession(doc.id);

  while (totalStoredBytes + bytes > MAX_TOTAL_BYTES && store.size > 0) {
    const oldest = store.keys().next().value;
    if (oldest) removeSession(oldest);
    else break;
  }

  if (store.size >= MAX_STORE_SIZE) {
    const oldest = store.keys().next().value;
    if (oldest) removeSession(oldest);
  }

  totalStoredBytes += bytes;
  store.set(doc.id, { doc, decisionMaps: new Map(), createdAt: Date.now(), estimatedBytes: bytes });
  return { stored: true };
}

function live(id: string): DocSession | undefined {
  const s = store.get(id);
  if (!s) return undefined;
  if (Date.now() - s.createdAt > TTL_MS) {
    removeSession(id);
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
  for (const key of compareCache.keys()) {
    if (key.startsWith(`${id}:`) || key.endsWith(`:${id}`)) compareCache.delete(key);
  }
  return removeSession(id);
}

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
