import type { ExtractedDoc, ValidatedDecisionMap } from "./schemas";

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
  purgeExpired();
  // @architecture-audit: Map preserves insertion order, so the first key is the oldest
  if (store.size >= MAX_STORE_SIZE) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(doc.id, { doc, decisionMaps: new Map(), createdAt: Date.now() });
}

export function getDoc(id: string): ExtractedDoc | undefined {
  purgeExpired();
  return store.get(id)?.doc;
}

export function setDecisionMap(
  docId: string,
  map: ValidatedDecisionMap,
  language = "English"
): void {
  purgeExpired();
  const session = store.get(docId);
  if (session) session.decisionMaps.set(language, map);
}

export function getDecisionMap(
  docId: string,
  language = "English"
): ValidatedDecisionMap | undefined {
  return store.get(docId)?.decisionMaps.get(language);
}

export function deleteDoc(id: string): boolean {
  return store.delete(id);
}
