"use client";

import { useState, useRef, memo, type FormEvent, type DragEvent } from "react";
import type { ValidatedCompareResult, ValidatedClaim } from "@/lib/schemas";

/** Interactive comparison form + results — the only client JS on the /compare route. */
export function CompareForm() {
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

  if (!result) {
    return (
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
                  <input ref={file1Ref} type="file" accept=".pdf,.txt,.docx" className="hidden" id="file1-upload"
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
                  <input ref={file2Ref} type="file" accept=".pdf,.txt,.docx" className="hidden" id="file2-upload"
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
          className="w-full accent-cta py-3 rounded-xl font-semibold text-lg disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 cursor-pointer shadow-sm hover:shadow-md">
          {loading ? "Comparing…" : "Compare Documents"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Comparison Results</h2>
        <button onClick={handleCleanup} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Compare new documents
        </button>
      </div>

      {result.changed.length > 0 && (
        <Section title="Changed Clauses" icon={<path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />} color="border-l-amber-500 border-amber-200/60 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/10" iconColor="text-amber-600 dark:text-amber-400">
          {result.changed.map((c) => (
            <div key={c.explanation} className="border-l-4 border-l-amber-400 border border-border-custom rounded-r-xl p-4 bg-surface space-y-2">
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div><span className="font-semibold text-red-600 dark:text-red-400">Before:</span> {c.before.text}</div>
                <div><span className="font-semibold text-emerald-600 dark:text-emerald-400">After:</span> {c.after.text}</div>
              </div>
              <p className="text-xs text-muted italic">{c.explanation}</p>
              <VerificationBadge claim={c.after} />
            </div>
          ))}
        </Section>
      )}

      {result.added.length > 0 && (
        <Section title="Added Clauses" icon={<path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />} color="border-l-emerald-500 border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/10" iconColor="text-emerald-600 dark:text-emerald-400">
          {result.added.map((c) => <ClaimLine key={c.text} claim={c} />)}
        </Section>
      )}

      {result.removed.length > 0 && (
        <Section title="Removed Clauses" icon={<path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />} color="border-l-red-500 border-red-200/60 dark:border-red-800/40 bg-red-50/60 dark:bg-red-950/10" iconColor="text-red-600 dark:text-red-400">
          {result.removed.map((c) => <ClaimLine key={c.text} claim={c} />)}
        </Section>
      )}

      {result.unchanged.length > 0 && (
        <Section title="Unchanged Clauses" icon={<path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />} color="border-l-slate-400 border-border-custom bg-surface-alt" iconColor="text-muted">
          {result.unchanged.map((c) => <ClaimLine key={c.text} claim={c} />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, color, iconColor, children }: { title: string; icon: React.ReactNode; color: string; iconColor: string; children: React.ReactNode }) {
  return (
    <section className={`border-l-4 border rounded-xl overflow-hidden ${color} space-y-2`}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconColor}>{icon}</svg>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="px-4 pb-4 space-y-2">{children}</div>
    </section>
  );
}

const VerificationBadge = memo(function VerificationBadge({ claim }: { claim: ValidatedClaim }) {
  const verified = claim.sourceSpans.length;
  const unverified = claim.unverifiedQuotes.length;
  if (verified === 0 && unverified === 0) return null;
  return (
    <div className="flex gap-2 text-xs">
      {verified > 0 && <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> {verified} verified</span>}
      {unverified > 0 && <span className="text-faint inline-flex items-center gap-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M12 10v3M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg> {unverified} unverified</span>}
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
