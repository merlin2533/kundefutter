"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface DriveStatus {
  konfiguriert: boolean;
  verbunden: boolean;
  email?: string;
  fehler?: string;
}

interface ZentralOrdner {
  name: string;
  id: string;
}

export default function GoogleDriveEinstellungenPage() {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [keyText, setKeyText] = useState("");
  const [keyError, setKeyError] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [zentralOrdner, setZentralOrdner] = useState<ZentralOrdner[]>([]);
  const [neuerOrdnerName, setNeuerOrdnerName] = useState("");
  const [neuerOrdnerId, setNeuerOrdnerId] = useState("");
  const [zentralSaving, setZentralSaving] = useState(false);

  useEffect(() => {
    ladeStatus();
    ladeZentralOrdner();
  }, []);

  async function ladeStatus() {
    setStatusLoading(true);
    const res = await fetch("/api/drive/status");
    setStatus(await res.json());
    setStatusLoading(false);
  }

  async function ladeZentralOrdner() {
    const einst = await fetch("/api/einstellungen?prefix=system.google.").then((r) => r.json());
    if (einst["system.google.zentralOrdnerIds"]) {
      try { setZentralOrdner(JSON.parse(einst["system.google.zentralOrdnerIds"])); } catch { /* ignore */ }
    }
  }

  async function speichereKey() {
    setKeyError("");
    setKeySaved(false);
    let parsed: object;
    try {
      parsed = JSON.parse(keyText);
    } catch {
      setKeyError("Ungültiges JSON — bitte den vollständigen Service Account Key einfügen.");
      return;
    }
    if (!("type" in parsed) || (parsed as Record<string, unknown>)["type"] !== "service_account") {
      setKeyError("Das ist kein Service Account Key. Das JSON muss \"type\": \"service_account\" enthalten.");
      return;
    }

    setKeySaving(true);
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "system.google.serviceAccountKey", value: keyText }),
    });
    setKeySaving(false);
    setKeySaved(true);
    setKeyText("");
    await ladeStatus();
  }

  async function loescheKey() {
    if (!confirm("Service Account Key wirklich entfernen? Die Drive-Integration wird damit deaktiviert.")) return;
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "system.google.serviceAccountKey", value: "" }),
    });
    // Ordner-IDs zurücksetzen
    for (const key of ["system.google.rootOrdnerId", "system.google.kundenOrdnerId", "system.google.artikelOrdnerId"]) {
      await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: "" }),
      });
    }
    await ladeStatus();
  }

  async function speichereZentralOrdner() {
    if (!neuerOrdnerName.trim() || !neuerOrdnerId.trim()) return;
    const neu = [...zentralOrdner, { name: neuerOrdnerName.trim(), id: neuerOrdnerId.trim() }];
    setZentralSaving(true);
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "system.google.zentralOrdnerIds", value: JSON.stringify(neu) }),
    });
    setZentralOrdner(neu);
    setNeuerOrdnerName("");
    setNeuerOrdnerId("");
    setZentralSaving(false);
  }

  async function loescheZentralOrdner(idx: number) {
    const neu = zentralOrdner.filter((_, i) => i !== idx);
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "system.google.zentralOrdnerIds", value: JSON.stringify(neu) }),
    });
    setZentralOrdner(neu);
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-800 font-medium">Google Drive</span>
      </nav>

      <h1 className="text-2xl font-bold mb-1">Google Drive</h1>
      <p className="text-sm text-gray-500 mb-8">
        Dokumente für Kunden und Artikel automatisch in Google Drive ablegen.
      </p>

      {/* ── Status ─────────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Verbindungsstatus</h2>
        {statusLoading ? (
          <p className="text-sm text-gray-400">Verbindung wird geprüft…</p>
        ) : status?.verbunden ? (
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
            <span className="text-sm text-green-700 font-medium">
              Verbunden{status.email ? ` als ${status.email}` : ""}
            </span>
            <button onClick={loescheKey} className="ml-auto text-sm text-red-600 hover:underline">
              Verbindung trennen
            </button>
          </div>
        ) : status?.konfiguriert ? (
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
            <span className="text-sm text-red-700">
              Verbindung fehlgeschlagen{status.fehler ? `: ${status.fehler}` : ""}
            </span>
            <button onClick={loescheKey} className="ml-auto text-sm text-gray-500 hover:underline">
              Key entfernen
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
      {!status?.verbunden && (
        <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Einmalige Einrichtung (ca. 10 Minuten)</h2>

          <div className="space-y-4 mb-6">
            {/* Schritt 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-700 text-white text-xs font-bold flex items-center justify-center">1</div>
              <div>
                <p className="text-sm font-medium text-gray-800">Google Cloud Console öffnen</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Gehe zu{" "}
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded">console.cloud.google.com</span>
                  {" "}und wähle ein bestehendes Projekt aus oder erstelle ein neues.
                </p>
              </div>
            </div>

            {/* Schritt 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-700 text-white text-xs font-bold flex items-center justify-center">2</div>
              <div>
                <p className="text-sm font-medium text-gray-800">Google Drive API aktivieren</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Im linken Menü: <span className="font-medium text-gray-700">APIs &amp; Dienste → Bibliothek</span> → nach „Google Drive API" suchen → aktivieren.
                </p>
              </div>
            </div>

            {/* Schritt 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-700 text-white text-xs font-bold flex items-center justify-center">3</div>
              <div>
                <p className="text-sm font-medium text-gray-800">Dienstkonto erstellen</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  <span className="font-medium text-gray-700">IAM &amp; Verwaltung → Dienstkonten → Dienstkonto erstellen</span>.
                  Namen vergeben (z.B. „agraroffice-drive"), Rolle kann leer bleiben.
                </p>
              </div>
            </div>

            {/* Schritt 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-700 text-white text-xs font-bold flex items-center justify-center">4</div>
              <div>
                <p className="text-sm font-medium text-gray-800">JSON-Key herunterladen</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Das neu erstellte Dienstkonto anklicken → Reiter <span className="font-medium text-gray-700">Schlüssel</span> → <span className="font-medium text-gray-700">Schlüssel hinzufügen → JSON</span> → herunterladen.
                  Es wird eine <span className="font-mono text-xs bg-gray-100 px-1 rounded">.json</span>-Datei gespeichert.
                </p>
              </div>
            </div>

            {/* Schritt 5 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-700 text-white text-xs font-bold flex items-center justify-center">5</div>
              <div>
                <p className="text-sm font-medium text-gray-800">Key hier einfügen &amp; verbinden</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Die heruntergeladene JSON-Datei in einem Texteditor öffnen, den gesamten Inhalt kopieren und unten einfügen.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-gray-200 mb-5" />

          {keyError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
              {keyError}
            </p>
          )}
          {keySaved && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-3">
              Key gespeichert. Verbindung wird geprüft…
            </p>
          )}

          <textarea
            value={keyText}
            onChange={(e) => setKeyText(e.target.value)}
            placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
            rows={8}
            className={`${inputCls} font-mono text-xs`}
          />
          <button
            onClick={speichereKey}
            disabled={keySaving || !keyText.trim()}
            className="mt-3 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50"
          >
            {keySaving ? "Wird gespeichert…" : "Key speichern & verbinden"}
          </button>
        </section>
      )}

      {/* ── Zentrale Ordner ─────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Zentrale Ordner</h2>
        <p className="text-sm text-gray-500 mb-4">
          Hier kannst du häufig genutzte Drive-Ordner benennen und verknüpfen.
          Die Ordner-ID findest du in der URL des Drive-Ordners:
          <code className="ml-1 text-xs bg-gray-100 px-1 rounded">
            drive.google.com/drive/folders/<strong>ORDNER-ID</strong>
          </code>
        </p>

        {zentralOrdner.length > 0 && (
          <ul className="space-y-2 mb-4">
            {zentralOrdner.map((o, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">📁</span>
                <a
                  href={`https://drive.google.com/drive/folders/${o.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-green-700 hover:underline"
                >
                  {o.name}
                </a>
                <button
                  onClick={() => loescheZentralOrdner(i)}
                  className="ml-auto text-xs text-red-500 hover:underline"
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={neuerOrdnerName}
            onChange={(e) => setNeuerOrdnerName(e.target.value)}
            placeholder="Name (z.B. Verträge)"
            className={`${inputCls} flex-1`}
          />
          <input
            type="text"
            value={neuerOrdnerId}
            onChange={(e) => setNeuerOrdnerId(e.target.value)}
            placeholder="Ordner-ID"
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={speichereZentralOrdner}
            disabled={zentralSaving || !neuerOrdnerName.trim() || !neuerOrdnerId.trim()}
            className="px-3 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50 whitespace-nowrap"
          >
            Hinzufügen
          </button>
        </div>
      </section>

      {/* ── Hinweis ─────────────────────────────────────────────────────── */}
      {status?.verbunden && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>Tipp:</strong> Die Ordner in Google Drive liegen unter dem Service Account.
          Damit du sie in deinem eigenen Drive siehst: Öffne Google Drive, suche den Ordner
          „AgrarOffice" unter „Für mich freigegeben" und füge ihn zu deiner Ablage hinzu.
        </div>
      )}
    </div>
  );
}
