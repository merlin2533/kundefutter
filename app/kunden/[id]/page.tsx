"use client";

import { useEffect, useState, useCallback } from "react";
import nextDynamic from "next/dynamic";
import { useParams } from "next/navigation";
import Link from "next/link";
import DriveOrdner from "@/components/DriveOrdner";
import { formatEuro, formatDatum } from "@/lib/utils";
import { Kunde, Tab, TABS, statusBadge, lieferungTotal, KategorieBadge } from "./_shared";

// ─── Tabs — lazy-geladen, damit nur der aktive Tab im Bundle landet ──────────
const tabLoading = () => <p className="text-sm text-gray-400">Lade…</p>;
const StammdatenTab = nextDynamic(() => import("./tabs/StammdatenTab"), { loading: tabLoading });
const KontakteTab = nextDynamic(() => import("./tabs/KontakteTab"), { loading: tabLoading });
const BedarfeTab = nextDynamic(() => import("./tabs/BedarfeTab"), { loading: tabLoading });
const SonderpreiseTab = nextDynamic(() => import("./tabs/SonderpreiseTab"), { loading: tabLoading });
const StatistikTab = nextDynamic(() => import("./tabs/StatistikTab"), { loading: tabLoading });
const LieferhistorieTab = nextDynamic(() => import("./tabs/LieferhistorieTab"), { loading: tabLoading });
const CrmTab = nextDynamic(() => import("./tabs/CrmTab"), { loading: tabLoading });
const NotizenTab = nextDynamic(() => import("./tabs/NotizenTab"), { loading: tabLoading });
const AgrarantragTab = nextDynamic(() => import("./tabs/AgrarantragTab"), { loading: tabLoading });
const SchlagkarteiTab = nextDynamic(() => import("./tabs/SchlagkarteiTab"), { loading: tabLoading });
const DuengebedarfTab = nextDynamic(() => import("./tabs/DuengebedarfTab"), { loading: tabLoading });
const TiereTab = nextDynamic(() => import("./tabs/TiereTab"), { loading: tabLoading });
const AngeboteTab = nextDynamic(() => import("./tabs/AngeboteTab"), { loading: tabLoading });
const AufgabenTab = nextDynamic(() => import("./tabs/AufgabenTab"), { loading: tabLoading });
const VorgangskettTab = nextDynamic(() => import("./tabs/VorgangskettTab"), { loading: tabLoading });
const ErklaerungTab = nextDynamic(() => import("./tabs/ErklaerungTab"), { loading: tabLoading });
const ReklamationenTab = nextDynamic(() => import("./tabs/ReklamationenTab"), { loading: tabLoading });
const AlbrechtTab = nextDynamic(() => import("./tabs/AlbrechtTab"), { loading: tabLoading });

