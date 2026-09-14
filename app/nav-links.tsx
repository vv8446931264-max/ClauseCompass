"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Upload" },
  { href: "/compare", label: "Compare" },
];

/** Header navigation with aria-current on the active route (a11y: nav-state-active). */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm">
      {LINKS.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`transition-colors hover:underline rounded ${
              active ? "text-foreground font-semibold underline decoration-gold underline-offset-4" : "text-muted hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
