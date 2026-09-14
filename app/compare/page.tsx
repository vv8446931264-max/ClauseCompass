import { CompareForm } from "../compare-form";

// Server component: the heading renders as static HTML; only <CompareForm /> hydrates.
export default function ComparePage() {
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

      <CompareForm />
    </div>
  );
}
