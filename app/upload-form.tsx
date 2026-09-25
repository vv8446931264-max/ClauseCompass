"use client";

import { useState, useRef, type FormEvent, type DragEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

/** The only interactive part of the landing page — kept as a small client island so the
 * rest of the marketing page can render as server components (minimal client JS). */
export function UploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>("");

  async function submitForm(form: FormData, failMsg: string) {
    try {
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? failMsg);
        setLoading(false);
        return;
      }
      router.push(`/analyze/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData();
    if (mode === "upload") {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        setError("Please select a file");
        setLoading(false);
        return;
      }
      form.append("file", file);
    } else {
      if (!pastedText.trim()) {
        setError("Please paste some text");
        setLoading(false);
        return;
      }
      form.append("text", pastedText);
    }
    await submitForm(form, "Upload failed");
  }

  async function handleSample() {
    setLoading(true);
    setError("");
    // @perf-audit: the ~2KB sample document is code-split out of the initial bundle
    const { SAMPLE_TEXT } = await import("@/lib/sample-lease");
    const form = new FormData();
    form.append("text", SAMPLE_TEXT);
    await submitForm(form, "Failed to load sample");
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && fileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      setSelectedFile(file.name);
    }
  }

  function handleFileChange() {
    const file = fileRef.current?.files?.[0];
    setSelectedFile(file?.name ?? "");
  }

  // Full WAI-ARIA tab keyboard support (arrow/Home/End move + focus the target tab).
  function handleTabKeys(e: KeyboardEvent) {
    const order: ("upload" | "paste")[] = ["upload", "paste"];
    const i = order.indexOf(mode);
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % 2;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i + 1) % 2;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    else return;
    e.preventDefault();
    const target = order[next]!;
    setMode(target);
    document.getElementById(target === "upload" ? "tab-upload" : "tab-paste")?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className="flex gap-1 p-1 bg-surface-alt rounded-lg w-fit mx-auto"
        role="tablist"
        aria-label="Document input method"
        onKeyDown={handleTabKeys}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "upload"}
          aria-controls="io-tabpanel"
          id="tab-upload"
          tabIndex={mode === "upload" ? 0 : -1}
          onClick={() => setMode("upload")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "upload" ? "bg-surface shadow text-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          Upload File
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "paste"}
          aria-controls="io-tabpanel"
          id="tab-paste"
          tabIndex={mode === "paste" ? 0 : -1}
          onClick={() => setMode("paste")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "paste" ? "bg-surface shadow text-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          Paste Text
        </button>
      </div>

      <div role="tabpanel" id="io-tabpanel" aria-labelledby={mode === "upload" ? "tab-upload" : "tab-paste"}>
        {mode === "upload" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragOver
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : selectedFile
                ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20"
                : "border-border-custom hover:border-muted"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp"
              className="hidden"
              id="file-upload"
              aria-label="Upload or photograph a legal document"
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
              {selectedFile ? (
                <>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mx-auto text-green-600 dark:text-green-400">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm text-green-700 dark:text-green-400 font-medium block">{selectedFile}</span>
                  <span className="text-xs text-green-600 dark:text-green-500 block">Click to change file</span>
                </>
              ) : (
                <>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mx-auto text-faint">
                    <path d="M6 3a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8l-5-5H6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M12 18v-6M9.5 14.5L12 12l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm text-muted block">
                    Drop a PDF, photo, or text file here, or{" "}
                    <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
                  </span>
                  <span className="text-xs text-faint block">
                    PDF · DOCX · photo/scan of a contract · plain text &middot; Max 10 MB
                  </span>
                </>
              )}
            </label>
          </div>
        ) : (
          <div className="space-y-1">
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your legal document text here…"
              rows={10}
              className="w-full border border-border-custom rounded-xl p-4 text-sm resize-y bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Paste legal document text"
            />
            <p className="text-xs text-faint text-right">
              {pastedText.length > 0 ? `${pastedText.length.toLocaleString()} characters` : ""}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 mt-0.5"><path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || (mode === "upload" ? !selectedFile : !pastedText.trim())}
        className="w-full accent-cta py-3 rounded-xl font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-md transition-all"
      >
        {loading ? "Processing…" : "Analyze Document"}
      </button>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm">
        <button
          type="button"
          onClick={handleSample}
          disabled={loading}
          className="text-gold font-medium hover:underline disabled:opacity-50"
        >
          New here? Try a sample lease &rarr;
        </button>
        <span className="text-faint flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Private &middot; auto-deleted in 30 min
        </span>
      </div>
    </form>
  );
}
