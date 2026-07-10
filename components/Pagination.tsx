"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Optionaler Zusatztext links, z.B. "1–100 von 342" */
  info?: string;
}

/**
 * Wiederverwendbare Pagination-Leiste (Zurück / Seite X von Y / Weiter).
 * Optik angelehnt an app/artikel/page.tsx und app/kunden/page.tsx.
 */
export default function Pagination({ page, totalPages, onPageChange, info }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600 flex-wrap gap-3">
      <span className="text-gray-500">{info}</span>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Zurück
        </button>
        <span className="px-3 py-1.5 bg-green-700 text-white rounded-lg font-medium">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Weiter →
        </button>
      </div>
    </div>
  );
}
