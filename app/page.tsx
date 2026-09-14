import Image from "next/image";
import { UploadForm } from "./upload-form";

// Server component: the hero, headline, and marketing sections ship as static HTML with
// zero client JS — only <UploadForm /> hydrates. (Minimizing client components = the
// core Next.js efficiency pattern.)
export default function UploadPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <figure className="rounded-2xl overflow-hidden border border-border-custom shadow-sm">
        <Image
          src="/images/hero.webp"
          alt="ClauseCompass — navigate legal documents with AI-verified citations"
          width={1500}
          height={789}
          priority
          sizes="(max-width: 768px) 100vw, 672px"
          className="w-full h-auto block"
        />
      </figure>

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

      <UploadForm />

      <ProofStrip />

      <AccessBand />

      <ShowcaseSection />
    </div>
  );
}

/** "Access" story band — reinforces the multilingual differentiator with the illustration. */
function AccessBand() {
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
      <div className="relative min-h-[200px]">
        <Image
          src="/images/access.webp"
          alt="Legal understanding in multiple languages"
          fill
          loading="lazy"
          sizes="(max-width: 768px) 100vw, 336px"
          className="object-cover"
        />
      </div>
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

const SHOWCASE = [
  { src: "/images/analysis.webp", alt: "Decision Map with categorized clauses and risk badges", caption: "Decision Map by category" },
  { src: "/images/citations.webp", alt: "Every claim linked to its verified source excerpt", caption: "Verified source citations" },
  { src: "/images/compare.webp", alt: "Two-document comparison showing added, removed, and changed clauses", caption: "Two-version comparison" },
];

function ShowcaseSection() {
  return (
    <section className="space-y-4 pt-2" aria-label="Product screenshots">
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gold">See it in action</p>
        <h2 className="text-2xl font-semibold tracking-tight">From dense legalese to clear answers</h2>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {SHOWCASE.map((s) => (
          <figure key={s.src} className="rounded-xl overflow-hidden border border-border-custom shadow-sm">
            {/* @perf-audit: next/image → responsive srcset, modern formats, lazy-load, CLS 0 */}
            <Image
              src={s.src}
              alt={s.alt}
              width={1400}
              height={788}
              loading="lazy"
              sizes="(max-width: 640px) 100vw, 224px"
              className="w-full h-auto block"
            />
            <figcaption className="text-xs text-muted text-center py-2 bg-surface-alt">{s.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
