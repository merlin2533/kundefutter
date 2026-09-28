"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

type Provider = "imap" | "m365";

type Values = {
  "email.eingang.aktiv": string;
  "email.eingang.provider": Provider;
  "email.eingang.imap.host": string;
  "email.eingang.imap.port": string;
  "email.eingang.imap.user": string;
  "email.eingang.imap.passwort": string;
  "email.eingang.imap.ordner": string;
  "email.eingang.m365.tenantId": string;
  "email.eingang.m365.clientId": string;
  "email.eingang.m365.clientSecret": string;
  "email.eingang.m365.mailbox": string;
};

const DEFAULTS: Values = {
  "email.eingang.aktiv": "false",
  "email.eingang.provider": "imap",
  "email.eingang.imap.host": "",
  "email.eingang.imap.port": "993",
  "email.eingang.imap.user": "",
  "email.eingang.imap.passwort": "",
  "email.eingang.imap.ordner": "INBOX",
  "email.eingang.m365.tenantId": "",
  "email.eingang.m365.clientId": "",
  "email.eingang.m365.clientSecret": "",
  "email.eingang.m365.mailbox": "",
};

// Secrets: nie ins Formular laden, nur beim tatsächlichen Ändern durch den Nutzer mitsenden —
// identisches Muster wie smtp.password/resend.api_key auf /einstellungen/email.
const SENSITIVE_KEYS = new Set<keyof Values>(["email.eingang.imap.passwort", "email.eingang.m365.clientSecret"]);

interface ProtokollEintrag {
  id: number;
  provider: string;
  postfach: string;
  von: string;
  betreff: string | null;
  empfangenAm: string;
  status: "neu" | "rechnung_erkannt" | "keine_rechnung" | "fehler";
  anhaengeAnzahl: number;
  fehlerText: string | null;
  versuche: number;
  batchId: number | null;
}

const STATUS_LABELS: Record<ProtokollEintrag["status"], string> = {
  neu: "Wird verarbeitet…",
  rechnung_erkannt: "Rechnung erkannt",
  keine_rechnung: "Keine Rechnung",
  fehler: "Fehler",
};

const STATUS_COLORS: Record<ProtokollEintrag["status"], string> = {
  neu: "bg-gray-100 text-gray-600",
  rechnung_erkannt: "bg-green-100 text-green-800",
  keine_rechnung: "bg-gray-100 text-gray-600",
  fehler: "bg-red-100 text-red-700",
};

