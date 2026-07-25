"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface NextcloudStatus {
  konfiguriert: boolean;
  verbunden: boolean;
  fehler?: string;
}

interface ZentralOrdner {
  name: string;
  pfad: string;
}

interface BackfillStatus {
  laufend: boolean;
  gestartet?: string;
  beendet?: string;
  verwaist?: boolean;
  aktuellerSchritt?: string;
  gesamt?: { verarbeitet: number; hochgeladen: number; uebersprungen: number; fehler: number };
  fehlerListe?: { entitaet: string; id: number; fehler: string }[];
}

export default function NextcloudEinstellungenPage() {
  const [status, setStatus] = useState<NextcloudStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [rootPfad, setRootPfad] = useState("/AGRI-Office");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fehler, setFehler] = useState("");

  const [zentralOrdner, setZentralOrdner] = useState<ZentralOrdner[]>([]);
  const [neuerOrdnerName, setNeuerOrdnerName] = useState("");
  const [neuerOrdnerPfad, setNeuerOrdnerPfad] = useState("");
  const [zentralSaving, setZentralSaving] = useState(false);

  const [backfill, setBackfill] = useState<BackfillStatus | null>(null);
  const [backfillFehler, setBackfillFehler] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ladeStatus();
    ladeKonfiguration();
    ladeBackfillStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ladeStatus() {
    setStatusLoading(true);
    const res = await fetch("/api/nextcloud/status");
    if (res.ok) setStatus(await res.json());
    setStatusLoading(false);
  }

  async function ladeKonfiguration() {
    const einst = await fetch("/api/einstellungen?prefix=system.nextcloud.").then((r) => (r.ok ? r.json() : {})) as Record<string, string>;
    if (einst["system.nextcloud.serverUrl"]) setServerUrl(einst["system.nextcloud.serverUrl"]);
    if (einst["system.nextcloud.username"]) setUsername(einst["system.nextcloud.username"]);
    if (einst["system.nextcloud.rootPfad"]) setRootPfad(einst["system.nextcloud.rootPfad"]);
    if (einst["system.nextcloud.zentralOrdner"]) {
      try { setZentralOrdner(JSON.parse(einst["system.nextcloud.zentralOrdner"])); } catch { /* ignore */ }
    }
  }

  async function ladeBackfillStatus() {
    const res = await fetch("/api/nextcloud/backfill/status");
    if (!res.ok) return;
    const json: BackfillStatus = await res.json();
    setBackfill(json);
    if (json.laufend) startePolling();
  }

  function startePolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/nextcloud/backfill/status");
      if (!res.ok) return;
      const json: BackfillStatus = await res.json();
      setBackfill(json);
      if (!json.laufend && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2500);
  }

  async function speichern() {
    setSaving(true);
    setFehler("");
    setSaved(false);
    try {
      await Promise.all([
        fetch("/api/einstellungen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "system.nextcloud.serverUrl", value: serverUrl.trim().replace(/\/+$/, "") }) }),
        fetch("/api/einstellungen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "system.nextcloud.username", value: username.trim() }) }),
        fetch("/api/einstellungen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "system.nextcloud.rootPfad", value: rootPfad.trim() || "/AGRI-Office" }) }),
        ...(appPassword ? [fetch("/api/einstellungen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "system.nextcloud.appPassword", value: appPassword }) })] : []),
      ]);
      setSaved(true);
      setAppPassword("");
      await ladeStatus();
    } catch {
      setFehler("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function trennen() {
    if (!confirm("Nextcloud-Verbindung wirklich trennen? Der Abgleich wird damit deaktiviert.")) return;
    await fetch("/api/einstellungen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "system.nextcloud.appPassword", value: "" }) });
    // Status der einmaligen Datenübernahme zurücksetzen — beim Trennen und erneuten
    // Verbinden (auch mit einer anderen Nextcloud-Instanz) soll die Übernahme wieder
    // frisch starten können, statt einen alten "Abgeschlossen"-Stand aus der vorherigen
    // Verbindung anzuzeigen. Bereits vorhandene Dateien werden beim erneuten Lauf ohnehin
    // übersprungen (dateiExistiert-Prüfung) — nur was am Ziel fehlt, wird übertragen.
    await fetch("/api/nextcloud/backfill", { method: "DELETE" }).catch(() => {});
    setBackfill(null);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    await ladeStatus();
  }

  async function backfillZuruecksetzen() {
    setBackfillFehler("");
    const res = await fetch("/api/nextcloud/backfill", { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBackfillFehler(json.error ?? "Status konnte nicht zurückgesetzt werden");
      return;
    }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setBackfill(null);
  }

  async function speichereZentralOrdner() {
    if (!neuerOrdnerName.trim() || !neuerOrdnerPfad.trim()) return;
    const neu = [...zentralOrdner, { name: neuerOrdnerName.trim(), pfad: neuerOrdnerPfad.trim().replace(/^\/+/, "") }];
    setZentralSaving(true);
    await fetch("/api/einstellungen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "system.nextcloud.zentralOrdner", value: JSON.stringify(neu) }) });
    setZentralOrdner(neu);
    setNeuerOrdnerName("");
    setNeuerOrdnerPfad("");
    setZentralSaving(false);
  }

  async function loescheZentralOrdner(idx: number) {
    const neu = zentralOrdner.filter((_, i) => i !== idx);
    await fetch("/api/einstellungen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "system.nextcloud.zentralOrdner", value: JSON.stringify(neu) }) });
    setZentralOrdner(neu);
  }

  async function backfillStarten() {
    setBackfillFehler("");
    const res = await fetch("/api/nextcloud/backfill", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setBackfillFehler(json.error ?? "Backfill konnte nicht gestartet werden");
      return;
    }
    await ladeBackfillStatus();
    startePolling();
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="max-w-2xl">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-800 font-medium">Nextcloud</span>
      </nav>

      <h1 className="text-2xl font-bold mb-1">Nextcloud</h1>
      <p className="text-sm text-gray-500 mb-8">
        Dokumente für Kunden, Artikel und Buchhaltung automatisch in Nextcloud ablegen —
        Rechnungen, Lieferscheine, Nachweise und Belege landen in einer festen Ordnerstruktur.
      </p>

      {/* ── Status ─────────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Verbindungsstatus</h2>
        {statusLoading ? (
          <p className="text-sm text-gray-400">Verbindung wird geprüft…</p>
        ) : status?.verbunden ? (
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
            <span className="text-sm text-green-700 font-medium">Verbunden</span>
            <button onClick={trennen} className="ml-auto text-sm text-red-600 hover:underline">
              Verbindung trennen
            </button>
          </div>
        ) : status?.konfiguriert ? (
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
            <span className="text-sm text-red-700">
              Verbindung fehlgeschlagen{status.fehler ? `: ${status.fehler}` : ""}
            </span>
            <button onClick={trennen} className="ml-auto text-sm text-gray-500 hover:underline">
              Zugangsdaten entfernen
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-gray-300 inline-block"></span>
            <span className="text-sm text-gray-500">Nicht konfiguriert</span>
          </div>
        )}
      </section>

      {/* ── Einrichtung ─────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Zugangsdaten</h2>

        <div className="space-y-3 mb-5 text-sm text-gray-500">
          <p>
            In Nextcloud unter <span className="font-medium text-gray-700">Einstellungen → Sicherheit</span> ein
            neues <span className="font-medium text-gray-700">App-Passwort</span> erzeugen und hier eintragen —
            kein normales Konto-Passwort verwenden.
          </p>
        </div>

        {fehler && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{fehler}</p>
        )}
        {saved && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-3">
            Gespeichert. Verbindung wird geprüft…
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Server-URL</label>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="https://cloud.beispiel.de" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Benutzername</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">App-Passwort</label>
            <input type="password" value={appPassword} onChange={(e) => setAppPassword(e.target.value)} placeholder={status?.konfiguriert ? "•••••••• (unverändert lassen zum Beibehalten)" : ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Root-Ordner</label>
            <input type="text" value={rootPfad} onChange={(e) => setRootPfad(e.target.value)} className={inputCls} />
          </div>
        </div>

        <button
          onClick={speichern}
          disabled={saving || !serverUrl.trim() || !username.trim()}
          className="mt-4 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? "Wird gespeichert…" : "Speichern & verbinden"}
        </button>
      </section>

      {/* ── Zentrale Ordner ─────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Zentrale Ordner</h2>
        <p className="text-sm text-gray-500 mb-4">
          Häufig genutzte Ordner unter <code className="text-xs bg-gray-100 px-1 rounded">Zentral/</code> benennen und verknüpfen.
        </p>

        {zentralOrdner.length > 0 && (
          <ul className="space-y-2 mb-4">
            {zentralOrdner.map((o, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">📁</span>
                <span className="font-medium text-gray-800">{o.name}</span>
                <span className="text-xs text-gray-400">Zentral/{o.pfad}</span>
                <button onClick={() => loescheZentralOrdner(i)} className="ml-auto text-xs text-red-500 hover:underline">
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input type="text" value={neuerOrdnerName} onChange={(e) => setNeuerOrdnerName(e.target.value)} placeholder="Name (z.B. Verträge)" className={`${inputCls} flex-1`} />
          <input type="text" value={neuerOrdnerPfad} onChange={(e) => setNeuerOrdnerPfad(e.target.value)} placeholder="Unterordner (z.B. Vertraege)" className={`${inputCls} flex-1`} />
          <button
            onClick={speichereZentralOrdner}
            disabled={zentralSaving || !neuerOrdnerName.trim() || !neuerOrdnerPfad.trim()}
            className="px-3 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50 whitespace-nowrap"
          >
            Hinzufügen
          </button>
        </div>
      </section>

      {/* ── Einmalige Datenübernahme ────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-2">Einmalige Datenübernahme</h2>
        <p className="text-sm text-gray-500 mb-4">
          Überträgt bestehende Nachweise, Belege und bereits erzeugte Rechnungen/Lieferscheine/Gutschriften
          einmalig in die Nextcloud-Ordnerstruktur. Kann gefahrlos mehrfach ausgeführt werden — bereits
          übertragene Dateien werden übersprungen.
        </p>

        {backfillFehler && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{backfillFehler}</p>
        )}

        {backfill?.laufend && backfill.verwaist && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
            Seit über 15 Minuten kein Fortschritt — der letzte Lauf wurde vermutlich durch einen
            Neustart (z.B. ein Deployment) unterbrochen. Mit „Zurücksetzen" kann ein neuer Lauf
            gestartet werden; bereits übertragene Dateien werden dabei übersprungen.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={backfillStarten}
            disabled={(backfill?.laufend && !backfill.verwaist) || !status?.verbunden}
            className="px-4 py-2 bg-white border border-green-300 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 disabled:opacity-50"
          >
            {backfill?.laufend && !backfill.verwaist ? "Läuft…" : "Bestehende Dokumente übertragen"}
          </button>
          {backfill && (backfill.laufend || backfill.beendet) && (
            <button
              onClick={backfillZuruecksetzen}
              disabled={backfill.laufend && !backfill.verwaist}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
              title={backfill.laufend && !backfill.verwaist ? "Läuft noch — erst abwarten oder auf Verwaist-Erkennung warten" : "Status leeren, ohne bereits übertragene Dateien erneut hochzuladen"}
            >
              Zurücksetzen
            </button>
          )}
        </div>

        {backfill && (backfill.laufend || backfill.beendet) && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-gray-600">{backfill.aktuellerSchritt}</p>
            {backfill.gesamt && (
              <p className="text-gray-500">
                {backfill.gesamt.verarbeitet} verarbeitet · {backfill.gesamt.hochgeladen} hochgeladen ·{" "}
                {backfill.gesamt.uebersprungen} bereits vorhanden ·{" "}
                <span className={backfill.gesamt.fehler > 0 ? "text-red-600" : ""}>{backfill.gesamt.fehler} fehlgeschlagen</span>
              </p>
            )}
            {!!backfill.fehlerListe?.length && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">Fehlerdetails ({backfill.fehlerListe.length})</summary>
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {backfill.fehlerListe.map((f, i) => (
                    <li key={i}>{f.entitaet} #{f.id}: {f.fehler}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
