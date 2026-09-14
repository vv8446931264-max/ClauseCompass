"use client";

import { useState, useRef, memo, type FormEvent, type DragEvent } from "react";
import type { ValidatedCompareResult, ValidatedClaim } from "@/lib/schemas";

export default function ComparePage() {
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ValidatedCompareResult | null>(null);
  const [docId1, setDocId1] = useState("");
  const [docId2, setDocId2] = useState("");
  const [drag1, setDrag1] = useState(false);
  const [drag2, setDrag2] = useState(false);
  const [file1Name, setFile1Name] = useState("");
  const [file2Name, setFile2Name] = useState("");

  async function uploadDoc(form: FormData): Promise<string | null> {
    const res = await fetch("/api/extract", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return null;
    }
    return data.id;
  }

  function handleDrop(e: DragEvent, fileRef: React.RefObject<HTMLInputElement | null>, setName: (n: string) => void, setDrag: (d: boolean) => void) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file && fileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      setName(file.name);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const form1 = new FormData();
      const form2 = new FormData();

      if (mode === "upload") {
        const f1 = file1Ref.current?.files?.[0];
        const f2 = file2Ref.current?.files?.[0];
        if (!f1 || !f2) {
          setError("Please select both files");
          setLoading(false);
          return;
        }
        form1.append("file", f1);
        form2.append("file", f2);
      } else {
        if (!text1.trim() || !text2.trim()) {
          setError("Please paste text for both documents");
          setLoading(false);
          return;
        }
        form1.append("text", text1);
        form2.append("text", text2);
      }

      const [id1, id2] = await Promise.all([uploadDoc(form1), uploadDoc(form2)]);
      if (!id1 || !id2) { setLoading(false); return; }
      setDocId1(id1);
      setDocId2(id2);

      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId1: id1, docId2: id2 }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Comparison failed");
        setLoading(false);
        return;
      }

      setResult(await res.json());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanup() {
    if (docId1) await fetch(`/api/session?docId=${docId1}`, { method: "DELETE" });
    if (docId2) await fetch(`/api/session?docId=${docId2}`, { method: "DELETE" });
    setResult(null);
    setDocId1("");
    setDocId2("");
    setText1("");
    setText2("");
    setFile1Name("");
    setFile2Name("");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          Version comparison
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">See what changed</h1>
        <p className="text-muted">
          Upload two versions of a contract and get a clause-by-clause breakdown &mdash; added,
          removed, and changed &mdash; each side cited to its source.
        </p>
      </div>

      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-2 p-1 bg-surface-alt rounded-lg w-fit mx-auto" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "paste"} aria-controls="compare-tabpanel" id="compare-tab-paste" onClick={() => setMode("paste")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "paste" ? "bg-surface shadow text-foreground" : "text-muted hover:text-foreground"}`}>
              Paste Text
            </button>
            <button type="button" role="tab" aria-selected={mode === "upload"} aria-controls="compare-tabpanel" id="compare-tab-upload" onClick={() => setMode("upload")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "upload" ? "bg-surface shadow text-foreground" : "text-muted hover:text-foreground"}`}>
              Upload Files
            </button>
          </div>

          <div role="tabpanel" id="compare-tabpanel" aria-labelledby={mode === "paste" ? "compare-tab-paste" : "compare-tab-upload"} className="grid md:grid-cols-2 gap-4">
            {mode === "paste" ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Document 1 (Original)</label>
                  <textarea value={text1} onChange={(e) => setText1(e.target.value)} rows={10}
                    className="w-full border border-border-custom rounded-lg p-3 text-sm resize-y bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Paste original document…" aria-label="Original document text" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Document 2 (Revised)</label>
                  <textarea value={text2} onChange={(e) => setText2(e.target.value)} rows={10}
                    className="w-full border border-border-custom rounded-lg p-3 text-sm resize-y bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Paste revised document…" aria-label="Revised document text" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Document 1 (Original)</label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDrag1(true); }}
                    onDragLeave={() => setDrag1(false)}
                    onDrop={(e) => handleDrop(e, file1Ref, setFile1Name, setDrag1)}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      drag1 ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : file1Name ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20" : "border-border-custom hover:border-muted"
                    }`}
                  >
                    <input ref={file1Ref} type="file" accept=".pdf,.txt" className="hidden" id="file1-upload"
                      aria-label="Upload original document" onChange={() => setFile1Name(file1Ref.current?.files?.[0]?.name ?? "")} />
                    <label htmlFor="file1-upload" className="cursor-pointer text-sm text-muted block">
                      {file1Name ? <span className="text-green-700 dark:text-green-400 font-medium">{file1Name}</span> : <>Drop file or <span className="text-blue-600 dark:text-blue-400 underline">browse</span></>}
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Document 2 (Revised)</label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDrag2(true); }}
                    onDragLeave={() => setDrag2(false)}
                    onDrop={(e) => handleDrop(e, file2Ref, setFile2Name, setDrag2)}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      drag2 ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : file2Name ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20" : "border-border-custom hover:border-muted"
                    }`}
                  >
                    <input ref={file2Ref} type="file" accept=".pdf,.txt" className="hidden" id="file2-upload"
                      aria-label="Upload revised document" onChange={() => setFile2Name(file2Ref.current?.files?.[0]?.name ?? "")} />
                    <label htmlFor="file2-upload" className="cursor-pointer text-sm text-muted block">
                      {file2Name ? <span className="text-green-700 dark:text-green-400 font-medium">{file2Name}</span> : <>Drop file or <span className="text-blue-600 dark:text-blue-400 underline">browse</span></>}
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 text-center">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} aria-busy={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            {loading ? "Comparing…" : "Compare Documents"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Comparison Results</h2>
            <button onClick={handleCleanup} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              ← Compare new documents
            </button>
          </div>

          {result.changed.length > 0 && (
            <Section title="🔄 Changed Clauses" color="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
              {result.changed.map((c) => (
                <div key={c.explanation} className="border border-border-custom rounded-lg p-3 bg-surface space-y-2">
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div><span className="font-medium text-red-600 dark:text-red-400">Before:</span> {c.before.text}</div>
                    <div><span className="font-medium text-green-600 dark:text-green-400">After:</span> {c.after.text}</div>
                  </div>
                  <p className="text-xs text-muted italic">{c.explanation}</p>
                  <VerificationBadge claim={c.after} />
                </div>
              ))}
            </Section>
          )}

          {result.added.length > 0 && (
            <Section title="➕ Added Clauses" color="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
              {result.added.map((c) => <ClaimLine key={c.text} claim={c} />)}
            </Section>
          )}

          {result.removed.length > 0 && (
            <Section title="➖ Removed Clauses" color="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
              {result.removed.map((c) => <ClaimLine key={c.text} claim={c} />)}
            </Section>
          )}

          {result.unchanged.length > 0 && (
            <Section title="🟰 Unchanged Clauses" color="border-border-custom bg-surface-alt">
              {result.unchanged.map((c) => <ClaimLine key={c.text} claim={c} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section className={`border rounded-xl p-4 ${color} space-y-2`}>
      <h3 className="font-semibold text-sm">{title}</h3>
      {children}
    </section>
  );
}

const VerificationBadge = memo(function VerificationBadge({ claim }: { claim: ValidatedClaim }) {
  const verified = claim.sourceSpans.length;
  const unverified = claim.unverifiedQuotes.length;
  if (verified === 0 && unverified === 0) return null;
  return (
    <div className="flex gap-2 text-xs">
      {verified > 0 && <span className="text-emerald-600 dark:text-emerald-400">✓ {verified} verified</span>}
      {unverified > 0 && <span className="text-faint">⚠ {unverified} unverified</span>}
    </div>
  );
});

const ClaimLine = memo(function ClaimLine({ claim }: { claim: ValidatedClaim }) {
  return (
    <div className="bg-surface border border-border-custom rounded-lg p-3 text-sm">
      <p>{claim.text}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-muted capitalize">{claim.category.replace("_", " ")}</span>
        <VerificationBadge claim={claim} />
      </div>
    </div>
  );
});
