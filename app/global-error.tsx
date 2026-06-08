"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

export default function GlobalError({
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
      level: "fatal",
    });
    setEventId(id);
  }, [error]);

  const refCode = error.digest ?? eventId ?? null;

  return (
    <html lang="de">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Kritischer Fehler</h2>
          <p className="text-gray-500 mb-4 text-sm">
            Die Anwendung ist auf einen unerwarteten Fehler gestoßen. Der Fehler wurde gemeldet.
          </p>
          {refCode && (
            <p className="text-xs text-gray-400 font-mono bg-gray-100 px-3 py-1 rounded inline-block mb-4">
              Referenz: {refCode}
            </p>
          )}
          {process.env.NODE_ENV === "development" && (
            <details className="text-left mb-4">
              <summary className="text-xs text-gray-400 cursor-pointer">Fehlerdetails (nur Dev)</summary>
              <pre className="text-xs text-red-700 bg-red-50 p-3 rounded mt-2 overflow-auto whitespace-pre-wrap">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ""}
              </pre>
            </details>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-green-700 text-white rounded-md text-sm hover:bg-green-800 transition-colors"
            >
              Erneut versuchen
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
            >
              Zur Startseite
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
