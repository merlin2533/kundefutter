"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import EmailVersandModal from "@/components/EmailVersandModal";
import { useToast } from "@/components/ToastProvider";
import * as Sentry from "@sentry/nextjs";

interface BestellPosition {
  id: number;
  artikelId: number;
  menge: number;
  mengeGeliefert: number | null;
  einheit: string;
  preis: number | null;
  artikel: { id: number; name: string; artikelnummer: string | null } | null;
}

interface Bestellung {
  id: number;
  nummer: string;
  datum: string;
  lieferdatum: string | null;
  status: string;
  notiz: string | null;
  versendetAm: string | null;
  versendetAn: string | null;
  lieferantId: number;
  lieferant: { id: number; name: string; firma: string | null; email: string | null } | null;
  positionen: BestellPosition[];
}

interface LieferantOption {
  id: number;
  name: string;
}

type Status = "OFFEN" | "BESTAETIGT" | "TEILGELIEFERT" | "ABGESCHLOSSEN" | "STORNIERT";

const STATUS_COLORS: Record<Status, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  BESTAETIGT: "bg-blue-100 text-blue-800",
  TEILGELIEFERT: "bg-orange-100 text-orange-800",
  ABGESCHLOSSEN: "bg-green-100 text-green-800",
  STORNIERT: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<Status, string> = {
  OFFEN: "Offen",
  BESTAETIGT: "Bestätigt",
  TEILGELIEFERT: "Teilgeliefert",
  ABGESCHLOSSEN: "Abgeschlossen",
  STORNIERT: "Storniert",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as Status] ?? "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status as Status] ?? status;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

