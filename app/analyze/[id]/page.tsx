"use client";

import { useEffect, useState, useRef, use, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import type { ValidatedDecisionMap, ValidatedClaim, SourceSpan } from "@/lib/schemas";
import { SUPPORTED_LANGUAGES } from "@/lib/schemas";
import { riskScore } from "@/lib/risk";

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; bg: string; border: string; text: string }> = {
  obligation: { label: "Obligations", icon: <><rect x="8" y="3" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" /><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>, bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800", text: "text-orange-800 dark:text-orange-300" },
  right: { label: "Rights", icon: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>, bg: "bg-green-50 dark:bg-green-950/20", border: "border-green-200 dark:border-green-800", text: "text-green-800 dark:text-green-300" },
  key_date: { label: "Key Dates", icon: <><rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>, bg: "bg-purple-50 dark:bg-purple-950/20", border: "border-purple-200 dark:border-purple-800", text: "text-purple-800 dark:text-purple-300" },
  payment: { label: "Payments", icon: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 7v10M9.5 10a2.5 2.5 0 012.5-2c1.4 0 2 .8 2 1.6 0 2-4 1.4-4 3 0 1 .8 1.6 2 1.6a2.5 2.5 0 002.5-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>, bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-800 dark:text-blue-300" },
  termination: { label: "Termination", icon: <><path d="M14 4h3a1 1 0 011 1v14a1 1 0 01-1 1h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 8l-4 4 4 4M6 12h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>, bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-800", text: "text-red-800 dark:text-red-300" },
  risk_flag: { label: "Risk Flags", icon: <><path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></>, bg: "bg-yellow-50 dark:bg-yellow-950/20", border: "border-yellow-200 dark:border-yellow-800", text: "text-yellow-800 dark:text-yellow-300" },
};

const SEVERITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "High Risk" },
  medium: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Medium" },
  low: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", label: "Low" },
};

// BCP-47 codes so screen readers pronounce translated output correctly (WCAG 3.1.2 Language of Parts).
const LANG_CODE: Record<string, string> = {
  English: "en",
  "हिन्दी (Hindi)": "hi",
  "বাংলা (Bengali)": "bn",
  "தமிழ் (Tamil)": "ta",
  "తెలుగు (Telugu)": "te",
  "मराठी (Marathi)": "mr",
  "Español (Spanish)": "es",
};

const SUGGESTED_QUESTIONS = [
  "What are my main obligations under this document?",
  "What happens if I want to terminate early?",
  "Are there any hidden fees or penalties?",
  "What are the key deadlines I need to know?",
];

const PROGRESS_STEPS = [
  "Extracting text from document…",
  "Identifying clauses and obligations…",
  "Assessing risk levels…",
  "Validating citations against source…",
  "Generating lawyer questions…",
];

// @perf-audit: reads a stream and flushes to state at most every 50ms; module scope keeps Date.now() out of the component's purity scope
async function readThrottled(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let lastFlush = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    const now = Date.now();
    if (now - lastFlush > 50) {
      lastFlush = now;
      onChunk(accumulated);
    }
  }
  onChunk(accumulated);
}

