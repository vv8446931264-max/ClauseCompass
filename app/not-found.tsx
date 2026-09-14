import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <h2 className="text-4xl font-bold text-faint">404</h2>
      <p className="text-muted">
        This page doesn&apos;t exist. The document may have expired.
      </p>
      <Link
        href="/"
        className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        Upload a document
      </Link>
    </div>
  );
}
