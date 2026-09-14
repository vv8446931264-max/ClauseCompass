"use client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">Something went wrong</h2>
      <p className="text-muted text-sm max-w-md">
        An unexpected error occurred. Your document data has not been affected.
      </p>
      <button
        onClick={reset}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        Try again
      </button>
      {error.digest && (
        <p className="text-xs text-faint">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
