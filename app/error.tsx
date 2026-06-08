"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    const id = Sentry.captureException(error, {
      extra: { digest: error.digest },
    });
    setEventId(id);
  }, [error]);

  const refCode = error.digest ?? eventId ?? null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-800">Ein Fehler ist aufgetreten</h2>
      <p className="text-gray-500 text-sm max-w-sm">
        Der Fehler wurde automatisch gemeldet. Bitte versuche es erneut oder lade die Seite neu.
      </p>
      {refCode && (
        <p className="text-xs text-gray-400 font-mono bg-gray-100 px-3 py-1 rounded">
          Referenz: {refCode}
        </p>
      )}
      {process.env.NODE_ENV === "development" && (
        <details className="text-left max-w-lg w-full">
          <summary className="text-xs text-gray-400 cursor-pointer">Fehlerdetails (nur Dev)</summary>
          <pre className="text-xs text-red-700 bg-red-50 p-3 rounded mt-2 overflow-auto whitespace-pre-wrap">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        </details>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-green-700 text-white rounded-md text-sm hover:bg-green-800 transition-colors"
        >
          Erneut versuchen
        </button>
        <button
          onClick={() => window.location.href = "/"}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
        >
          Zur Startseite
        </button>
      </div>
    </div>
  );
}
