"use client";

import { useEffect, useState, useRef, use, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import type { ValidatedDecisionMap, ValidatedClaim, SourceSpan } from "@/lib/schemas";
import { SUPPORTED_LANGUAGES } from "@/lib/schemas";
import { riskScore } from "@/lib/risk";

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; accent: string; bg: string; border: string; text: string; headerBg: string }> = {
  obligation: { label: "Obligations", icon: <><rect x="8" y="3" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" /><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>, accent: "border-l-orange-500", bg: "bg-orange-50/60 dark:bg-orange-950/10", border: "border-orange-200/60 dark:border-orange-800/40", text: "text-orange-700 dark:text-orange-300", headerBg: "bg-orange-100 dark:bg-orange-950/30" },
  right: { label: "Rights", icon: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>, accent: "border-l-emerald-500", bg: "bg-emerald-50/60 dark:bg-emerald-950/10", border: "border-emerald-200/60 dark:border-emerald-800/40", text: "text-emerald-700 dark:text-emerald-300", headerBg: "bg-emerald-100 dark:bg-emerald-950/30" },
  key_date: { label: "Key Dates", icon: <><rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>, accent: "border-l-purple-500", bg: "bg-purple-50/60 dark:bg-purple-950/10", border: "border-purple-200/60 dark:border-purple-800/40", text: "text-purple-700 dark:text-purple-300", headerBg: "bg-purple-100 dark:bg-purple-950/30" },
  payment: { label: "Payments", icon: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 7v10M9.5 10a2.5 2.5 0 012.5-2c1.4 0 2 .8 2 1.6 0 2-4 1.4-4 3 0 1 .8 1.6 2 1.6a2.5 2.5 0 002.5-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>, accent: "border-l-blue-500", bg: "bg-blue-50/60 dark:bg-blue-950/10", border: "border-blue-200/60 dark:border-blue-800/40", text: "text-blue-700 dark:text-blue-300", headerBg: "bg-blue-100 dark:bg-blue-950/30" },
  termination: { label: "Termination", icon: <><path d="M14 4h3a1 1 0 011 1v14a1 1 0 01-1 1h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 8l-4 4 4 4M6 12h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>, accent: "border-l-red-500", bg: "bg-red-50/60 dark:bg-red-950/10", border: "border-red-200/60 dark:border-red-800/40", text: "text-red-700 dark:text-red-300", headerBg: "bg-red-100 dark:bg-red-950/30" },
  risk_flag: { label: "Risk Flags", icon: <><path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></>, accent: "border-l-amber-500", bg: "bg-amber-50/60 dark:bg-amber-950/10", border: "border-amber-200/60 dark:border-amber-800/40", text: "text-amber-700 dark:text-amber-300", headerBg: "bg-amber-100 dark:bg-amber-950/30" },
};

const SEVERITY_STYLE: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  high: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "High", dot: "bg-red-500" },
  medium: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Medium", dot: "bg-amber-500" },
  low: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", label: "Low", dot: "bg-emerald-500" },
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
  "What are my main obligations?",
  "What if I terminate early?",
  "Any hidden fees or penalties?",
  "Key deadlines to know?",
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
      const MAX_RETRIES = 2;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ docId: id, language }),
          });
          if (cancelled) return;
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (attempt < MAX_RETRIES && (res.status >= 500 || res.status === 429)) {
              await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
              continue;
            }
            setError(data.error ?? "Analysis failed");
            return;
          }
          setMap(await res.json());
          return;
        } catch {
          if (cancelled) return;
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          setError("Network error. Please check your connection and try again.");
        }
      }
    }
    analyze().finally(() => {
      if (!cancelled) setLoading(false);
    });
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

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-8" aria-busy="true">
        <div className="relative w-20 h-20">
          <svg className="animate-spin w-20 h-20" viewBox="0 0 80 80" fill="none" role="status">
            <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="4" className="text-border-custom" />
            <path d="M40 6a34 34 0 0134 34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-accent" />
            <span className="sr-only">Analyzing document…</span>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-accent">
              <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12 7l2.2 5L12 17l-2.2-5L12 7z" fill="currentColor" />
            </svg>
          </div>
        </div>
        <div className="text-center space-y-4 max-w-sm">
          <p className="font-serif text-xl font-semibold">Analyzing your document</p>
          <div className="space-y-2.5">
            {PROGRESS_STEPS.map((step, i) => (
              <div
                key={step}
                className={`flex items-center gap-2.5 text-sm transition-all duration-500 ${
                  i <= progressStep ? "opacity-100" : "opacity-0 translate-y-1"
                }`}
              >
                {i < progressStep ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-emerald-500 shrink-0"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M8 12l2.5 2.5L16 9.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : i === progressStep ? (
                  <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-border-custom shrink-0" />
                )}
                <span className={i === progressStep ? "text-foreground font-medium" : i < progressStep ? "text-muted" : "text-faint"}>
                  {step}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-faint mt-4">Typically 15–30 seconds</p>
        </div>
      </div>
    );
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="text-center py-20 space-y-5 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-amber-600 dark:text-amber-400">
            <path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-red-600 dark:text-red-400 font-medium text-lg" role="alert">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={retryAnalysis} className="accent-cta px-6 py-2.5 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 cursor-pointer">
            Try again
          </button>
          <button onClick={() => router.push("/")} className="text-muted hover:text-foreground hover:underline text-sm cursor-pointer">
            Upload different document
          </button>
        </div>
      </div>
    );
  }

  if (!map || !derived) return null;

  const { grouped, highRisk, totalClauses, verifiedCount, unverifiedCount, risk } = derived;

  const RISK_COLORS = {
    high: { stroke: "#dc2626", text: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20", label: "High Risk" },
    medium: { stroke: "#d97706", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20", label: "Medium Risk" },
    low: { stroke: "#059669", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20", label: "Low Risk" },
  }[risk.level];

  // SVG ring gauge values
  const GAUGE_R = 42;
  const GAUGE_C = 2 * Math.PI * GAUGE_R;
  const gaugeOffset = GAUGE_C - (risk.score / 10) * GAUGE_C;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0 flex-1" lang={LANG_CODE[language] ?? "en"}>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{map.title}</h1>
          <p className="text-muted text-sm sm:text-base leading-relaxed">{map.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="lang-select" className="sr-only">Output language</label>
          <select
            id="lang-select"
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
            className="text-sm border border-border-custom rounded-lg px-3 py-1.5 bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            title="Read this analysis in your language"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 cursor-pointer"
            aria-label="Delete document and return to upload"
          >
            Delete
          </button>
        </div>
      </div>

      {/* ─── Risk + Stats Banner ─── */}
      <div className="bg-surface border border-border-custom rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-6 p-5 sm:p-6">
          {/* Risk Gauge */}
          <div className="flex flex-col items-center gap-2 shrink-0" role="status" aria-label={`Overall risk score ${risk.score} out of 10, ${RISK_COLORS.label}`}>
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r={GAUGE_R} fill="none" stroke="currentColor" strokeWidth="6" className="text-border-custom" />
                <circle
                  cx="50" cy="50" r={GAUGE_R} fill="none"
                  stroke={RISK_COLORS.stroke}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={GAUGE_C}
                  strokeDashoffset={gaugeOffset}
                  style={{ "--gauge-circumference": GAUGE_C, animation: "gauge-fill 1s ease-out" } as React.CSSProperties}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold font-serif ${RISK_COLORS.text}`}>{risk.score}</span>
                <span className="text-[10px] text-muted font-medium uppercase tracking-wider">/ 10</span>
              </div>
            </div>
            <span className={`text-xs font-semibold px-3 py-0.5 rounded-full ${RISK_COLORS.bg} ${RISK_COLORS.text}`}>
              {RISK_COLORS.label}
            </span>
          </div>

          {/* Stat Cards */}
          <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Clauses Found"
              value={totalClauses}
              icon={<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 12h6M9 16h4M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
              color="text-blue-600 dark:text-blue-400"
              iconBg="bg-blue-100 dark:bg-blue-900/30"
            />
            <StatCard
              label="Categories"
              value={grouped.length}
              icon={<path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
              color="text-purple-600 dark:text-purple-400"
              iconBg="bg-purple-100 dark:bg-purple-900/30"
            />
            <StatCard
              label="Verified"
              value={verifiedCount}
              icon={<><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>}
              color="text-emerald-600 dark:text-emerald-400"
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            />
            {highRisk > 0 ? (
              <StatCard
                label="High Risk"
                value={highRisk}
                icon={<path d="M12 4l9 16H3l9-16zM12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                color="text-red-600 dark:text-red-400"
                iconBg="bg-red-100 dark:bg-red-900/30"
              />
            ) : (
              <StatCard
                label="Unverified"
                value={unverifiedCount}
                icon={<path d="M12 4l9 16H3l9-16zM12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                color="text-amber-600 dark:text-amber-400"
                iconBg="bg-amber-100 dark:bg-amber-900/30"
              />
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6" lang={LANG_CODE[language] ?? "en"}>
          <h2 className="text-xl font-bold font-serif tracking-tight flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-accent">
              <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12 7l2.2 5L12 17l-2.2-5L12 7z" fill="currentColor" />
            </svg>
            Decision Map
          </h2>

          {grouped.map((group) => (
            <section key={group.category} aria-labelledby={`heading-${group.category}`} className="space-y-3">
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg ${group.headerBg}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={group.text}>{group.icon}</svg>
                <h3
                  id={`heading-${group.category}`}
                  className={`font-semibold text-sm ${group.text}`}
                >
                  {group.label}
                </h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${group.bg} ${group.text}`}>
                  {group.claims.length}
                </span>
              </div>
              <div className="space-y-2 pl-1">
                {group.claims.map((claim) => (
                  <ClaimCard
                    key={`${claim.category}-${claim.text.slice(0, 40)}`}
                    claim={claim}
                    accent={group.accent}
                    onSelectSpan={handleSelectSpan}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* ─── Lawyer Questions ─── */}
          <section aria-labelledby="lawyer-heading" className="bg-surface border border-border-custom rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-200/60 dark:border-indigo-800/40">
              <h3 id="lawyer-heading" className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-2 text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 3l5 5-9.5 9.5-5.5 1.5 1.5-5.5L16 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                Questions to Ask Your Lawyer
              </h3>
              <button
                onClick={handleCopyQuestions}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 border border-indigo-300 dark:border-indigo-700 rounded-md px-3 py-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
              >
                {copied ? "Copied!" : "Copy all"}
              </button>
            </div>
            <div className="p-4 space-y-2">
              {map.questionsForLawyer.map((q, i) => (
                <div key={q} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-alt transition-colors group">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-foreground">{q}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ─── Sidebar ─── */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Source Panel */}
          <div ref={sourceRef}>
            {selectedSpan ? (
              <div className="bg-surface border-2 border-blue-300 dark:border-blue-700 rounded-2xl p-5 shadow-md" aria-live="polite">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-blue-600 dark:text-blue-400"><path d="M4 5a2 2 0 012-2h5v16H6a2 2 0 00-2 2V5zM20 5a2 2 0 00-2-2h-5v16h5a2 2 0 012 2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    </div>
                    Source &middot; Page {selectedSpan.page}
                  </h3>
                  <button
                    onClick={() => setSelectedSpan(null)}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-faint hover:text-foreground hover:bg-surface-alt transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    aria-label="Close source panel"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                </div>
                <blockquote className="border-l-4 border-blue-400 pl-3 py-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-r-lg text-sm italic text-muted leading-relaxed">
                  &ldquo;{selectedSpan.quote}&rdquo;
                </blockquote>
                <p className="text-xs text-faint mt-2.5 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Verified from document &middot; Characters {selectedSpan.start}–{selectedSpan.end}
                </p>
              </div>
            ) : (
              <div className="bg-surface-alt border border-dashed border-border-custom rounded-2xl p-6 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mx-auto text-faint mb-2">
                  <path d="M4 5a2 2 0 012-2h5v16H6a2 2 0 00-2 2V5zM20 5a2 2 0 00-2-2h-5v16h5a2 2 0 012 2V5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                <p className="text-sm text-faint">Click a citation chip to see the exact source text</p>
              </div>
            )}
          </div>

          {/* Q&A Section */}
          <div className="bg-surface border border-border-custom rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border-custom bg-surface-alt">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-accent">
                  <path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H9l-4 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                Ask About This Document
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {!answer && !asking && (
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_QUESTIONS.map((sq) => (
                    <button
                      key={sq}
                      onClick={() => handleAsk(sq)}
                      className="text-xs bg-surface-alt text-foreground border border-border-custom rounded-full px-3 py-1.5 hover:border-accent hover:text-accent transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                  className="accent-cta px-4 py-1.5 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {asking ? "Thinking…" : "Ask"}
                </button>
              </div>
              {answer && (
                <div
                  ref={answerRef}
                  lang={LANG_CODE[language] ?? "en"}
                  className="bg-surface-alt border border-border-custom rounded-lg p-3.5 text-sm max-h-80 overflow-y-auto leading-relaxed"
                  aria-live="polite"
                >
                  <FormattedAnswer text={answer} />
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Render inline **bold** and [Quote: "..."] from the model's markdown-ish answer (React escapes all text — no XSS).
function renderInline(s: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[Quote:\s*"([^"]*)"\]/g;
  let last = 0;
  let k = 0;
  for (let m = re.exec(s); m !== null; m = re.exec(s)) {
    if (m.index > last) nodes.push(s.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<strong key={k++}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      nodes.push(
        <span key={k++} className="italic text-muted">&ldquo;{m[2]}&rdquo;</span>
      );
    }
    last = re.lastIndex;
  }
  if (last < s.length) nodes.push(s.slice(last));
  return nodes;
}

function FormattedAnswer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((raw, i) => {
        const t = raw.trim();
        if (!t) return null;
        if (t === "---") return <hr key={i} className="border-border-custom my-1" />;
        if (t.startsWith("### ")) return <p key={i} className="font-semibold mt-2">{renderInline(t.slice(4))}</p>;
        if (t.startsWith("## ")) return <p key={i} className="font-semibold mt-2">{renderInline(t.slice(3))}</p>;
        if (t.startsWith("# ")) return <p key={i} className="font-semibold mt-2">{renderInline(t.slice(2))}</p>;
        if (t.startsWith("* ") || t.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-accent shrink-0" aria-hidden="true">&bull;</span>
              <span>{renderInline(t.slice(2))}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(t)}</p>;
      })}
    </div>
  );
}

// @perf-audit: memoized so Q&A stream ticks don't re-render the stat tiles
const StatCard = memo(function StatCard({ label, value, color, icon, iconBg }: { label: string; value: number; color: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="bg-surface-alt rounded-xl p-3.5 flex flex-col gap-2">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={color}>{icon}</svg>
      </div>
      <div>
        <div className={`text-2xl font-bold font-serif ${color}`}>{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
});

// @perf-audit: memoized so streaming Q&A state changes don't re-render every clause card
const ClaimCard = memo(function ClaimCard({
  claim,
  accent,
  onSelectSpan,
}: {
  claim: ValidatedClaim;
  accent: string;
  onSelectSpan: (span: SourceSpan) => void;
}) {
  const severity = claim.severity ? SEVERITY_STYLE[claim.severity] : null;

  return (
    <div className={`border-l-4 ${accent} bg-surface border border-border-custom rounded-r-xl p-4 hover:shadow-sm transition-shadow`}>
      <div className="flex items-start gap-2">
        <p className="text-sm flex-1 leading-relaxed">{claim.text}</p>
        {severity && (
          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${severity.bg} ${severity.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${severity.dot}`} aria-hidden="true" />
            {severity.label}
          </span>
        )}
      </div>
      {(claim.sourceSpans.length > 0 || claim.unverifiedQuotes.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border-custom">
          {claim.sourceSpans.map((span) => (
            <button
              key={span.id}
              onClick={() => onSelectSpan(span)}
              className="inline-flex items-center gap-1.5 text-xs bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-md px-2.5 py-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`View source: page ${span.page}`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5a2 2 0 012-2h5v16H6a2 2 0 00-2 2V5zM20 5a2 2 0 00-2-2h-5v16h5a2 2 0 012 2V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              p.{span.page}
            </button>
          ))}
          {claim.unverifiedQuotes.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-faint italic" title="These quotes could not be exactly matched to the document text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              {claim.unverifiedQuotes.length} unverified
            </span>
          )}
        </div>
      )}
    </div>
  );
});
