import { NextRequest } from "next/server";

/**
 * Einfacher In-Memory Rate-Limiter, IP-basiert.
 *
 * Achtung: Der Zustand lebt nur im Prozessspeicher — bei mehreren Instanzen
 * (Multi-Container/Cluster) ist das Limit pro Instanz, nicht global. Für den
 * aktuellen Single-Container-Deployment-Fall ausreichend.
 */

export type RateLimitOptions = {
  /** Max. Anzahl erlaubter Requests innerhalb des Fensters. */
  limit: number;
  /** Fenstergröße in Millisekunden. */
  windowMs: number;
};

type Entry = { count: number; resetAt: number };

/**
 * Erstellt einen eigenständigen Rate-Limiter mit eigenem Zustand.
 * Jeder Aufrufer (z.B. Login, Kontaktformular) sollte eine eigene Instanz
 * halten, damit sich die Limits nicht gegenseitig beeinflussen.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { limit, windowMs } = options;
  const store = new Map<string, Entry>();

  // Verhindert unbegrenztes Wachstum der Map bei vielen unterschiedlichen IPs.
  function cleanup(now: number) {
    if (store.size < 10_000) return;
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }

  return {
    /** Prüft und verbucht einen Versuch. `true` = erlaubt, `false` = Limit erreicht. */
    check(key: string): boolean {
      const now = Date.now();
      cleanup(now);
      const entry = store.get(key);
      if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= limit) return false;
      entry.count++;
      return true;
    },
  };
}

/** Liest die Client-IP aus den üblichen Proxy-Headern (Fallback: "unknown"). */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