export default function EmailRechnungseingangPage() {
  const [values, setValues] = useState<Values>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [abrufLaeuft, setAbrufLaeuft] = useState(false);
  const [abrufMsg, setAbrufMsg] = useState("");
  const [imapPasswortSichtbar, setImapPasswortSichtbar] = useState(false);
  const [clientSecretSichtbar, setClientSecretSichtbar] = useState(false);
  const touchedSensitive = useRef<Set<keyof Values>>(new Set());
  const [hasImapPasswort, setHasImapPasswort] = useState(false);
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [protokoll, setProtokoll] = useState<ProtokollEintrag[]>([]);

  const ladeProtokoll = useCallback(() => {
    fetch("/api/einstellungen/email-eingang-protokoll")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setProtokoll(Array.isArray(d) ? d : []))
      .catch((err) => {
        Sentry.captureException(err);
      });
  }, []);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=email.eingang.")
      .then((r) => r.json())
      .then((d: Record<string, string>) => {
        setValues({
          "email.eingang.aktiv": d["email.eingang.aktiv"] ?? "false",
          "email.eingang.provider": d["email.eingang.provider"] === "m365" ? "m365" : "imap",
          "email.eingang.imap.host": d["email.eingang.imap.host"] ?? "",
          "email.eingang.imap.port": d["email.eingang.imap.port"] ?? "993",
          "email.eingang.imap.user": d["email.eingang.imap.user"] ?? "",
          "email.eingang.imap.passwort": "",
          "email.eingang.imap.ordner": d["email.eingang.imap.ordner"] ?? "INBOX",
          "email.eingang.m365.tenantId": d["email.eingang.m365.tenantId"] ?? "",
          "email.eingang.m365.clientId": d["email.eingang.m365.clientId"] ?? "",
          "email.eingang.m365.clientSecret": "",
          "email.eingang.m365.mailbox": d["email.eingang.m365.mailbox"] ?? "",
        });
        setHasImapPasswort(Boolean(d["email.eingang.imap.passwort"]));
        setHasClientSecret(Boolean(d["email.eingang.m365.clientSecret"]));
      })
      .finally(() => setLoading(false));
    ladeProtokoll();
  }, [ladeProtokoll]);

  function updateField<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (SENSITIVE_KEYS.has(key)) touchedSensitive.current.add(key);
  }

  async function saveAll(): Promise<boolean> {
    try {
      const keys = (Object.keys(DEFAULTS) as (keyof Values)[]).filter((key) => {
        if (SENSITIVE_KEYS.has(key) && !touchedSensitive.current.has(key)) return false;
        return true;
      });
      const results = await Promise.all(
        keys.map((key) =>
          fetch("/api/einstellungen", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value: values[key] }),
          })
        )
      );
      // Beim erstmaligen Aktivieren "aktivSeit" auf jetzt setzen — verhindert, dass ein
      // bestehendes Postfach mit vielen alten Mails auf einen Schlag komplett verarbeitet wird
      // (siehe lib/email-eingang-config.ts). Wird bewusst nur gesetzt, wenn noch keiner hinterlegt
      // ist — ein erneutes Speichern bei bereits aktiver Funktion darf das Datum nicht verschieben.
      if (values["email.eingang.aktiv"] === "true") {
        const aktivSeitRes = await fetch("/api/einstellungen?prefix=email.eingang.aktivSeit");
        const aktivSeitJson = aktivSeitRes.ok ? await aktivSeitRes.json() : {};
        if (!aktivSeitJson["email.eingang.aktivSeit"]) {
          await fetch("/api/einstellungen", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: "email.eingang.aktivSeit", value: new Date().toISOString() }),
          });
        }
      }
      return results.every((r) => r.ok);
    } catch (err) {
      Sentry.captureException(err);
      return false;
    }
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const ok = await saveAll();
    setMsg(ok ? "Gespeichert." : "Fehler beim Speichern.");
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setTestMsg("");
    const saved = await saveAll();
    if (!saved) {
      setTestMsg("Fehler beim Speichern der Einstellungen vor dem Test");
      setTesting(false);
      return;
    }
    try {
      const res = await fetch("/api/einstellungen/email-eingang-test", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setTestMsg(data.ok ? "Verbindung erfolgreich." : `Fehler: ${data.error ?? "Unbekannt"}`);
    } catch (err) {
      Sentry.captureException(err);
      setTestMsg("Verbindungstest fehlgeschlagen");
    } finally {
      setTesting(false);
    }
  }

  async function jetztAbrufen() {
    setAbrufLaeuft(true);
    setAbrufMsg("");
    const saved = await saveAll();
    if (!saved) {
      setAbrufMsg("Fehler beim Speichern der Einstellungen vor dem Abruf");
      setAbrufLaeuft(false);
      return;
    }
    try {
      const res = await fetch("/api/einstellungen/email-eingang/abrufen", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setAbrufMsg(`Fehler: ${data.error ?? "Unbekannt"}`);
      } else if (data.uebersprungen) {
        setAbrufMsg(data.uebersprungen);
      } else {
        setAbrufMsg(
          `${data.mailsAbgerufen} Mail(s) geprüft — ${data.rechnungenErkannt} mit erkannter Rechnung, ${data.keineRechnung} ohne, ${data.fehler} fehlgeschlagen.` +
            (data.rueckstand ? " Es könnten noch weitere Mails warten — beim nächsten Lauf geht es automatisch weiter." : "")
        );
      }
      ladeProtokoll();
    } catch (err) {
      Sentry.captureException(err);
      setAbrufMsg("Abruf fehlgeschlagen");
    } finally {
      setAbrufLaeuft(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Lade…</div>;

  const provider = values["email.eingang.provider"];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/einstellungen" className="text-gray-400 hover:text-gray-600 text-sm">← Einstellungen</Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Rechnungs-E-Mail-Eingang</h1>
      <p className="text-sm text-gray-500 mb-6">
        Eingehende E-Mails an eine Rechnungsadresse werden gelesen, ihre Anhänge klassifiziert
        (ist es eine Rechnung?) und bei einem Treffer per KI (Mistral) ausgewertet. Erkannte
        Rechnungen landen automatisch im{" "}
        <Link href="/eingangsrechnungen" className="text-green-700 hover:underline">Eingangsrechnungen-Eingang</Link>{" "}
        zur Prüfung — verbucht wird weiterhin manuell.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 mb-6">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={values["email.eingang.aktiv"] === "true"}
            onChange={(e) => updateField("email.eingang.aktiv", e.target.checked ? "true" : "false")}
            className="rounded"
          />
          Automatischen Abruf aktivieren (läuft alle ~30 Min. als Hintergrundjob)
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Postfach-Typ</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={provider === "imap"}
                onChange={() => updateField("email.eingang.provider", "imap")}
              />
              E-Mail-Postfach (IMAP)
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={provider === "m365"}
                onChange={() => updateField("email.eingang.provider", "m365")}
              />
              Microsoft 365
            </label>
          </div>
        </div>

        {provider === "imap" ? (
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              Zugangsdaten eines bestehenden Postfachs (z.B. rechnungen@ihredomain.de). Zum
              Abholen wird IMAP verwendet — SMTP kann nur senden, nicht empfangen. Nur
              verschlüsselte Verbindungen (Port 993) werden unterstützt.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">IMAP-Host</label>
                <input
                  type="text"
                  value={values["email.eingang.imap.host"]}
                  onChange={(e) => updateField("email.eingang.imap.host", e.target.value)}
                  placeholder="imap.ihredomain.de"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
                <input
                  type="number"
                  value={values["email.eingang.imap.port"]}
                  onChange={(e) => updateField("email.eingang.imap.port", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Benutzername</label>
                <input
                  type="text"
                  value={values["email.eingang.imap.user"]}
                  onChange={(e) => updateField("email.eingang.imap.user", e.target.value)}
                  placeholder="rechnungen@ihredomain.de"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Passwort</label>
                <div className="relative">
                  <input
                    type={imapPasswortSichtbar ? "text" : "password"}
                    autoComplete="new-password"
                    value={values["email.eingang.imap.passwort"]}
                    onChange={(e) => updateField("email.eingang.imap.passwort", e.target.value)}
                    placeholder={hasImapPasswort && !touchedSensitive.current.has("email.eingang.imap.passwort") ? "•••••••• (gespeichert)" : ""}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-16 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setImapPasswortSichtbar((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {imapPasswortSichtbar ? "Verbergen" : "Zeigen"}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ordner</label>
              <input
                type="text"
                value={values["email.eingang.imap.ordner"]}
                onChange={(e) => updateField("email.eingang.imap.ordner", e.target.value)}
                className="w-full sm:w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              Erfordert eine Azure-App-Registrierung mit Application-Permission{" "}
              <code className="bg-gray-100 px-1 rounded">Mail.Read</code> (Admin-Zustimmung nötig).
              Ohne eine zusätzliche „ApplicationAccessPolicy“ hat diese App-Berechtigung Lesezugriff
              auf alle Postfächer des Mandanten — nicht nur auf das unten eingetragene.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tenant-ID</label>
                <input
                  type="text"
                  value={values["email.eingang.m365.tenantId"]}
                  onChange={(e) => updateField("email.eingang.m365.tenantId", e.target.value)}
                  placeholder="contoso.onmicrosoft.com oder GUID"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Postfach-Adresse</label>
                <input
                  type="text"
                  value={values["email.eingang.m365.mailbox"]}
                  onChange={(e) => updateField("email.eingang.m365.mailbox", e.target.value)}
                  placeholder="rechnungen@ihredomain.de"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">App (Client-)ID</label>
                <input
                  type="text"
                  value={values["email.eingang.m365.clientId"]}
                  onChange={(e) => updateField("email.eingang.m365.clientId", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Client-Secret</label>
                <div className="relative">
                  <input
                    type={clientSecretSichtbar ? "text" : "password"}
                    autoComplete="new-password"
                    value={values["email.eingang.m365.clientSecret"]}
                    onChange={(e) => updateField("email.eingang.m365.clientSecret", e.target.value)}
                    placeholder={hasClientSecret && !touchedSensitive.current.has("email.eingang.m365.clientSecret") ? "•••••••• (gespeichert)" : ""}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-16 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setClientSecretSichtbar((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {clientSecretSichtbar ? "Verbergen" : "Zeigen"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={save}
            disabled={saving}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
          <button
            onClick={testConnection}
            disabled={testing}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? "Teste…" : "Verbindung testen"}
          </button>
          <button
            onClick={jetztAbrufen}
            disabled={abrufLaeuft}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {abrufLaeuft ? "Rufe ab…" : "Jetzt abrufen"}
          </button>
          {msg && <span className="text-sm text-gray-500">{msg}</span>}
        </div>
        {testMsg && <p className="text-sm text-gray-600">{testMsg}</p>}
        {abrufMsg && <p className="text-sm text-gray-600">{abrufMsg}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Protokoll der letzten Mails</h2>
        </div>
        {protokoll.length === 0 ? (
          <p className="p-5 text-sm text-gray-400">Noch keine Mails verarbeitet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Empfangen</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Von</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Betreff</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Eingang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {protokoll.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                      {new Date(p.empfangenAm).toLocaleString("de-DE")}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{p.von}</td>
                    <td className="px-4 py-2 text-gray-700">{p.betreff ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                      {p.status === "fehler" && p.fehlerText && (
                        <div className="text-xs text-gray-400 mt-0.5">{p.fehlerText}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {p.batchId ? (
                        <Link href={`/eingangsrechnungen/batch/${p.batchId}`} className="text-green-700 hover:underline text-xs font-medium">
                          Öffnen
                        </Link>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
