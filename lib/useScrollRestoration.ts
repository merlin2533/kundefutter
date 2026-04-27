"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Stellt die Scroll-Position einer Listenseite nach dem Browser-Back wieder her.
 *
 *  Während der Nutzer scrollt, wird die Y-Position pro Pfad in der
 *  sessionStorage abgelegt. Sobald `ready=true` gesetzt wird (z.B. nachdem
 *  die Daten geladen sind und die Tabelle gerendert wurde), wird die
 *  letzte gespeicherte Position für diesen Pfad wiederhergestellt.
 *
 *  Verwendung:
 *  ```tsx
 *  useScrollRestoration(!loading && kunden.length > 0);
 *  ```
 */
export function useScrollRestoration(ready: boolean) {
  const pathname = usePathname();
  const restored = useRef(false);

  // Position fortlaufend speichern (gedrosselt via requestAnimationFrame)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const handler = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        try {
          sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
        } catch {
          /* sessionStorage kann disabled sein */
        }
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  // Position einmalig nach Datenladen wiederherstellen
  useEffect(() => {
    if (!ready || restored.current || typeof window === "undefined") return;
    restored.current = true;
    try {
      const saved = sessionStorage.getItem(`scroll:${pathname}`);
      if (saved) {
        const y = parseInt(saved, 10);
        if (Number.isFinite(y) && y > 0) {
          window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
        }
      }
    } catch {
      /* ignore */
    }
  }, [ready, pathname]);
}
