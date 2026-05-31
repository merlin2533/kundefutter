"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const TYPEN = ["alle", "festgehalt", "minijob", "stundenbasis"] as const;
const TYP_LABEL: Record<string, string> = { festgehalt: "Festgehalt", minijob: "Minijob", stundenbasis: "Stundenbasis" };
const TYP_COLOR: Record<string, string> = {
  festgehalt: "bg-blue-100 text-blue-800",
  minijob: "bg-purple-100 text-purple-800",
  stundenbasis: "bg-orange-100 text-orange-800",
};

function loadFilters() {
  try { return JSON.parse(sessionStorage.getItem("personal-filters") ?? "{}"); } catch { return {}; }
}

interface Mitarbeiter {
  id: number;
  vorname: string;
  nachname: string;
  typ: string;
  aktiv: boolean;
  eintrittsdatum: string;
  email: string | null;
  telefon: string | null;
  grundgehalt: number | null;
  minijobPauschale: number | null;
  stundenlohn: number | null;
  wochenstunden: number | null;
}

function formatGehalt(ma: Mitarbeiter): string {
  if (ma.typ === "festgehalt" && ma.grundgehalt != null) return `${ma.grundgehalt.toFixed(2)} €/Mon.`;
  if (ma.typ === "minijob" && ma.minijobPauschale != null) return `${ma.minijobPauschale.toFixed(2)} €/Mon.`;
  if (ma.typ === "stundenbasis" && ma.stundenlohn != null) return `${ma.stundenlohn.toFixed(2)} €/h`;
  return "—";
}

export default function PersonalPage() {
  const f = loadFilters();
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState<string>(f.search ?? "");
  const [typ, setTyp] = useState<string>(f.typ ?? "alle");
  const [nurAktive, setNurAktive] = useState<boolean>(f.nurAktive ?? true);
  const [offeneAbrechnungen, setOffeneAbrechnungen] = useState<number>(0);

  useEffect(() => {
    try { sessionStorage.setItem("personal-filters", JSON.stringify({ search, typ, nurAktive })); } catch {}
  }, [search, typ, nurAktive]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (nurAktive) params.set("aktiv", "true");
    if (typ !== "alle") params.set("typ", typ);

    Promise.all([
      fetch(`/api/personal/mitarbeiter?${params}`).then((r) => r.ok ? r.json() : []),
      fetch("/api/personal/abrechnungen/offen").then((r) => r.ok ? r.json() : []),
    ]).then(([ma, offen]) => {
      setMitarbeiter(Array.isArray(ma) ? ma : []);
      setOffeneAbrechnungen(Array.isArray(offen) ? offen.length : 0);
    }).finally(() => setLoading(false));
  }, [typ, nurAktive]);

  const filtered = mitarbeiter.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.vorname.toLowerCase().includes(q) ||
      m.nachname.toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q)
    );
  });

  const gesamt = mitarbeiter.reduce((sum, m) => {
    if (m.typ === "festgehalt") return sum + (m.grundgehalt ?? 0);
    if (m.typ === "minijob") return sum + (m.minijobPauschale ?? 0);
    if (m.typ === "stundenbasis") return sum + (m.stundenlohn ?? 0) * (m.wochenstunden ?? 0) * 4.33;
    return sum;
  }, 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mitarbeiter</h1>
        <Link href="/personal/neu" className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 text-sm font-medium">
          + Neuer Mitarbeiter
        </Link>
      </div>

      {/* KPI-Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Aktive Mitarbeiter</div>
          <div className="text-2xl font-bold text-gray-900">{mitarbeiter.filter((m) => m.aktiv).length}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Offene Abrechnungen</div>
          <div className={`text-2xl font-bold ${offeneAbrechnungen > 0 ? "text-amber-600" : "text-green-600"}`}>
            {offeneAbrechnungen}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Plankosten/Monat</div>
          <div className="text-2xl font-bold text-red-600">{gesamt.toFixed(2)} €</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Gesamt Mitarbeiter</div>
          <div className="text-2xl font-bold text-gray-900">{mitarbeiter.length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Name oder E-Mail suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={typ}
          onChange={(e) => setTyp(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          {TYPEN.map((t) => (
            <option key={t} value={t}>{t === "alle" ? "Alle Typen" : TYP_LABEL[t]}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={nurAktive} onChange={(e) => setNurAktive(e.target.checked)} />
          Nur aktive
        </label>
      </div>

      {/* Tabelle */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Lade…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Keine Mitarbeiter gefunden.{" "}
            <Link href="/personal/neu" className="text-green-700 hover:underline">Ersten Mitarbeiter anlegen →</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 hidden sm:table-cell">Typ</th>
                <th className="px-4 py-3 hidden md:table-cell">Vergütung</th>
                <th className="px-4 py-3 hidden lg:table-cell">Eintritt</th>
                <th className="px-4 py-3 hidden lg:table-cell">Kontakt</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/personal/${m.id}`} className="hover:text-green-700">
                      {m.vorname} {m.nachname}
                    </Link>
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${TYP_COLOR[m.typ] ?? "bg-gray-100"}`}>
                        {TYP_LABEL[m.typ] ?? m.typ}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYP_COLOR[m.typ] ?? "bg-gray-100"}`}>
                      {TYP_LABEL[m.typ] ?? m.typ}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-700">{formatGehalt(m)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                    {new Date(m.eintrittsdatum).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                    {m.email ?? m.telefon ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {m.aktiv ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Aktiv</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inaktiv</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/personal/${m.id}`} className="text-xs text-blue-600 hover:underline">Detail</Link>
                      <Link href={`/personal/abrechnungen/neu?mitarbeiterId=${m.id}`} className="text-xs text-green-700 hover:underline">Abrechnung</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