export default function BestellungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { showToast } = useToast();
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<Bestellung | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mengenGeliefert, setMengenGeliefert] = useState<Record<number, string>>({});
  const [mailOpen, setMailOpen] = useState(false);
  const [mailSending, setMailSending] = useState(false);
  const [mailFehler, setMailFehler] = useState("");
  const [umschluesselnPos, setUmschluesselnPos] = useState<number | null>(null);
  const [umschluesseln, setUmschluesseln] = useState<number | null>(null); // positionId, während Anfrage läuft
  const [lieferantenListe, setLieferantenListe] = useState<LieferantOption[]>([]);

  useEffect(() => {
    fetch("/api/lieferanten?limit=500")
      .then((r) => r.json())
      .then((d) => setLieferantenListe(Array.isArray(d) ? d.map((l: { id: number; name: string }) => ({ id: l.id, name: l.name })) : []))
      .catch((err) => Sentry.captureException(err));
  }, []);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/bestellungen/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d: Bestellung) => {
        setData(d);
        const mg: Record<number, string> = {};
        d.positionen.forEach((p) => {
          mg[p.id] = p.mengeGeliefert != null ? String(p.mengeGeliefert) : "";
        });
        setMengenGeliefert(mg);
        setLoading(false);
      })
      .catch((err) => {
        Sentry.captureException(err);
        return setLoading(false);
      });
  }, [id]);

  async function handleStatusChange(aktion: string) {
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/bestellungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Aktualisieren.");
        return;
      }
      const updated: Bestellung = await res.json();
      setData(updated);
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Aktualisieren.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMengen() {
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      const positionen = data?.positionen.map((p) => ({
        id: p.id,
        mengeGeliefert: mengenGeliefert[p.id] ? parseFloat(mengenGeliefert[p.id]) : null,
      }));
      const res = await fetch(`/api/bestellungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionen }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Speichern.");
        return;
      }
      const updated: Bestellung = await res.json();
      setData(updated);
    } catch (err) {
      Sentry.captureException(err);
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendMail(empfaenger: string, cc: string) {
    if (!id) return;
    setMailSending(true);
    setMailFehler("");
    try {
      const res = await fetch(`/api/bestellungen/${id}/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empfaenger, cc: cc || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMailFehler(d.error ?? "E-Mail-Versand fehlgeschlagen.");
        return;
      }
      setData(d.bestellung);
      setMailOpen(false);
      showToast(`Bestellung an ${d.empfaenger} gesendet.`, "success");
    } catch (err) {
      Sentry.captureException(err);
      setMailFehler("Netzwerkfehler.");
    } finally {
      setMailSending(false);
    }
  }

  async function handleUmschluesseln(positionId: number, neuLieferantId: number) {
    if (!id) return;
    setUmschluesseln(positionId);
    try {
      const res = await fetch(`/api/bestellungen/${id}/umschluesseln`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId, lieferantId: neuLieferantId }),
      });
      const d = await res.json();
      if (!res.ok) {
        showToast(d.error ?? "Umschlüsseln fehlgeschlagen.", "error");
        return;
      }
      showToast(`Position zu ${d.neueBestellung.nummer} umgeschlüsselt.`, "success");
      // Position ist jetzt in einer anderen Bestellung — diese Ansicht neu laden.
      const res2 = await fetch(`/api/bestellungen/${id}`);
      if (res2.ok) setData(await res2.json());
    } catch (err) {
      Sentry.captureException(err);
      showToast("Netzwerkfehler.", "error");
    } finally {
      setUmschluesseln(null);
      setUmschluesselnPos(null);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Lade…</div>;
  if (!data) return <div className="p-8 text-red-600">Bestellung nicht gefunden.</div>;

  const canBestätigen = data.status === "OFFEN";
  const canAbschliessen = data.status === "BESTAETIGT" || data.status === "TEILGELIEFERT";
  const canStornieren = data.status === "OFFEN" || data.status === "BESTAETIGT";

  return (
    <div className="max-w-4xl">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/bestellungen" className="hover:text-green-700">Bestellungen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{data.nummer}</span>
      </nav>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.nummer}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={data.status} />
            <span className="text-sm text-gray-500">
              {new Date(data.datum).toLocaleDateString("de-DE")}
            </span>
            {data.versendetAm ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                ✓ Versendet am {new Date(data.versendetAm).toLocaleDateString("de-DE")}
                {data.versendetAn ? ` an ${data.versendetAn}` : ""}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                Noch nicht versendet
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(data.status === "BESTAETIGT" || data.status === "TEILGELIEFERT") && data.lieferant && (
            <Link
              href={`/lager/wareneingang?lieferantId=${data.lieferant.id}`}
              className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-300 text-sm font-medium rounded-lg transition-colors"
            >
              → Wareneingang buchen
            </Link>
          )}
          {data.status !== "STORNIERT" && (
            <button
              onClick={() => setMailOpen(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {data.versendetAm ? "Erneut per E-Mail senden" : "Per E-Mail senden"}
            </button>
          )}
          {canBestätigen && (
            <button
              onClick={() => handleStatusChange("bestätigen")}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Bestätigen
            </button>
          )}
          {canAbschliessen && (
            <button
              onClick={() => handleStatusChange("abschliessen")}
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Abschließen
            </button>
          )}
          {canStornieren && (
            <button
              onClick={() => { if (confirm("Bestellung wirklich stornieren?")) handleStatusChange("stornieren"); }}
              disabled={saving}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Stornieren
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bestelldetails</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Lieferant</span>
              <span className="font-medium text-gray-900">
                {data.lieferant ? (
                  <Link href={`/lieferanten/${data.lieferant.id}`} className="text-green-700 hover:underline">
                    {data.lieferant.firma ?? data.lieferant.name}
                  </Link>
                ) : "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Bestelldatum</span>
              <span className="text-gray-900">{new Date(data.datum).toLocaleDateString("de-DE")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Lieferdatum</span>
              <span className="text-gray-900">
                {data.lieferdatum ? new Date(data.lieferdatum).toLocaleDateString("de-DE") : "—"}
              </span>
            </div>
          </div>
        </div>
        {data.notiz && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notiz</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.notiz}</p>
          </div>
        )}
      </div>

      {/* Positionen */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Positionen</h2>
          {(data.status === "BESTAETIGT" || data.status === "TEILGELIEFERT") && (
            <button
              onClick={handleSaveMengen}
              disabled={saving}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Speichern…" : "Liefermengen speichern"}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Artikel</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Bestellt</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Geliefert</th>
                <th className="hidden sm:table-cell text-right px-4 py-3 font-medium text-gray-600">EK-Preis</th>
                {data.status !== "ABGESCHLOSSEN" && data.status !== "STORNIERT" && (
                  <th className="text-right px-4 py-3 font-medium text-gray-600" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.positionen.map((pos) => (
                <tr key={pos.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {pos.artikel ? (
                      <Link href={`/artikel/${pos.artikel.id}`} className="text-green-700 hover:underline">
                        {pos.artikel.name}
                      </Link>
                    ) : "—"}
                    {pos.artikel?.artikelnummer && (
                      <div className="text-xs text-gray-400">{pos.artikel.artikelnummer}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {pos.menge} {pos.einheit}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(data.status === "BESTAETIGT" || data.status === "TEILGELIEFERT") ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={mengenGeliefert[pos.id] ?? ""}
                          onChange={(e) => setMengenGeliefert((prev) => ({ ...prev, [pos.id]: e.target.value }))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-500">{pos.einheit}</span>
                      </div>
                    ) : (
                      <span className="text-gray-700">
                        {pos.mengeGeliefert != null ? `${pos.mengeGeliefert} ${pos.einheit}` : "—"}
                      </span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-700">
                    {pos.preis != null ? formatEuro(pos.preis) : "—"}
                  </td>
                  {data.status !== "ABGESCHLOSSEN" && data.status !== "STORNIERT" && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {umschluesselnPos === pos.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <select
                            autoFocus
                            defaultValue=""
                            disabled={umschluesseln === pos.id}
                            onChange={(e) => e.target.value && handleUmschluesseln(pos.id, Number(e.target.value))}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            <option value="" disabled>— anderer Lieferant —</option>
                            {lieferantenListe.filter((l) => l.id !== data.lieferantId).map((l) => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                          <button onClick={() => setUmschluesselnPos(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setUmschluesselnPos(pos.id)}
                          className="text-xs text-amber-700 hover:text-amber-800 hover:underline"
                          title="Falls dieser Lieferant den Artikel nicht liefern kann"
                        >
                          Nicht verfügbar → umschlüsseln
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EmailVersandModal
        open={mailOpen}
        onClose={() => { setMailOpen(false); setMailFehler(""); }}
        title={`Bestellung ${data.nummer} senden`}
        kundenname={data.lieferant?.name ?? ""}
        emailKontakte={data.lieferant?.email ? [{ wert: data.lieferant.email }] : []}
        docType="sonstige"
        onSend={handleSendMail}
        loading={mailSending}
        fehler={mailFehler}
      />
    </div>
  );
}
