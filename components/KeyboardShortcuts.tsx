"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS: { keys: string; label: string; description: string }[] = [
  { keys: "G D", label: "Dashboard", description: "Zum Dashboard navigieren" },
  { keys: "G K", label: "Kunden", description: "Zur Kundenliste navigieren" },
  { keys: "G A", label: "Artikel", description: "Zum Artikelstamm navigieren" },
  { keys: "G L", label: "Lieferungen", description: "Zur Lieferungsübersicht navigieren" },
  { keys: "N A", label: "Neue Aktivität", description: "Neue CRM-Aktivität erfassen" },
  { keys: "N L", label: "Neue Lieferung", description: "Neue Lieferung anlegen" },
  { keys: "N K", label: "Neuer Kunde", description: "Neuen Kunden anlegen" },
  { keys: "N G", label: "Neues Angebot", description: "Neues Angebot erstellen" },
  { keys: "?", label: "Hilfe", description: "Diese Übersicht anzeigen" },
];

const NAV_MAP: Record<string, Record<string, string>> = {
  g: {
    d: "/",
    k: "/kunden",
    a: "/artikel",
    l: "/lieferungen",
  },
  n: {
    a: "/kunden/aktivitaet",
    l: "/lieferungen/neu",
    k: "/kunden/neu",
    g: "/angebote/neu",
  },
};

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [firstKey, setFirstKey] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const resetRef = { current: null as ReturnType<typeof setTimeout> | null };

  const reset = useCallback(() => {
    setFirstKey(null);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs or with modifier keys (except shift for ?)
      if (isInputFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // "?" opens help
      if (e.key === "?") {
        e.preventDefault();
        setShowHelp((v) => !v);
        setFirstKey(null);
        return;
      }

      // Escape closes help
      if (e.key === "Escape") {
        setShowHelp(false);
        setFirstKey(null);
        return;
      }

      // Two-key sequences: g and n
      if (!firstKey) {
        if (key === "g" || key === "n") {
          e.preventDefault();
          setFirstKey(key);
          // Auto-reset after 1.5s if no second key pressed
          if (resetRef.current) clearTimeout(resetRef.current);
          resetRef.current = setTimeout(reset, 1500);
        }
        return;
      }

      // We have a firstKey — handle second key
      e.preventDefault();
      if (resetRef.current) clearTimeout(resetRef.current);

      const route = NAV_MAP[firstKey]?.[key];
      if (route) {
        router.push(route);
      }
      setFirstKey(null);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [firstKey, router, reset]);

  if (!showHelp) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setShowHelp(false);
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-lg">Tastaturkürzel</h2>
          <button
            onClick={() => setShowHelp(false)}
            className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            aria-label="Schließen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Kürzel</th>
                <th className="text-left pb-2 font-medium">Aktion</th>
                <th className="text-left pb-2 font-medium hidden sm:table-cell">Beschreibung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {SHORTCUTS.map((s) => (
                <tr key={s.keys}>
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center gap-1">
                      {s.keys.split(" ").map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-gray-300 text-xs">then</span>}
                          <kbd className="px-2 py-0.5 text-xs font-mono font-medium bg-gray-100 border border-gray-200 rounded shadow-sm text-gray-700">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-medium text-gray-800">{s.label}</td>
                  <td className="py-2 text-gray-500 hidden sm:table-cell">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
            Kürzel sind inaktiv wenn ein Eingabefeld fokussiert ist. Drücke <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded">Esc</kbd> zum Schließen.
          </p>
        </div>
      </div>
    </div>
  );
}
