"use client";
import { useEffect, useState, useCallback } from "react";
import { registriereDialogHost, type DialogAnfrage } from "@/lib/dialog";

export default function DialogHost() {
  const [queue, setQueue] = useState<DialogAnfrage[]>([]);

  useEffect(() => registriereDialogHost((a) => setQueue((q) => [...q, a])), []);

  const aktuell = queue[0];
  const schliessen = useCallback(
    (ok: boolean) => {
      if (!aktuell) return;
      aktuell.resolve(ok);
      setQueue((q) => q.slice(1));
    },
    [aktuell],
  );

  useEffect(() => {
    if (!aktuell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliessen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aktuell, schliessen]);

  if (!aktuell) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="alertdialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
        <p className="text-sm text-gray-800 whitespace-pre-line">{aktuell.text}</p>
        <div className="mt-5 flex justify-end gap-2">
          {aktuell.art === "confirm" && (
            <button onClick={() => schliessen(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Abbrechen
            </button>
          )}
          <button autoFocus onClick={() => schliessen(true)} className="px-4 py-2 text-sm rounded-lg bg-green-700 hover:bg-green-800 text-white">
            {aktuell.art === "confirm" ? "OK" : "Verstanden"}
          </button>
        </div>
      </div>
    </div>
  );
}
