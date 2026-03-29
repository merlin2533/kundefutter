"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Aktivitaet {
  id: number;
  typ: string;
  betreff: string;
  inhalt?: string | null;
  datum: string;
  erledigt: boolean;
  faelligAm?: string | null;
  kunde: { id: number; name: string; firma?: string | null };
}

interface WiedervorlageForm {
  aktivitaetId: number;
  kundeId: number;
  betreff: string;
  typ: string;
  faelligAm: string;
}

interface Kunde {
  id: number;
  name: string;
  firma?: string | null;
}

const TYP_META: Record<string, { label: string; color: string; icon: string }> = {
  besuch:  { label: "Besuch",  color: "bg-green-100 text-green-800",  icon: "🏠" },
  anruf:   { label: "Anruf",   color: "bg-blue-100 text-blue-800",    icon: "📞" },
  email:   { label: "E-Mail",  color: "bg-yellow-100 text-yellow-800", icon: "✉️" },
  notiz:   { label: "Notiz",   color: "bg-gray-100 text-gray-700",    icon: "📝" },
  aufgabe: { label: "Aufgabe", color: "bg-orange-100 text-orange-800", icon: "✅" },
};

const TYPEN_KEYS = Object.keys(TYP_META);

export default function CrmPage() {
  const [mainTab, setMainTab] = useState<"liste" | "kalender">("liste");
  const [items, setItems] = useState<Aktivitaet[]>([]);
  const [loading, setLoading] = useState(true);
  const [typFilter, setTypFilter] = useState("alle");
  const [searchText, setSearchText] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  // Wiedervorlage
  const [wiedervorlage, setWiedervorlage] = useState<WiedervorlageForm | null>(null);
  const [wiedervorlageSaving, setWiedervorlageSaving] = useState(false);
  const [wiedervorlageSuccess, setWiedervorlageSuccess] = useState<number | null>(null);

  // Schnellerfassung
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundenLoaded, setKundenLoaded] = useState(false);
  const [schnellKundeId, setSchnellKundeId] = useState<number | "">("");
  const [schnellTyp, setSchnellTyp] = useState("notiz");
  const [schnellBetreff, setSchnellBetreff] = useState("");
  const [schnellSaving, setSchnellSaving] = useState(false);
  const [schnellSuccess, setSchnellSuccess] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/kunden/aktivitaeten?offene=1");
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!kundenLoaded) {
      fetch("/api/kunden?aktiv=true")
        .then((r) => r.json())
        .then((d) => { setKunden(Array.isArray(d) ? d : []); setKundenLoaded(true); });
    }
  }, [kundenLoaded]);

  async function toggleErledigt(item: Aktivitaet) {
    await fetch(`/api/kunden/aktivitaeten?id=${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ erledigt: !item.erledigt }),
    });
    fetchItems();
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await fetch(`/api/kunden/aktivitaeten?id=${id}`, { method: "DELETE" });
      fetchItems();
    } finally { setDeleting(null); }
  }

  async function handleSchnellerfassung(e: React.FormEvent) {
    e.preventDefault();
    if (!schnellKundeId || !schnellBetreff.trim()) return;
    setSchnellSaving(true);
    try {
      const res = await fetch("/api/kunden/aktivitaeten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: schnellKundeId,
          typ: schnellTyp,
          betreff: schnellBetreff.trim(),
          datum: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setSchnellBetreff("");
        setSchnellSuccess(true);
        setTimeout(() => setSchnellSuccess(false), 2000);
        fetchItems();
      }
    } finally {
      setSchnellSaving(false);
    }
  }

  function openWiedervorlage(item: Aktivitaet) {
    const defaultDatum = new Date();
    defaultDatum.setDate(defaultDatum.getDate() + 7);
    const crmTypToAufgabeTyp: Record<string, string> = {
      anruf: "anruf",
      besuch: "besuch",
      email: "email",
      aufgabe: "aufgabe",
      notiz: "aufgabe",
    };
    setWiedervorlage({
      aktivitaetId: item.id,
      kundeId: item.kunde.id,
      betreff: `Wiedervorlage: ${item.betreff}`,
      typ: crmTypToAufgabeTyp[item.typ] ?? "aufgabe",
      faelligAm: defaultDatum.toISOString().split("T")[0],
    });
    setWiedervorlageSuccess(null);
  }

  async function handleWiedervorlageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!wiedervorlage) return;
    setWiedervorlageSaving(true);
    try {
      const res = await fetch("/api/aufgaben", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betreff: wiedervorlage.betreff,
          kundeId: wiedervorlage.kundeId,
          typ: wiedervorlage.typ,
          faelligAm: wiedervorlage.faelligAm || null,
          prioritaet: "normal",
        }),
      });
      if (res.ok) {
        setWiedervorlageSuccess(wiedervorlage.aktivitaetId);
        setWiedervorlage(null);
        setTimeout(() => setWiedervorlageSuccess(null), 3000);
      }
    } finally {
      setWiedervorlageSaving(false);
    }
  }

  const typen = ["alle", ...TYPEN_KEYS];

  // Filter by type and search
  const displayed = items
    .filter((i) => typFilter === "alle" || i.typ === typFilter)
    .filter((i) => {
      if (!searchText.trim()) return true;
      const q = searchText.toLowerCase();
      return (
        i.betreff.toLowerCase().includes(q) ||
        (i.inhalt ?? "").toLowerCase().includes(q) ||
        i.kunde.name.toLowerCase().includes(q) ||
        (i.kunde.firma ?? "").toLowerCase().includes(q)
      );
    });

  const overdueCount = items.filter((i) => i.faelligAm && !i.erledigt && new Date(i.faelligAm) < new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">CRM – Aktivitäten & Aufgaben</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kundenbesuche, Anrufe, Notizen und offene Aufgaben im Überblick.</p>
          {overdueCount > 0 && (
            <p className="mt-1 text-sm font-medium text-red-600">{overdueCount} überfällige Aufgabe{overdueCount !== 1 ? "n" : ""}</p>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-gray-200 gap-1">
        {([
          { key: "liste", label: "Aktivitätsliste" },
          { key: "kalender", label: "📅 Kalender" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              mainTab === t.key
                ? "border-green-700 text-green-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === "kalender" && <KalenderTab />}

      {mainTab === "liste" && (<>

      {/* Schnellerfassung */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Schnellerfassung</h2>
        <form onSubmit={handleSchnellerfassung} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="w-full sm:w-56">
            <label className="block text-xs text-gray-500 mb-1">Kunde</label>
            <SearchableSelect
              options={kunden.map((k) => ({
                value: k.id,
                label: k.firma ? `${k.firma} (${k.name})` : k.name,
              }))}
              value={schnellKundeId}
              onChange={(v) => setSchnellKundeId(v ? Number(v) : "")}
              placeholder="Kunde wählen…"
              required
            />
          </div>
          <div className="w-full sm:w-36">
            <label className="block text-xs text-gray-500 mb-1">Typ</label>
            <select
              value={schnellTyp}
              onChange={(e) => setSchnellTyp(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {TYPEN_KEYS.map((t) => (
                <option key={t} value={t}>{TYP_META[t].icon} {TYP_META[t].label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs text-gray-500 mb-1">Betreff</label>
            <input
              type="text"
              value={schnellBetreff}
              onChange={(e) => setSchnellBetreff(e.target.value)}
              placeholder="Kurzbeschreibung…"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <button
            type="submit"
            disabled={schnellSaving || !schnellKundeId || !schnellBetreff.trim()}
            className="w-full sm:w-auto px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {schnellSaving ? "…" : schnellSuccess ? "✓ Gespeichert" : "Erfassen"}
          </button>
        </form>
      </div>

      {/* Suche + Typ-Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Suche nach Betreff, Inhalt, Kunde…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <div className="flex gap-2 flex-wrap">
          {typen.map((t) => (
            <button
              key={t}
              onClick={() => setTypFilter(t)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${typFilter === t ? "bg-green-700 text-white" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"}`}
            >
              {t === "alle" ? "Alle Typen" : TYP_META[t].icon + " " + TYP_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-sm">{searchText ? "Keine Treffer für die Suche" : "Keine offenen Aktivitäten"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((item) => {
            const meta = TYP_META[item.typ] ?? TYP_META.notiz;
            const isOverdue = item.faelligAm && !item.erledigt && new Date(item.faelligAm) < new Date();
            return (
              <div key={item.id} className="space-y-0">
                <div
                  className={`flex gap-3 p-4 rounded-xl border bg-white transition-colors ${isOverdue ? "border-red-200" : "border-gray-200"} ${wiedervorlage?.aktivitaetId === item.id ? "rounded-b-none border-b-0" : ""}`}
                >
                  <div className="text-xl leading-none mt-0.5 shrink-0">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      <Link
                        href={`/kunden/${item.kunde.id}?tab=CRM`}
                        className="text-sm font-medium text-green-700 hover:underline"
                      >
                        {item.kunde.firma ? `${item.kunde.firma} (${item.kunde.name})` : item.kunde.name}
                      </Link>
                      {isOverdue && <span className="text-xs text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded">Überfällig</span>}
                    </div>
                    <p className="mt-1 text-sm font-medium text-gray-900">{item.betreff}</p>
                    {item.inhalt && <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{item.inhalt}</p>}
                    <div className="mt-1.5 flex gap-3 text-xs text-gray-400">
                      <span>{new Date(item.datum).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</span>
                      {item.faelligAm && (
                        <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                          Fällig: {new Date(item.faelligAm).toLocaleDateString("de-DE")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    {item.typ === "aufgabe" && (
                      <button
                        onClick={() => toggleErledigt(item)}
                        className="text-xs px-2 py-1 rounded border border-green-500 text-green-700 hover:bg-green-50 transition-colors"
                      >
                        Erledigen
                      </button>
                    )}
                    {wiedervorlageSuccess === item.id ? (
                      <span className="text-xs text-green-600 font-medium">Aufgabe erstellt</span>
                    ) : (
                      <button
                        onClick={() => wiedervorlage?.aktivitaetId === item.id ? setWiedervorlage(null) : openWiedervorlage(item)}
                        className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap"
                      >
                        {wiedervorlage?.aktivitaetId === item.id ? "Abbrechen" : "Wiedervorlage"}
                      </button>
                    )}
                    <Link
                      href={`/kunden/${item.kunde.id}?tab=CRM`}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Zum Kunden →
                    </Link>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                    >
                      {deleting === item.id ? "…" : "Löschen"}
                    </button>
                  </div>
                </div>
                {wiedervorlage?.aktivitaetId === item.id && (
                  <form
                    onSubmit={handleWiedervorlageSubmit}
                    className="border border-gray-200 border-t-blue-200 bg-blue-50 rounded-b-xl px-4 py-3 space-y-3"
                  >
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Wiedervorlage als Aufgabe erstellen</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={wiedervorlage.betreff}
                        onChange={(e) => setWiedervorlage({ ...wiedervorlage, betreff: e.target.value })}
                        placeholder="Betreff *"
                        required
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <select
                        value={wiedervorlage.typ}
                        onChange={(e) => setWiedervorlage({ ...wiedervorlage, typ: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full sm:w-32"
                      >
                        <option value="aufgabe">Aufgabe</option>
                        <option value="anruf">Anruf</option>
                        <option value="besuch">Besuch</option>
                        <option value="email">E-Mail</option>
                      </select>
                      <input
                        type="date"
                        value={wiedervorlage.faelligAm}
                        onChange={(e) => setWiedervorlage({ ...wiedervorlage, faelligAm: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full sm:w-40"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={wiedervorlageSaving || !wiedervorlage.betreff.trim()}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
                      >
                        {wiedervorlageSaving ? "…" : "Aufgabe erstellen"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWiedervorlage(null)}
                        className="px-4 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}
    </div>
  );
}

// ─── KalenderTab ─────────────────────────────────────────────────────────────

const TYP_DOT: Record<string, string> = {
  besuch:  "bg-green-500",
  anruf:   "bg-blue-500",
  email:   "bg-yellow-500",
  notiz:   "bg-gray-400",
  aufgabe: "bg-orange-500",
};

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface KalenderAktivitaet {
  id: number;
  typ: string;
  betreff: string;
  faelligAm: string;
  erledigt: boolean;
  kunde: { id: number; name: string; firma?: string | null };
}

function KalenderTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [aktivitaeten, setAktivitaeten] = useState<KalenderAktivitaet[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAktivitaeten = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const von = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const bis = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    try {
      const res = await fetch(`/api/kunden/aktivitaeten?faelligVon=${von}&faelligBis=${bis}`);
      const data = await res.json();
      setAktivitaeten(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAktivitaeten(year, month); }, [year, month, fetchAktivitaeten]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid: weeks containing days of this month
  const calendarDays = useMemo(() => {
    // First day of month (0=Sun..6=Sat), convert to Mon-based (0=Mon..6=Sun)
    const firstDow = new Date(year, month, 1).getDay();
    const mondayOffset = (firstDow + 6) % 7; // days before 1st to reach Mon
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - mondayOffset + 1;
      return dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null;
    });
  }, [year, month]);

  // Index activities by day
  const byDay = useMemo(() => {
    const map: Record<number, KalenderAktivitaet[]> = {};
    aktivitaeten.forEach((a) => {
      const d = new Date(a.faelligAm);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(a);
      }
    });
    return map;
  }, [aktivitaeten, year, month]);

  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Vormonat
        </button>
        <h2 className="text-lg font-semibold text-gray-900 flex-1 text-center">
          {MONATSNAMEN[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Nächster Monat →
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400 text-center">Lade…</p>}

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WOCHENTAGE.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-semibold text-gray-500 text-center uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const acts = day ? (byDay[day] ?? []) : [];
            const isToday = day === todayDay;
            return (
              <div
                key={i}
                className={`min-h-[80px] border-b border-r border-gray-100 p-1.5 ${
                  day ? "bg-white" : "bg-gray-50"
                } ${isToday ? "ring-2 ring-inset ring-green-400" : ""}`}
              >
                {day && (
                  <>
                    <span className={`text-xs font-medium block mb-1 ${isToday ? "text-green-700 font-bold" : "text-gray-700"}`}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {acts.slice(0, 3).map((a) => (
                        <Link
                          key={a.id}
                          href={`/kunden/${a.kunde.id}?tab=CRM`}
                          className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs leading-tight hover:bg-gray-100 transition-colors ${a.erledigt ? "opacity-50 line-through" : ""}`}
                          title={`${a.betreff} — ${a.kunde.firma ?? a.kunde.name}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYP_DOT[a.typ] ?? "bg-gray-400"}`} />
                          <span className="truncate text-gray-700">{a.betreff}</span>
                        </Link>
                      ))}
                      {acts.length > 3 && (
                        <p className="text-xs text-gray-400 px-1">+{acts.length - 3} weitere</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs text-gray-600">
        {Object.entries(TYP_META).map(([key, meta]) => (
          <span key={key} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${TYP_DOT[key] ?? "bg-gray-400"}`} />
            {meta.label}
          </span>
        ))}
      </div>
    </div>
  );
}
