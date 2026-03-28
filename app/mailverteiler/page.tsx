"use client";
import { useEffect, useState, useCallback } from "react";

interface KundeKontakt {
  id: number;
  typ: string;
  wert: string;
  label: string | null;
}

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
  plz: string | null;
  ort: string | null;
  tags: string | null;
  aktiv: boolean;
  kontakte: KundeKontakt[];
}

function getEmail(k: Kunde): string {
  return k.kontakte?.find((c) => c.typ === "email")?.wert ?? "";
}

function parseTags(k: Kunde): string[] {
  try {
    return JSON.parse(k.tags ?? "[]");
  } catch {
    return [];
  }
}

function exportCsv(kunden: Kunde[]) {
  const rows = [
    ["Name", "Firma", "E-Mail", "PLZ", "Ort", "Tags"],
    ...kunden.map((k) => [
      k.name,
      k.firma ?? "",
      getEmail(k),
      k.plz ?? "",
      k.ort ?? "",
      parseTags(k).join(";"),
    ]),
  ];
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mailverteiler.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function MailverteilerPage() {
  const [allKunden, setAllKunden] = useState<Kunde[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [tagFilter, setTagFilter] = useState("");
  const [plzFilter, setPlzFilter] = useState("");
  const [nurAktive, setNurAktive] = useState(true);
  const [mindestUmsatz, setMindestUmsatz] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/kunden")
      .then((r) => r.json())
      .then((data: Kunde[]) => {
        setAllKunden(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Alle vorhandenen Tags sammeln
  const alleTags = Array.from(
    new Set(allKunden.flatMap((k) => parseTags(k)))
  ).sort();

  const gefiltertKunden = useCallback((): Kunde[] => {
    return allKunden.filter((k) => {
      if (nurAktive && !k.aktiv) return false;

      if (plzFilter.trim()) {
        if (!(k.plz ?? "").startsWith(plzFilter.trim())) return false;
      }

      if (tagFilter.trim()) {
        const suchTags = tagFilter
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        const kundeTags = parseTags(k).map((t) => t.toLowerCase());
        if (!suchTags.some((st) => kundeTags.includes(st))) return false;
      }

      // Nur Kunden mit E-Mail
      if (!getEmail(k)) return false;

      return true;
    });
  }, [allKunden, nurAktive, plzFilter, tagFilter]);

  const ergebnis = gefiltertKunden();

  function alleEmailsKopieren() {
    const emails = ergebnis.map(getEmail).filter(Boolean).join("; ");
    navigator.clipboard.writeText(emails).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function mailtoOeffnen() {
    const emails = ergebnis.map(getEmail).filter(Boolean).join(";");
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails)}`;
  }

  return (
    <main className="max-w-screen-xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mailverteiler</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Kunden nach Kriterien filtern und E-Mail-Adressen exportieren
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Filter</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tag-Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (kommagetrennt)
            </label>
            <input
              type="text"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="z.B. VIP, Newsletter"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {alleTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {alleTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const aktuell = tagFilter
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean);
                      if (aktuell.includes(tag)) {
                        setTagFilter(aktuell.filter((t) => t !== tag).join(", "));
                      } else {
                        setTagFilter([...aktuell, tag].join(", "));
                      }
                    }}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      tagFilter
                        .split(",")
                        .map((t) => t.trim())
                        .includes(tag)
                        ? "bg-green-100 border-green-400 text-green-800"
                        : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PLZ/Region */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PLZ / Region (beginnt mit)
            </label>
            <input
              type="text"
              value={plzFilter}
              onChange={(e) => setPlzFilter(e.target.value)}
              placeholder="z.B. 48"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          {/* Mindest-Umsatz (Hinweis: clientseitig nicht berechenbar ohne Lieferungen) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mindest-Umsatz (€, optional)
            </label>
            <input
              type="number"
              value={mindestUmsatz}
              onChange={(e) => setMindestUmsatz(e.target.value)}
              placeholder="z.B. 500"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {mindestUmsatz && (
              <p className="text-xs text-gray-400 mt-1">
                (Umsatzfilter noch nicht verfügbar — wird ignoriert)
              </p>
            )}
          </div>

          {/* Aktiv-Filter */}
          <div className="flex items-center gap-2 mt-6">
            <input
              id="nurAktive"
              type="checkbox"
              checked={nurAktive}
              onChange={(e) => setNurAktive(e.target.checked)}
              className="rounded border-gray-300 text-green-700 focus:ring-green-600"
            />
            <label htmlFor="nurAktive" className="text-sm text-gray-700 cursor-pointer">
              Nur aktive Kunden
            </label>
          </div>
        </div>
      </div>

      {/* Ergebnis-Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-gray-600">
          {loading ? "Lade…" : (
            <>
              <span className="font-semibold text-gray-900">{ergebnis.length}</span>
              {" "}Empfänger gefunden
              {allKunden.length > 0 && (
                <span className="text-gray-400 ml-1">
                  (von {allKunden.filter((k) => getEmail(k)).length} mit E-Mail)
                </span>
              )}
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={alleEmailsKopieren}
            disabled={ergebnis.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Kopiert!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
                Alle E-Mails kopieren
              </>
            )}
          </button>
          <button
            onClick={() => exportCsv(ergebnis)}
            disabled={ergebnis.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            CSV exportieren
          </button>
          <button
            onClick={mailtoOeffnen}
            disabled={ergebnis.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-green-700 hover:bg-green-800 text-white disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            mailto: Link öffnen
          </button>
        </div>
      </div>

      {/* Ergebnistabelle */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Lade Kunden…</div>
      ) : ergebnis.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          Keine Empfänger gefunden. Filter anpassen oder sicherstellen, dass Kunden E-Mail-Adressen hinterlegt haben.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Firma</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">E-Mail</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tags</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">PLZ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ort</th>
              </tr>
            </thead>
            <tbody>
              {ergebnis.map((k) => {
                const tags = parseTags(k);
                return (
                  <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                    <td className="px-4 py-3 text-gray-700">{k.firma ?? "—"}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${getEmail(k)}`}
                        className="text-green-700 hover:underline"
                      >
                        {getEmail(k)}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.length > 0 ? tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"
                          >
                            {tag}
                          </span>
                        )) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{k.plz ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{k.ort ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