export default function KundeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Stammdaten");
  const [crmAutoOpen, setCrmAutoOpen] = useState(false);

  // Rückruf planen
  const [showRueckruf, setShowRueckruf] = useState(false);
  const [rueckrufDatum, setRueckrufDatum] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d.toISOString().slice(0, 16);
  });
  const [rueckrufNotiz, setRueckrufNotiz] = useState("");
  const [rueckrufSaving, setRueckrufSaving] = useState(false);
  const [rueckrufSuccess, setRueckrufSuccess] = useState(false);

  async function handleRueckrufEinplanen() {
    if (!kunde) return;
    setRueckrufSaving(true);
    try {
      const res = await fetch("/api/aufgaben", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betreff: "Rückruf",
          typ: "anruf",
          prioritaet: "hoch",
          faelligAm: rueckrufDatum ? new Date(rueckrufDatum).toISOString() : null,
          beschreibung: rueckrufNotiz.trim() || null,
          kundeId: kunde.id,
        }),
      });
      if (!res.ok) throw new Error();
      setRueckrufSuccess(true);
      setShowRueckruf(false);
      setRueckrufNotiz("");
      setTimeout(() => setRueckrufSuccess(false), 2000);
    } catch {
      // ignore
    } finally {
      setRueckrufSaving(false);
    }
  }

  // Support ?tab=CRM URL param for direct navigation
  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t && (TABS as readonly string[]).includes(t)) setActiveTab(t as Tab);
    }
  }, []);

  const fetchKunde = useCallback(async () => {
    const res = await fetch(`/api/kunden/${id}`);
    if (res.status === 404) { setNotFound(true); setLoading(false); return; }
    const data = await res.json();
    setKunde(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchKunde();
  }, [fetchKunde]);

  if (loading) {
    return <p className="text-gray-400 mt-8 text-sm">Lade Kunde…</p>;
  }
  if (notFound || !kunde) {
    return (
      <div className="mt-8">
        <p className="text-gray-600">Kunde nicht gefunden.</p>
        <Link href="/kunden" className="text-green-700 hover:underline text-sm mt-2 inline-block">
          ← Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/kunden" className="text-sm text-gray-500 hover:text-gray-700">
              Kunden
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm text-gray-700 truncate">{kunde.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">{kunde.name}</h1>
          {kunde.firma && <p className="text-gray-500 mt-0.5">{kunde.firma}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <KategorieBadge kategorie={kunde.kategorie} />
          {!kunde.aktiv && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Inaktiv</span>
          )}
          <Link
            href={`/kunden/${kunde.id}/mappe`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors font-medium"
          >
            🖨 Kundenmappe drucken
          </Link>
        </div>
      </div>

      {/* Schnellübersicht */}
      {(() => {
        const phone = kunde.kontakte.find((k) => k.typ === "telefon" || k.typ === "mobil");
        const email = kunde.kontakte.find((k) => k.typ === "email");
        const geliefert = kunde.lieferungen.filter((l) => l.status === "geliefert");
        const offeneRechnungen = geliefert
          .filter((l) => !l.bezahltAm)
          .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());
        const offen = offeneRechnungen.reduce((s, l) => s + lieferungTotal(l), 0);
        const letzteL = [...kunde.lieferungen].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())[0];
        const offeneLieferungen = kunde.lieferungen.filter((l) => l.status === "geplant").length;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            {/* Kontakt */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kontakt</p>
              {phone ? (
                <a href={`tel:${phone.wert}`} className="text-sm text-green-700 hover:underline font-medium truncate">📞 {phone.wert}</a>
              ) : <p className="text-sm text-gray-400">—</p>}
              {email ? (
                <a href={`mailto:${email.wert}`} className="text-xs text-blue-600 hover:underline truncate">✉ {email.wert}</a>
              ) : null}
            </div>
            {/* Adresse */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Adresse</p>
              {kunde.strasse && <p className="text-sm text-gray-700 truncate">{kunde.strasse}</p>}
              <p className="text-sm text-gray-700">{[kunde.plz, kunde.ort].filter(Boolean).join(" ") || "—"}</p>
            </div>
            {/* Offener Betrag */}
            {(() => {
              const cardClass = `border rounded-xl p-3 flex flex-col gap-1 ${offen > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`;
              const labelClass = `text-xs font-semibold uppercase tracking-wide ${offen > 0 ? "text-red-400" : "text-gray-400"}`;
              const amountClass = `text-lg font-bold ${offen > 0 ? "text-red-700" : "text-gray-500"}`;
              const inner = (
                <>
                  <p className={labelClass}>Offen</p>
                  <p className={`${amountClass} ${offeneRechnungen.length > 0 ? "hover:underline" : ""}`}>{formatEuro(offen)}</p>
                  {offeneRechnungen.length > 1 && (
                    <p className="text-xs text-red-600">{offeneRechnungen.length} offene Rechnungen →</p>
                  )}
                  {offeneRechnungen.length === 1 && (
                    <p className="text-xs text-red-600">
                      Rechnung {offeneRechnungen[0].rechnungNr ?? `#${offeneRechnungen[0].id}`} →
                    </p>
                  )}
                  {offeneLieferungen > 0 && (
                    <p className="text-xs text-yellow-700">{offeneLieferungen} Lieferschein{offeneLieferungen > 1 ? "e" : ""} geplant</p>
                  )}
                </>
              );
              if (offeneRechnungen.length > 0) {
                const target = `/lieferungen/${offeneRechnungen[0].id}`;
                const titleText = offeneRechnungen.length === 1
                  ? "Rechnung öffnen"
                  : `Älteste offene Rechnung öffnen (${offeneRechnungen.length} offen)`;
                return (
                  <Link href={target} className={`${cardClass} hover:bg-red-100 transition-colors cursor-pointer`} title={titleText}>
                    {inner}
                  </Link>
                );
              }
              return <div className={cardClass}>{inner}</div>;
            })()}
            {/* Letzte Lieferung */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Letzte Lieferung</p>
              {letzteL ? (
                <>
                  <p className="text-sm font-medium text-gray-800">{formatDatum(letzteL.datum)}</p>
                  <div className="flex items-center gap-1.5">
                    {statusBadge(letzteL.status)}
                    {letzteL.rechnungNr && <span className="text-xs text-gray-500 truncate">{letzteL.rechnungNr}</span>}
                  </div>
                </>
              ) : <p className="text-sm text-gray-400">Keine</p>}
            </div>
            {/* Schnellaktionen */}
            <div className="col-span-2 sm:col-span-1 bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Schnellaktionen</p>
              <Link
                href={`/lieferungen/neu?kundeId=${kunde.id}`}
                className="w-full text-center text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                + Neue Lieferung
              </Link>
              <button
                onClick={() => { setActiveTab("CRM"); setCrmAutoOpen(true); }}
                className="w-full text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-medium transition-colors"
              >
                + CRM Aktivität
              </button>
              <Link
                href={`/psm/neu?kundeId=${kunde.id}`}
                className="w-full text-center text-xs px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-medium transition-colors"
              >
                PSM-Ausbringung
              </Link>
              {rueckrufSuccess ? (
                <div className="w-full text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium text-center">
                  ✓ Rückruf eingeplant
                </div>
              ) : (
                <button
                  onClick={() => setShowRueckruf((v) => !v)}
                  className="w-full text-xs px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-medium transition-colors"
                >
                  📞 Rückruf planen
                </button>
              )}
              {showRueckruf && !rueckrufSuccess && (
                <div className="border border-purple-200 rounded-lg p-2 bg-purple-50 space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Termin</label>
                    <input
                      type="datetime-local"
                      value={rueckrufDatum}
                      onChange={(e) => setRueckrufDatum(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notiz (optional)</label>
                    <input
                      type="text"
                      value={rueckrufNotiz}
                      onChange={(e) => setRueckrufNotiz(e.target.value)}
                      placeholder="z.B. Angebot besprechen"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleRueckrufEinplanen}
                      disabled={rueckrufSaving || !rueckrufDatum}
                      className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded font-medium disabled:opacity-50 transition-colors"
                    >
                      {rueckrufSaving ? "…" : "Einplanen"}
                    </button>
                    <button
                      onClick={() => setShowRueckruf(false)}
                      className="px-2 py-1 border border-gray-300 text-xs rounded hover:bg-gray-50 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        {activeTab === "Stammdaten" && <StammdatenTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Kontakte" && <KontakteTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Bedarfe" && <BedarfeTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Sonderpreise" && <SonderpreiseTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "Statistik" && <StatistikTab kunde={kunde} />}
        {activeTab === "Lieferhistorie" && <LieferhistorieTab kunde={kunde} onRefresh={fetchKunde} />}
        {activeTab === "CRM" && <CrmTab kundeId={kunde.id} autoOpen={crmAutoOpen} />}
        {activeTab === "Notizen" && <NotizenTab kundeId={kunde.id} />}
        {activeTab === "Agrarantrag" && <AgrarantragTab kundeId={kunde.id} />}
        {activeTab === "Schlagkartei" && <SchlagkarteiTab kundeId={kunde.id} lat={kunde.lat} lng={kunde.lng} />}
        {activeTab === "Düngebedarf" && <DuengebedarfTab kundeId={kunde.id} />}
        {activeTab === "Albrecht" && <AlbrechtTab kundeId={kunde.id} />}
        {activeTab === "Tiere" && <TiereTab kundeId={kunde.id} />}
        {activeTab === "Angebote" && <AngeboteTab kundeId={kunde.id} />}
        {activeTab === "Aufgaben" && <AufgabenTab kundeId={kunde.id} />}
        {activeTab === "Reklamationen" && <ReklamationenTab kundeId={kunde.id} />}
        {activeTab === "Dokumente" && <DriveOrdner entityType="kunde" entityId={kunde.id} />}
        {activeTab === "Vorgangskette" && <VorgangskettTab kundeId={kunde.id} lieferungen={kunde.lieferungen} />}
        {activeTab === "Erklärungen" && <ErklaerungTab kundeId={kunde.id} />}
      </div>
    </div>
  );
}
