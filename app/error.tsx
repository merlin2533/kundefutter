"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
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
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <h2 className="text-lg font-semibold text-gray-800">Ein Fehler ist aufgetreten</h2>
      <p className="text-gray-500 text-sm">Der Fehler wurde automatisch gemeldet.</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-green-700 text-white rounded-md text-sm hover:bg-green-800"
      >
        Erneut versuchen
      </button>
    </div>
  );
}