export default function AnalyzePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [map, setMap] = useState<ValidatedDecisionMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSpan, setSelectedSpan] = useState<SourceSpan | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [language, setLanguage] = useState<string>("English");
  const [retryNonce, setRetryNonce] = useState(0);
  const answerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const askAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setProgressStep((prev) => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 4000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    async function analyze() {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId: id, language }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Analysis failed");
          return;
        }
        setMap(await res.json());
      } catch {
        if (!cancelled) setError("Network error. Please check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    analyze();
    return () => {
      cancelled = true;
    };
  }, [id, language, retryNonce]);

  function retryAnalysis() {
    setError("");
    setProgressStep(0);
    setMap(null);
    setLoading(true);
    setRetryNonce((n) => n + 1);
  }

  function changeLanguage(next: string) {
    if (next === language) return;
    setError("");
    setProgressStep(0);
    setMap(null);
    setLoading(true);
    setLanguage(next);
  }

  async function handleAsk(q?: string) {
    const text = q ?? question;
    if (!text.trim() || asking) return;
    setQuestion(text);
    setAsking(true);
    setAnswer("");

    // @architecture-audit: cancel any in-flight request so a new question aborts the old Gemini stream
    askAbortRef.current?.abort();
    const controller = new AbortController();
    askAbortRef.current = controller;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: id, question: text, language }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setAnswer("Failed to get an answer. Please try again.");
        setAsking(false);
        return;
      }

      // @perf-audit: throttled reader lives at module scope so a fast token stream doesn't thrash re-renders
      await readThrottled(res.body, setAnswer);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setAnswer("Network error. Please try again.");
      }
    } finally {
      setAsking(false);
    }
  }

  function handleCopyQuestions() {
    if (!map) return;
    navigator.clipboard.writeText(
      map.questionsForLawyer.map((q, i) => `${i + 1}. ${q}`).join("\n")
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    await fetch(`/api/session?docId=${id}`, { method: "DELETE" });
    router.push("/");
  }

  // @perf-audit: stable identity so memoized ClaimCards don't re-render while the Q&A answer streams
  const handleSelectSpan = useCallback((span: SourceSpan) => {
    setSelectedSpan(span);
    sourceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // @perf-audit: derive the Decision-Map view once per analysis, not on every Q&A stream tick
  const derived = useMemo(() => {
    if (!map) return null;
    const grouped = Object.entries(CATEGORY_META)
      .map(([cat, meta]) => ({ ...meta, category: cat, claims: map.claims.filter((c) => c.category === cat) }))
      .filter((g) => g.claims.length > 0);
    return {
      grouped,
      highRisk: map.claims.filter((c) => c.severity === "high").length,
      totalClauses: map.claims.length,
      verifiedCount: map.claims.reduce((acc, c) => acc + c.sourceSpans.length, 0),
      unverifiedCount: map.claims.reduce((acc, c) => acc + c.unverifiedQuotes.length, 0),
      risk: riskScore(map.claims),
    };
  }, [map]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6" aria-busy="true">
        <div className="relative">
          <div className="animate-spin h-12 w-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 rounded-full" role="status">
            <span className="sr-only">Analyzing document…</span>
          </div>
        </div>
        <div className="text-center space-y-3 max-w-sm">
          <p className="font-medium">Analyzing your document</p>
          <div className="space-y-2">
            {PROGRESS_STEPS.map((step, i) => (
              <p
                key={step}
                className={`text-sm transition-opacity duration-500 ${
                  i <= progressStep ? "opacity-100" : "opacity-0"
                } ${i === progressStep ? "text-blue-600 dark:text-blue-400 font-medium" : "text-faint"}`}
              >
                {i < progressStep ? "✓" : i === progressStep ? "›" : " "} {step}
              </p>
            ))}
          </div>
          <p className="text-xs text-faint mt-4">This typically takes 15-30 seconds</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-5">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mx-auto text-amber-500">
          <path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <p className="text-red-600 dark:text-red-400 font-medium" role="alert">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={retryAnalysis} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
            Try again
          </button>
          <button onClick={() => router.push("/")} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            Upload a different document
          </button>
        </div>
      </div>
    );
  }

  if (!map || !derived) return null;

  const { grouped, highRisk, totalClauses, verifiedCount, unverifiedCount, risk } = derived;
  const RISK_STYLE = {
    high: { ring: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800", label: "High Risk" },
    medium: { ring: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", label: "Medium Risk" },
    low: { ring: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", label: "Low Risk" },
  }[risk.level];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1" lang={LANG_CODE[language] ?? "en"}>
          <h1 className="text-2xl font-bold tracking-tight">{map.title}</h1>
          <p className="text-muted">{map.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="lang-select" className="sr-only">Output language</label>
          <select
            id="lang-select"
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
            className="text-sm border border-border-custom rounded-lg px-2 py-1.5 bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Read this analysis in your language"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label="Delete document and return to upload"
          >
            Delete
          </button>
        </div>
      </div>

      <div className={`flex items-center gap-4 border rounded-xl p-4 ${RISK_STYLE.bg}`} role="status" aria-label={`Overall risk score ${risk.score} out of 10, ${RISK_STYLE.label}`}>
        <div className={`flex items-center justify-center w-16 h-16 rounded-full border-4 ${RISK_STYLE.ring} shrink-0`} style={{ borderColor: "currentColor" }}>
          <span className={`text-2xl font-bold ${RISK_STYLE.ring}`}>{risk.score}</span>
        </div>
        <div>
          <p className={`font-semibold ${RISK_STYLE.ring}`}>{RISK_STYLE.label} · {risk.score}/10</p>
          <p className="text-sm text-muted">
            Weighted from {highRisk} high-severity {highRisk === 1 ? "clause" : "clauses"}, risk flags, and citation confidence. Informational only.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Clauses Found" value={totalClauses} />
        <StatCard label="Categories" value={grouped.length} />
        <StatCard label="Citations Verified" value={verifiedCount} color="text-emerald-600 dark:text-emerald-400" />
        {highRisk > 0 && <StatCard label="High Risk Items" value={highRisk} color="text-red-600 dark:text-red-400" />}
        {highRisk === 0 && <StatCard label="Unverified Quotes" value={unverifiedCount} color="text-amber-600 dark:text-amber-400" />}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5" lang={LANG_CODE[language] ?? "en"}>
          <h2 className="text-lg font-semibold">Decision Map</h2>

          {grouped.map((group) => (
            <section key={group.category} aria-labelledby={`heading-${group.category}`} className="space-y-2">
              <h3
                id={`heading-${group.category}`}
                className={`font-medium text-sm uppercase tracking-wide flex items-center gap-1.5 ${group.text}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">{group.icon}</svg> {group.label}
                <span className="text-xs font-normal normal-case text-faint">({group.claims.length})</span>
              </h3>
              <div className="space-y-2">
                {group.claims.map((claim) => (
                  <ClaimCard
                    key={`${claim.category}-${claim.text.slice(0, 40)}`}
                    claim={claim}
                    bg={group.bg}
                    border={group.border}
                    onSelectSpan={handleSelectSpan}
                  />
                ))}
              </div>
            </section>
          ))}

          <section aria-labelledby="lawyer-heading" className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
            <h3 id="lawyer-heading" className="font-semibold text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 3l5 5-9.5 9.5-5.5 1.5 1.5-5.5L16 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg> Questions to Ask Your Lawyer
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-indigo-800 dark:text-indigo-300">
              {map.questionsForLawyer.map((q) => (
                <li key={q} className="leading-relaxed">{q}</li>
              ))}
            </ol>
            <button
              onClick={handleCopyQuestions}
              className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 border border-indigo-300 dark:border-indigo-700 rounded-md px-3 py-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div ref={sourceRef}>
            {selectedSpan ? (
              <div className="bg-surface border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4 shadow-sm" aria-live="polite">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5a2 2 0 012-2h5v16H6a2 2 0 00-2 2V5zM20 5a2 2 0 00-2-2h-5v16h5a2 2 0 012 2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg> Source &middot; Page {selectedSpan.page}
                  </h3>
                  <button
                    onClick={() => setSelectedSpan(null)}
                    className="text-faint hover:text-foreground text-lg leading-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    aria-label="Close source panel"
                  >
                    ×
                  </button>
                </div>
                <blockquote className="border-l-4 border-blue-400 pl-3 py-2 bg-blue-50 dark:bg-blue-950/20 rounded-r text-sm italic text-muted leading-relaxed">
                  &ldquo;{selectedSpan.quote}&rdquo;
                </blockquote>
                <p className="text-xs text-faint mt-2">
                  Exact quote verified from document · Characters {selectedSpan.start}–{selectedSpan.end}
                </p>
              </div>
            ) : (
              <div className="bg-surface-alt border border-dashed border-border-custom rounded-xl p-4 text-center text-sm text-faint">
                Click a citation chip to see the exact source text
              </div>
            )}
          </div>

          <div className="bg-surface border border-border-custom rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H9l-4 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg> Ask About This Document
            </h3>
            <div className="space-y-3">
              {!answer && !asking && (
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_QUESTIONS.map((sq) => (
                    <button
                      key={sq}
                      onClick={() => handleAsk(sq)}
                      className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full px-3 py-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {sq}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                placeholder="What does this document say about…"
                rows={2}
                maxLength={2000}
                className="w-full border border-border-custom rounded-lg p-2.5 text-sm resize-none bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Ask a question about the document"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-faint">{question.length}/2000</span>
                <button
                  onClick={() => handleAsk()}
                  disabled={asking || !question.trim()}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                >
                  {asking ? "Thinking…" : "Ask"}
                </button>
              </div>
              {answer && (
                <div
                  ref={answerRef}
                  lang={LANG_CODE[language] ?? "en"}
                  className="bg-surface-alt border border-border-custom rounded-lg p-3 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed"
                  aria-live="polite"
                >
                  {answer}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-surface border border-border-custom rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold font-serif ${color ?? "text-foreground"}`}>{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}

// @perf-audit: memoized so streaming Q&A state changes don't re-render every clause card
const ClaimCard = memo(function ClaimCard({
  claim,
  bg,
  border,
  onSelectSpan,
}: {
  claim: ValidatedClaim;
  bg: string;
  border: string;
  onSelectSpan: (span: SourceSpan) => void;
}) {
  const severity = claim.severity ? SEVERITY_STYLE[claim.severity] : null;

  return (
    <div className={`border ${border} ${bg} rounded-lg p-3 hover:shadow-sm transition-shadow`}>
      <div className="flex items-start gap-2">
        <p className="text-sm flex-1 leading-relaxed">{claim.text}</p>
        {severity && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${severity.bg} ${severity.text}`}>
            {severity.label}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {claim.sourceSpans.map((span) => (
          <button
            key={span.id}
            onClick={() => onSelectSpan(span)}
            className="text-xs bg-surface/80 border border-border-custom rounded-md px-2 py-0.5 hover:bg-surface hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 inline-flex items-center gap-1 text-gold"
            aria-label={`View source: page ${span.page}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5a2 2 0 012-2h5v16H6a2 2 0 00-2 2V5zM20 5a2 2 0 00-2-2h-5v16h5a2 2 0 012 2V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            <span className="text-foreground">p.{span.page}</span>
          </button>
        ))}
        {claim.unverifiedQuotes.length > 0 && (
          <span className="text-xs text-faint italic inline-flex items-center gap-1" title="These quotes could not be exactly matched to the document text">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            {claim.unverifiedQuotes.length} unverified
          </span>
        )}
      </div>
    </div>
  );
});
