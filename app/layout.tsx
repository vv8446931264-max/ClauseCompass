import type { Metadata } from "next";
import Link from "next/link";
import { EB_Garamond, Lato } from "next/font/google";
import "./globals.css";

// Serif headings signal legal authority; humanist sans keeps body text highly readable.
const heading = EB_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const body = Lato({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://clausecompass-1010587631565.us-central1.run.app"),
  title: "ClauseCompass — Legal Document Navigator",
  description:
    "AI-powered legal document analysis in 7 languages. Understand obligations, rights, key dates, and risks — every claim cited to the exact source text.",
  openGraph: {
    title: "ClauseCompass — Understand what you're about to sign",
    description:
      "Plain-language Decision Map for any contract, with AI-verified citations and multilingual access.",
    images: ["/og.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClauseCompass — Legal Document Navigator",
    description: "AI-verified legal document analysis in 7 languages.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
        >
          Skip to main content
        </a>
        <header className="border-b border-border-custom bg-surface sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-xl font-serif font-semibold text-foreground tracking-tight">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-gold">
                <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 7l2.2 5L12 17l-2.2-5L12 7z" fill="currentColor" />
              </svg>
              <span>Clause<span className="text-gold">Compass</span></span>
            </Link>
            <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-muted hover:text-foreground transition-colors hover:underline">
                Upload
              </Link>
              <Link href="/compare" className="text-muted hover:text-foreground transition-colors hover:underline">
                Compare
              </Link>
            </nav>
          </div>
        </header>

        <div
          role="status"
          className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs text-center py-1.5 px-4"
        >
          This tool provides information only, not legal advice. Consult a
          licensed legal professional for guidance specific to your situation.
        </div>

        <main id="main-content" className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
          {children}
        </main>

        <footer className="border-t border-border-custom bg-surface text-center text-xs text-muted py-4 px-4">
          <p>
            ClauseCompass is an educational tool. It does not provide legal
            advice. Always consult a qualified attorney for legal matters.
          </p>
          <p className="mt-1 text-faint">
            Powered by Google Gemini · Built for Hack2Skill AI Code Submission
          </p>
        </footer>
      </body>
    </html>
  );
}
