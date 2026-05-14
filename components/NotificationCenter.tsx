"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Benachrichtigung {
  id: number;
  typ: string;
  titel: string;
  text: string;
  prioritaet: string; // "info" | "warnung" | "kritisch"
  gelesen: boolean;
  kundeId: number | null;
  artikelId: number | null;
  link: string | null;
  createdAt: string;
}

interface NotifAufgabe { id: number; betreff: string; faelligAm: string | null; kundeId: number | null; typ: string }
interface NotifRechnung { id: number; rechnungNr: string | null; kundeName: string; ueberfaelligTage: number }
interface NotifArtikel { id: number; name: string; aktuellerBestand: number; mindestbestand: number; einheit: string; status: "rot" | "gelb" }
interface LiveNotifs { aufgaben: NotifAufgabe[]; rechnungen: NotifRechnung[]; lagerAlarm: NotifArtikel[] }

function zeitVor(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 2) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tag${d > 1 ? "en" : ""}`;
  return new Date(iso).toLocaleDateString("de-DE");
}

const PRIO_DOT: Record<string, string> = {
  kritisch: "bg-red-500",
  warnung: "bg-amber-400",
  info: "bg-blue-400",
};

const PRIO_BORDER: Record<string, string> = {
  kritisch: "border-l-red-400",
  warnung: "border-l-amber-300",
  info: "border-l-blue-300",
};

const TYP_ICON: Record<string, string> = {
  lagerbestand: "📦",
  sachkunde: "🎓",
  kreditlimit: "💳",
  rechnung_faellig: "📄",
  reklamation: "⚠️",
};

export default function NotificationCenter() {
  const [items, setItems] = useState<Benachrichtigung[]>([]);
  const [live, setLive] = useState<LiveNotifs | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const heute = new Date();
      heute.setHours(23, 59, 59, 999);
      const [alertsRes, aufgabenRes, dashboardRes] = await Promise.all([
        fetch("/api/benachrichtigungen?gelesen=false").then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/aufgaben?status=offen&faelligBis=${heute.toISOString()}`).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/dashboard").then((r) => (r.ok ? r.json() : {})),
      ]);
      setItems(Array.isArray(alertsRes) ? alertsRes : []);
      const aufgaben: NotifAufgabe[] = (Array.isArray(aufgabenRes) ? aufgabenRes : [])
        .slice(0, 5)
        .map((a: Record<string, unknown>) => ({
          id: a.id as number,
          betreff: a.betreff as string,
          faelligAm: a.faelligAm as string | null,
          kundeId: a.kundeId as number | null,
          typ: a.typ as string,
        }));
      const dash = dashboardRes as { faelligeRechnungen?: NotifRechnung[]; lagerKritisch?: NotifArtikel[] };
      const rechnungen: NotifRechnung[] = (dash.faelligeRechnungen ?? []).slice(0, 5);
      const lagerAlarm: NotifArtikel[] = (dash.lagerKritisch ?? []).slice(0, 5);
      setLive({ aufgaben, rechnungen, lagerAlarm });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function markRead(id: number) {
    try {
      await fetch(`/api/benachrichtigungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gelesen: true }),
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    try {
      await fetch("/api/benachrichtigungen/alle-gelesen", { method: "POST" });
      setItems([]);
    } catch {
      // ignore
    }
  }

  function handleItemClick(item: Benachrichtigung) {
    markRead(item.id);
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  const overdueRechnungen = live?.rechnungen.filter((r) => r.ueberfaelligTage > 0) ?? [];
  const criticalLager = live?.lagerAlarm.filter((a) => a.status === "rot") ?? [];
  const aufgaben = live?.aufgaben ?? [];
  const totalCount =
    items.length + aufgaben.length + overdueRechnungen.length + criticalLager.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded hover:bg-green-700 transition-colors text-white"
        aria-label="Benachrichtigungen"
        title="Benachrichtigungen"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-gray-100 w-80 max-h-[32rem] overflow-y-auto z-[90]">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-800">Benachrichtigungen</h3>
              {totalCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                  {totalCount}
                </span>
              )}
            </div>
            {items.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-green-700 hover:text-green-800 hover:underline"
              >
                Alle gelesen
              </button>
            )}
          </div>

          {loading && totalCount === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Wird geladen…</p>
          )}
          {!loading && totalCount === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Keine Benachrichtigungen</p>
          )}

          {aufgaben.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs font-semibold text-orange-700 uppercase tracking-wide bg-orange-50 border-b border-orange-100">
                Fällige Aufgaben ({aufgaben.length})
              </div>
              {aufgaben.map((a) => {
                const isOverdue = a.faelligAm && new Date(a.faelligAm) < new Date();
                return (
                  <Link
                    key={a.id}
                    href={`/aufgaben/${a.id}`}
                    onClick={() => setOpen(false)}
                    className="flex flex-col px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-800 leading-tight">{a.betreff}</span>
                    <span className={`text-xs mt-0.5 ${isOverdue ? "text-red-600" : "text-orange-600"}`}>
                      {isOverdue ? "Überfällig" : "Heute fällig"}
                      {a.faelligAm && ` · ${new Date(a.faelligAm).toLocaleDateString("de-DE")}`}
                    </span>
                  </Link>
                );
              })}
            </section>
          )}

          {overdueRechnungen.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs font-semibold text-red-700 uppercase tracking-wide bg-red-50 border-b border-red-100">
                Überfällige Rechnungen ({overdueRechnungen.length})
              </div>
              {overdueRechnungen.map((r) => (
                <Link
                  key={r.id}
                  href={`/lieferungen/${r.id}`}
                  onClick={() => setOpen(false)}
                  className="flex flex-col px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm font-medium text-gray-800 leading-tight">{r.kundeName}</span>
                  <span className="text-xs text-red-600 mt-0.5">
                    {r.rechnungNr && `${r.rechnungNr} · `}{r.ueberfaelligTage} Tage überfällig
                  </span>
                </Link>
              ))}
            </section>
          )}

          {criticalLager.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs font-semibold text-red-700 uppercase tracking-wide bg-red-50 border-b border-red-100">
                Lagerbestand kritisch ({criticalLager.length})
              </div>
              {criticalLager.map((a) => (
                <Link
                  key={a.id}
                  href={`/artikel/${a.id}`}
                  onClick={() => setOpen(false)}
                  className="flex flex-col px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm font-medium text-gray-800 leading-tight">{a.name}</span>
                  <span className="text-xs text-red-600 mt-0.5">
                    Bestand: {a.aktuellerBestand} {a.einheit} (Min: {a.mindestbestand})
                  </span>
                </Link>
              ))}
            </section>
          )}

          {items.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wide bg-amber-50 border-b border-amber-100">
                System-Alerts ({items.length})
              </div>
              {items.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-left flex gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors border-l-2 ${
                    PRIO_BORDER[item.prioritaet] ?? "border-l-gray-200"
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5 flex items-start gap-1.5">
                    <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${PRIO_DOT[item.prioritaet] ?? "bg-gray-400"}`} />
                    <span className="text-base leading-none">{TYP_ICON[item.typ] ?? "🔔"}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate leading-tight">{item.titel}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{item.text}</p>
                    <p className="text-xs text-gray-400 mt-1">{zeitVor(item.createdAt)}</p>
                  </div>
                </button>
              ))}
              {items.length > 10 && (
                <p className="px-3 py-1.5 text-xs text-gray-400 text-center">+{items.length - 10} weitere</p>
              )}
            </section>
          )}

          <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between sticky bottom-0 bg-white">
            <Link
              href="/aufgaben"
              onClick={() => setOpen(false)}
              className="text-xs text-green-700 hover:text-green-800 hover:underline"
            >
              Alle Aufgaben anzeigen →
            </Link>
            <Link
              href="/einstellungen/benachrichtigungen"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
            >
              Einstellungen
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
