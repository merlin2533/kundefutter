"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { useToast } from "@/components/ToastProvider";

interface BesuchKunde {
  id: number;
  name: string;
  firma: string | null;
  plz: string | null;
  ort: string | null;
  strasse: string | null;
  lat: number | null;
  lng: number | null;
  kontakte?: { wert: string }[];
}

interface Besuchstermin {
  id: number;
  kundeId: number;
  datum: string;
  betreff: string;
  inhalt: string | null;
  kunde: BesuchKunde;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isToday(d: string) {
  const date = new Date(d);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isTomorrow(d: string) {
  const date = new Date(d);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  );
}

function dayLabel(d: string) {
  if (isToday(d)) return "Heute";
  if (isTomorrow(d)) return "Morgen";
  return formatDate(d);
}

function loadBesuchsTermineFilters() {
  try { return JSON.parse(sessionStorage.getItem("besuchstermine-filters") ?? "{}"); } catch { return {}; }
}

export default function BesuchstermineListPage() {
  const { showToast } = useToast();
  const [termine, setTermine] = useState<Besuchstermin[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [search, setSearch] = useState<string>(() => loadBesuchsTermineFilters().search ?? "");
  const [emailState, setEmailState] = useState<Record<number, { offen: boolean; empfaenger: string; loading: boolean; erfolg: string; fehler: string }>>({});

  const fetchTermine = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/besuchstermine");
      const data = await res.json();
      setTermine(Array.isArray(data) ? data : []);
    } catch {
      showToast("Fehler beim Laden der Besuchstermine", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    try { sessionStorage.setItem("besuchstermine-filters", JSON.stringify({ search })); } catch {}
  }, [search]);

  useEffect(() => {
    fetchTermine();
  }, [fetchTermine]);

  async function handleDelete(id: number) {
    if (!confirm("Besuchstermin wirklich löschen?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/besuchstermine?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTermine((prev) => prev.filter((t) => t.id !== id));
      showToast("Besuchstermin gelöscht", "success");
    } catch {
      showToast("Fehler beim Löschen", "error");
    } finally {
      setDeleting(null);
    }
  }

  const filtered = termine.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.betreff.toLowerCase().includes(q) ||
      t.kunde.name.toLowerCase().includes(q) ||
      (t.kunde.firma ?? "").toLowerCase().includes(q) ||
      (t.kunde.ort ?? "").toLowerCase().includes(q)
    );
  });

  // Group by date
  const grouped: Record<string, Besuchstermin[]> = {};
  for (const t of filtered) {
    const key = t.datum.slice(0, 10);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }
  const groupedDates = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Besuchstermine</h1>
          <p className="text-sm text-gray-500 mt-1">Geplante Kundenbesuche ab heute</p>
        </div>
        <Link
          href="/besuchstermine/neu"
          title="Neuer Besuchstermin"
          className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors w-auto justify-center"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Neuer Besuchstermin</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Kunde, Betreff oder Ort…"
          className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ✕ Zurücksetzen
          </button>
        )}
        <span className="text-sm text-gray-500 ml-auto">
          {filtered.length} Termin{filtered.length !== 1 ? "e" : ""}
        </span>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Lade Besuchstermine…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📅</div>
            <p className="font-medium">Keine Besuchstermine geplant</p>
            <p className="text-sm mt-1">
              {search ? "Keine Treffer für diese Suche." : "Legen Sie einen neuen Besuchstermin an."}
            </p>
            {!search && (
              <Link
                href="/besuchstermine/neu"
                className="mt-4 inline-block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                + Neuer Besuchstermin
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedDates.map((dateKey) => {
            const dayTermine = grouped[dateKey];
            const label = dayLabel(dateKey + "T00:00:00");
            const isHeuteGroup = isToday(dateKey + "T00:00:00");
            return (
              <div key={dateKey}>
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                      isHeuteGroup
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="text-xs text-gray-400">{formatDateShort(dateKey + "T00:00:00")}</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
                <div className="space-y-2">
                  {dayTermine.map((t) => (
                    <div
                      key={t.id}
                      className={`bg-white rounded-xl border shadow-sm ${
                        isHeuteGroup ? "border-green-200" : "border-gray-200"
                      }`}
                    >
                      <div className="px-4 py-3 flex items-start gap-4">
                      <div className="text-2xl mt-0.5">🏠</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/kunden/${t.kunde.id}`}
                            className="font-semibold text-gray-900 hover:text-green-700 hover:underline"
                          >
                            {t.kunde.name}
                          </Link>
                          {t.kunde.firma && (
                            <span className="text-xs text-gray-500">{t.kunde.firma}</span>
                          )}
                          {isHeuteGroup && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              Heute
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{t.betreff}</p>
                        {t.inhalt && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.inhalt}</p>
                        )}
                        {(t.kunde.strasse || t.kunde.ort) && (
                          <p className="text-xs text-gray-400 mt-1">
                            📍 {[t.kunde.strasse, t.kunde.plz, t.kunde.ort].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {t.kunde.lat && t.kunde.lng && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${t.kunde.lat},${t.kunde.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            title="Route in Google Maps öffnen"
                          >
                            🗺 Route
                          </a>
                        )}
                        <Link
                          href={`/kunden/${t.kunde.id}?tab=CRM`}
                          className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                          title="CRM-Aktivitäten des Kunden"
                        >
                          CRM
                        </Link>
                        <button
                          onClick={() => {
                            const tid = t.id;
                            setEmailState((prev) => ({
                              ...prev,
                              [tid]: {
                                offen: !prev[tid]?.offen,
                                empfaenger: prev[tid]?.offen
                                  ? (prev[tid]?.empfaenger ?? "")
                                  : (prev[tid]?.empfaenger || t.kunde.kontakte?.[0]?.wert || ""),
                                loading: false, erfolg: "", fehler: "",
                              },
                            }));
                          }}
                          className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                          title="Besuchstermin-Erinnerung per E-Mail senden"
                        >
                          ✉ Erinnerung
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deleting === t.id}
                          className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50"
                          title="Besuchstermin löschen"
                        >
                          {deleting === t.id ? "…" : "Löschen"}
                        </button>
                      </div>
                      </div>
                    {emailState[t.id]?.offen && (
                      <div className="px-4 pt-2 pb-3 bg-teal-50 border-t border-teal-100 rounded-b-xl">
                        <p className="text-xs font-medium text-teal-800 mb-2">Besuchstermin-Erinnerung per E-Mail senden</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <input
                            type="email"
                            value={emailState[t.id]?.empfaenger ?? ""}
                            onChange={(ev) => setEmailState((prev) => ({ ...prev, [t.id]: { ...prev[t.id], empfaenger: ev.target.value } }))}
                            placeholder="empfaenger@example.com"
                            className="border border-teal-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 w-56"
                          />
                          <button
                            disabled={emailState[t.id]?.loading || !emailState[t.id]?.empfaenger}
                            onClick={async () => {
                              const tid = t.id;
                              setEmailState((prev) => ({ ...prev, [tid]: { ...prev[tid], loading: true, fehler: "", erfolg: "" } }));
                              try {
                                const res = await fetch("/api/exporte/besuchserinnerung/mail", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ aktivitaetId: tid, empfaenger: emailState[tid]?.empfaenger }),
                                });
                                const data = await res.json() as { ok?: boolean; error?: string };
                                if (data.ok) {
                                  setEmailState((prev) => ({ ...prev, [tid]: { ...prev[tid], loading: false, erfolg: `Versendet an ${prev[tid]?.empfaenger}`, offen: false } }));
                                } else {
                                  setEmailState((prev) => ({ ...prev, [tid]: { ...prev[tid], loading: false, fehler: data.error ?? "Versand fehlgeschlagen" } }));
                                }
                              } catch {
                                setEmailState((prev) => ({ ...prev, [tid]: { ...prev[tid], loading: false, fehler: "Versand fehlgeschlagen" } }));
                              }
                            }}
                            className="px-2 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded font-medium disabled:opacity-50"
                          >
                            {emailState[t.id]?.loading ? "Sendet…" : "Senden"}
                          </button>
                          <button
                            onClick={() => setEmailState((prev) => ({ ...prev, [t.id]: { ...prev[t.id], offen: false } }))}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Abbrechen
                          </button>
                          {emailState[t.id]?.fehler && <span className="text-xs text-red-600">{emailState[t.id].fehler}</span>}
                        </div>
                      </div>
                    )}
                    {emailState[t.id]?.erfolg && !emailState[t.id]?.offen && (
                      <div className="px-4 py-2 bg-teal-50 border-t border-teal-100 rounded-b-xl text-xs text-teal-700">
                        {emailState[t.id].erfolg}
                      </div>
                    )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
