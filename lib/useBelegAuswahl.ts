"use client";
import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Hält die in einer Beleg-Split-Ansicht ausgewählte Zeile mit der URL (?id=) synchron, statt
 *  in eigenem State — die URL ist die einzige Quelle der Wahrheit (kein Reload-/Bookmark-
 *  Verlust, kein zusätzlicher useEffect/setState-Zyklus nötig). Ist die URL-ID nicht (mehr)
 *  Teil der übergebenen (bereits gefilterten/sortierten) Liste — z.B. nach einem Filterwechsel
 *  oder beim ersten Laden ganz ohne `?id=` —, gilt automatisch die erste Zeile als ausgewählt,
 *  damit die Vorschau nie leer startet. `router.replace` statt `push`, damit der Zurück-Button
 *  nicht durch jede angeklickte Zeile tunnelt. Muss innerhalb einer `<Suspense>`-Boundary
 *  verwendet werden (nutzt `useSearchParams()`).
 */
export function useBelegAuswahl(ids: number[]): [number | null, (id: number) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromUrl = parseInt(searchParams.get("id") ?? "", 10);
  const selected = Number.isFinite(fromUrl) && ids.includes(fromUrl) ? fromUrl : (ids[0] ?? null);

  const select = useCallback((id: number) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("id", String(id));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  return [selected, select];
}
