"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Ein Fehler ist aufgetreten</h2>
          <p className="text-gray-500 mb-4 text-sm">Der Fehler wurde automatisch gemeldet.</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-green-700 text-white rounded-md text-sm hover:bg-green-800"
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
