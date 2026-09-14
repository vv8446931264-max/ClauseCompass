"use client";

import { useState, useRef, useEffect, type FormEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";

const SAMPLE_TEXT = `RESIDENTIAL LEASE AGREEMENT

This Residential Lease Agreement ("Agreement") is entered into as of January 15, 2025, by and between:

Landlord: Greenfield Properties LLC, located at 456 Oak Avenue, Springfield, IL 62701
Tenant: Jane Doe, currently residing at 123 Elm Street, Springfield, IL 62702

1. PROPERTY
The Landlord hereby leases to the Tenant the property located at 789 Maple Drive, Unit 4B, Springfield, IL 62703 ("Premises").

2. TERM
The lease term shall commence on February 1, 2025, and shall terminate on January 31, 2026, a period of twelve (12) months. The Tenant must provide written notice of intent to vacate at least sixty (60) days prior to the end of the lease term.

3. RENT
Monthly rent shall be $1,450.00, due on the first day of each calendar month. A late fee of $75.00 shall be assessed for any payment received after the 5th day of the month. Rent shall be paid via electronic transfer to the account specified by the Landlord.

4. SECURITY DEPOSIT
The Tenant shall pay a security deposit of $2,900.00 (equivalent to two months' rent) upon execution of this Agreement. The deposit shall be returned within thirty (30) days of lease termination, less any deductions for damages beyond normal wear and tear. The Landlord shall provide an itemized statement of any deductions.

5. MAINTENANCE AND REPAIRS
The Landlord shall be responsible for structural repairs, plumbing, electrical systems, and appliance maintenance. The Tenant shall be responsible for routine upkeep and shall report any maintenance issues within 48 hours of discovery. The Tenant shall not make any alterations to the Premises without prior written consent of the Landlord.

6. UTILITIES
The Tenant shall be responsible for all utilities including electricity, gas, water, internet, and trash removal. The Landlord shall be responsible for property taxes and building insurance.

7. TERMINATION
Either party may terminate this Agreement with ninety (90) days written notice. The Landlord may terminate immediately if the Tenant: (a) fails to pay rent for more than fifteen (15) days past the due date; (b) causes substantial damage to the property; (c) engages in illegal activity on the Premises; or (d) violates any material term of this Agreement.

8. PETS
No pets are permitted on the Premises without prior written approval from the Landlord. An approved pet requires an additional pet deposit of $500.00 and monthly pet rent of $50.00.

9. INSURANCE
The Tenant is strongly encouraged to obtain renter's insurance covering personal property and liability. The Landlord's insurance does not cover the Tenant's personal belongings.

10. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Illinois. Any disputes arising under this Agreement shall be resolved through mediation before either party may pursue legal action.

11. SUBLETTING
The Tenant shall not sublet the Premises or assign this lease without the prior written consent of the Landlord. Unauthorized subletting shall constitute a material breach of this Agreement.

12. ENTRY BY LANDLORD
The Landlord may enter the Premises with at least twenty-four (24) hours written notice for inspections, repairs, or showings. In case of emergency, the Landlord may enter without notice.

SIGNATURES:

Landlord: ___________________________ Date: _______________
Greenfield Properties LLC

Tenant: ___________________________ Date: _______________
Jane Doe`;

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>("");

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

    try {
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setLoading(false);
        return;
      }
      router.push(`/analyze/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function handleSample() {
    setLoading(true);
    setError("");
    const form = new FormData();
    form.append("text", SAMPLE_TEXT);
    try {
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load sample");
        setLoading(false);
        return;
      }
      router.push(`/analyze/${data.id}`);
    } catch {
      setError("Network error");
      setLoading(false);
    }
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

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <ShowcaseImage
        src="/images/hero.webp"
        alt="ClauseCompass — navigate legal documents with AI-verified citations"
      />

      <div className="text-center space-y-3">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          AI for Legal Assistance &amp; Access
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
          Know exactly what you&rsquo;re signing
        </h1>
        <p className="text-muted text-lg leading-relaxed max-w-xl mx-auto">
          Upload a contract and get a plain-language map of risks, obligations,
          and deadlines &mdash;{" "}
          <span className="text-foreground font-semibold">
            each finding linked to the exact clause
          </span>{" "}
          that proves it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className="flex gap-1 p-1 bg-surface-alt rounded-lg w-fit mx-auto"
          role="tablist"
          aria-label="Document input method"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "upload"}
            aria-controls="tabpanel-upload"
            id="tab-upload"
            onClick={() => setMode("upload")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === "upload"
                ? "bg-surface shadow text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            Upload File
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "paste"}
            aria-controls="tabpanel-paste"
            id="tab-paste"
            onClick={() => setMode("paste")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === "paste"
                ? "bg-surface shadow text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            Paste Text
          </button>
        </div>

        <div role="tabpanel" id={mode === "upload" ? "tabpanel-upload" : "tabpanel-paste"} aria-labelledby={mode === "upload" ? "tab-upload" : "tab-paste"}>
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
              accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,image/png,image/jpeg,image/webp"
              className="hidden"
              id="file-upload"
              aria-label="Upload or photograph a legal document"
              onChange={handleFileChange}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer space-y-2 block"
            >
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
                    PDF · photo/scan of a contract · plain text &middot; Max 10 MB
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
            <span aria-hidden="true" className="shrink-0">&#x26A0;&#xFE0F;</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (mode === "upload" ? !selectedFile : !pastedText.trim())}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

      <ProofStrip />

      <AccessBand />

      <ShowcaseSection />
    </div>
  );
}

/** "Access" story band — reinforces the multilingual differentiator with the illustration. */
function AccessBand() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setOk(true);
    img.src = "/images/access.webp";
  }, []);
  return (
    <section
      aria-label="Multilingual access"
      className="rounded-2xl border border-border-custom bg-surface overflow-hidden grid md:grid-cols-2"
    >
      <div className="p-6 flex flex-col justify-center gap-2">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gold">Built for access</p>
        <h2 className="text-2xl font-semibold tracking-tight">Legal clarity in your language</h2>
        <p className="text-sm text-muted leading-relaxed">
          Read the Decision Map and ask questions in{" "}
          <span className="text-foreground font-semibold">7 languages</span> — Hindi, Bengali,
          Tamil, Telugu, Marathi, Spanish, and English. Explanations are translated while the
          cited source quotes stay verbatim, so verification never breaks.
        </p>
      </div>
      {ok && (
        <div className="min-h-[180px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/access.webp" alt="Legal understanding in multiple languages" className="w-full h-full object-cover" />
        </div>
      )}
    </section>
  );
}

const PROOF = [
  {
    label: "Every claim cited",
    sub: "Deterministic validator",
    icon: (
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    label: "7 languages",
    sub: "Hindi, Tamil, Bengali…",
    icon: (
      <path d="M3 5h12M9 3v2m1.5 0c0 4-2.5 8-7 10m2-4c1.5 1.8 4 3.2 6 3.8M14 20l4-9 4 9m-6.5-2h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    label: "Zero documents stored",
    sub: "In-memory, auto-deleted",
    icon: (
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    label: "Grounded in your text",
    sub: "No hallucinated advice",
    icon: (
      <path d="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z M14 3v5h5 M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
];

/** Proof / credibility strip — the "Trust & Authority" section of the landing story. */
function ProofStrip() {
  return (
    <section
      aria-label="Why ClauseCompass is trustworthy"
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {PROOF.map((p) => (
        <div
          key={p.label}
          className="flex flex-col items-center text-center gap-1.5 rounded-xl border border-border-custom bg-surface px-3 py-4"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-gold">
            {p.icon}
          </svg>
          <p className="text-sm font-semibold leading-tight">{p.label}</p>
          <p className="text-xs text-faint leading-tight">{p.sub}</p>
        </div>
      ))}
    </section>
  );
}

/** Renders a product screenshot only once the file actually loads — no broken-image box before assets are added. */
function ShowcaseImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setOk(true);
    img.src = src;
  }, [src]);
  if (!ok) return null;
  return (
    <figure className="rounded-2xl overflow-hidden border border-border-custom shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full h-auto block" />
      {caption && (
        <figcaption className="text-xs text-muted text-center py-2 bg-surface-alt">{caption}</figcaption>
      )}
    </figure>
  );
}

const SHOWCASE = [
  { src: "/images/analysis.webp", alt: "Decision Map with categorized clauses and risk badges", caption: "Decision Map by category" },
  { src: "/images/citations.webp", alt: "Every claim linked to its verified source excerpt", caption: "Verified source citations" },
  { src: "/images/compare.webp", alt: "Two-document comparison showing added, removed, and changed clauses", caption: "Two-version comparison" },
];

/** Only renders if at least one showcase image is present, so the section is invisible until assets are added. */
function ShowcaseSection() {
  const [anyLoaded, setAnyLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    SHOWCASE.forEach((s) => {
      const img = new window.Image();
      img.onload = () => alive && setAnyLoaded(true);
      img.src = s.src;
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!anyLoaded) return null;
  return (
    <section className="space-y-4 pt-2" aria-label="Product screenshots">
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gold">See it in action</p>
        <h2 className="text-2xl font-semibold tracking-tight">From dense legalese to clear answers</h2>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {SHOWCASE.map((s) => (
          <ShowcaseImage key={s.src} {...s} />
        ))}
      </div>
    </section>
  );
}
