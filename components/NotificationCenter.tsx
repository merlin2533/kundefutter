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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/benachrichtigungen?gelesen=false");
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
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

  const unreadCount = items.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded hover:bg-green-700 transition-colors text-white"
        aria-label="Benachrichtigungen (System)"
        title="System-Benachrichtigungen"
      >
        {/* Bell with slash to distinguish from NotificationBell */}
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17v1a3 3 0 006 0v-1M15 17H9m6 0a6 6 0 10-12 0m6 0a6 6 0 0012 0" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3v1m0 0a6 6 0 016 6v3.5l1 1.5H5l1-1.5V10A6 6 0 0112 4z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-gray-100 w-80 max-h-96 overflow-y-auto z-[90]">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-800">System-Alerts</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-green-700 hover:text-green-800 hover:underline"
              >
                Alle gelesen
              </button>
            )}
          </div>

          {loading && items.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Wird geladen…</p>
          )}
          {!loading && items.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Keine ungelesenen Benachrichtigungen</p>
          )}

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

          <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
            <Link
              href="/einstellungen/benachrichtigungen"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
            >
              Einstellungen
            </Link>
            {unreadCount > 10 && (
              <span className="text-xs text-gray-400">+{unreadCount - 10} weitere</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
