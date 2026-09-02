"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  DEFAULT_SAATGUT_KULTUREN,
  DEFAULT_EINHEITEN,
  DEFAULT_ARTIKEL_KATEGORIEN,
  DEFAULT_UNTERKATEGORIEN,
  DEFAULT_LAGERORTE,
  DEFAULT_FRUCHTARTEN,
  getUnterkategorienKey,
  parseListSetting,
} from "@/lib/auswahllisten";

const DEFAULT_NOTIZ_THEMEN = ["Info", "Wichtig", "Offener Punkt", "Erledigt", "Rückruf", "Angebot"];
const DEFAULT_GUTSCHRIFT_GRUENDE = ["Reklamation", "Retoure", "Preiskorrektur", "Sonstiges"];

function EditableList({
  title,
  description,
  storeKey,
  defaultItems,
  placeholder,
}: {
  title: string;
  description: string;
  storeKey: string;
  defaultItems?: string[];
  placeholder: string;
}) {
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.ok ? r.json() : {})
      .then((d: Record<string, string>) => {
        if (d[storeKey]) {
          try {
            setItems(JSON.parse(d[storeKey]));
          } catch (err) {
            Sentry.captureException(err);
            /* ignore */
          }
        } else if (defaultItems) {
          setItems(defaultItems);
        }
        setLoaded(true);
      })
      .catch((err) => {
        Sentry.captureException(err);
        return setLoaded(true);
      });
  }, [storeKey, defaultItems]);

  async function save(list: string[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: storeKey, value: JSON.stringify(list) }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  function addItem() {
    const v = newItem.trim();
    if (!v || items.includes(v)) return;
    const next = [...items, v];
    setItems(next);
    setNewItem("");
    save(next);
  }

  function removeItem(item: string) {
    const next = items.filter((i) => i !== item);
    setItems(next);
    save(next);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-3">{description}</p>
      {saved && <p className="text-xs text-green-600 mb-2">✓ Gespeichert</p>}
      {!loaded ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {items.map((item) => (
              <span
                key={item}
                className="flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 px-3 py-1 rounded-full text-sm"
              >
                {item}
                <button
                  onClick={() => removeItem(item)}
                  className="ml-1 text-green-600 hover:text-red-600 leading-none text-base"
                  disabled={saving}
                >
                  ×
                </button>
              </span>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-400">Noch keine Einträge vorhanden</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
              placeholder={placeholder}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={addItem}
              disabled={!newItem.trim() || saving}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              + Hinzufügen
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SubkategorienSection() {
  const [kategorien, setKategorien] = useState<string[]>(DEFAULT_ARTIKEL_KATEGORIEN);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.ok ? r.json() : {})
      .then((d: Record<string, string>) => {
        setKategorien(parseListSetting(d, "system.artikelkategorien", DEFAULT_ARTIKEL_KATEGORIEN));
        setLoaded(true);
      })
      .catch((err) => {
        Sentry.captureException(err);
        return setLoaded(true);
      });
  }, []);

  if (!loaded) return <p className="text-sm text-gray-400 p-4">Lade…</p>;

  return (
    <div className="flex flex-col gap-4">
      {kategorien.map((k) => (
        <EditableList
          key={k}
          title={`Unterkategorien: ${k === "Duenger" ? "Dünger" : k}`}
          description={`Sub-Kategorien für Artikel der Kategorie „${k === "Duenger" ? "Dünger" : k}". Erscheinen als Filter und Dropdown bei Artikel-Erfassung.`}
          storeKey={getUnterkategorienKey(k)}
          defaultItems={DEFAULT_UNTERKATEGORIEN[k]}
          placeholder="z.B. neue Unterkat."
        />
      ))}
    </div>
  );
}

interface UnregistrierterEintrag {
  wert: string;
  anzahl: number;
}

/** Zeigt je Kategorie Unterkategorie-Werte, die auf Artikeln tatsächlich verwendet werden, aber
 *  nicht in der Liste oben registriert sind (z.B. "Einzelkomponenten" statt "Einzelkomponente" —
 *  meist aus einem Import, der die Unterkategorie ungeprüft übernimmt). Bewusst KEIN
 *  automatisches Zusammenführen ähnlicher Werte (Singular/Plural o.ä. ist bei deutschen Wörtern
 *  nicht zuverlässig automatisierbar, siehe resolveKategorie()) — der Nutzer wählt das Ziel
 *  bewusst selbst aus. */
function UnregistrierteUnterkategorien() {
  const [daten, setDaten] = useState<Record<string, UnregistrierterEintrag[]>>({});
  const [registriert, setRegistriert] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [ziel, setZiel] = useState<Record<string, string>>({}); // key: `${kategorie}|${wert}` -> Zielwert
  const [saving, setSaving] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/artikel/unterkategorien-unregistriert").then((r) => (r.ok ? r.json() : {})),
      fetch("/api/einstellungen?prefix=system.").then((r) => (r.ok ? r.json() : {})),
    ])
      .then(([unreg, settings]: [Record<string, UnregistrierterEintrag[]>, Record<string, string>]) => {
        setDaten(unreg);
        const kategorien = parseListSetting(settings, "system.artikelkategorien", DEFAULT_ARTIKEL_KATEGORIEN);
        const reg: Record<string, string[]> = {};
        for (const k of kategorien) {
          reg[k] = parseListSetting(settings, getUnterkategorienKey(k), DEFAULT_UNTERKATEGORIEN[k] ?? []);
        }
        setRegistriert(reg);
        setLoaded(true);
      })
      .catch((err) => {
        Sentry.captureException(err);
        setLoaded(true);
      });
  }, []);

  async function zusammenfuehren(kategorie: string, von: string) {
    const key = `${kategorie}|${von}`;
    const zu = ziel[key];
    if (!zu) return;
    if (!confirm(`„${von}" in „${zu}" zusammenführen? Betroffene Artikel werden auf „${zu}" umgestellt.`)) return;
    setSaving(key);
    setMeldung(null);
    try {
      const res = await fetch("/api/artikel/kategorien", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "unterkategorie_umbenennen", kategorie, von, zu }),
      });
      const d = await res.json().catch((err) => {
        Sentry.captureException(err);
        return {};
      });
      if (!res.ok) {
        setMeldung({ text: d.error ?? "Fehler beim Zusammenführen", kind: "err" });
        return;
      }
      setMeldung({ text: `„${von}" → „${zu}" (${d.aktualisiert} Artikel aktualisiert)`, kind: "ok" });
      setDaten((prev) => ({ ...prev, [kategorie]: (prev[kategorie] ?? []).filter((e) => e.wert !== von) }));
    } catch (err) {
      Sentry.captureException(err);
      setMeldung({ text: "Netzwerkfehler", kind: "err" });
    } finally {
      setSaving(null);
      setTimeout(() => setMeldung(null), 4000);
    }
  }

  if (!loaded) return null;
  const kategorienMitEintraegen = Object.keys(daten).filter((k) => daten[k]?.length > 0);
  // Erst ausblenden, wenn wirklich nichts mehr übrig ist UND keine frische Erfolgsmeldung mehr
  // angezeigt wird — sonst verschwindet beim Zusammenführen des letzten Eintrags einer Kategorie
  // die gesamte Karte inkl. Bestätigung sofort, bevor der Nutzer sie lesen konnte.
  if (kategorienMitEintraegen.length === 0 && !meldung) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">Nicht registrierte Unterkategorien</h2>
      <p className="text-sm text-gray-500 mb-4">
        Diese Werte werden auf Artikeln verwendet, stehen aber nicht in den Unterkategorien-Listen
        oben — meist aus einem Import, der die Unterkategorie ungeprüft übernimmt. Handelt es sich
        um denselben Wert wie ein bereits registrierter (z.B. „Einzelkomponenten“ statt
        „Einzelkomponente“), führen Sie ihn hier zusammen. Ist der Wert eigenständig korrekt,
        lassen Sie ihn unverändert oder tragen Sie ihn oben in die passende Liste ein.
      </p>
      {meldung && (
        <p className={`text-sm mb-3 ${meldung.kind === "ok" ? "text-green-700" : "text-red-600"}`}>
          {meldung.kind === "ok" ? "✓ " : "⚠ "}{meldung.text}
        </p>
      )}
      <div className="flex flex-col gap-4">
        {kategorienMitEintraegen.map((kat) => (
          <div key={kat}>
            <p className="text-sm font-semibold text-gray-700 mb-2">{kat === "Duenger" ? "Dünger" : kat}</p>
            <div className="space-y-2">
              {daten[kat].map((e) => {
                const key = `${kat}|${e.wert}`;
                const optionen = registriert[kat] ?? [];
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-gray-900">{e.wert}</span>
                    <span className="text-xs text-gray-400">
                      {e.anzahl} Artikel
                    </span>
                    {optionen.length > 0 ? (
                      <>
                        <span className="text-gray-300">→</span>
                        <select
                          value={ziel[key] ?? ""}
                          onChange={(ev) => setZiel((prev) => ({ ...prev, [key]: ev.target.value }))}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">— Ziel wählen —</option>
                          {optionen.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => zusammenfuehren(kat, e.wert)}
                          disabled={!ziel[key] || saving === key}
                          className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 transition-colors"
                        >
                          {saving === key ? "…" : "Zusammenführen"}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">
                        (noch keine Unterkategorien für „{kat === "Duenger" ? "Dünger" : kat}“ registriert)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StammdatenPage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">
          Einstellungen
        </Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Stammdaten</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Stammdaten</h1>

      <div className="flex flex-col gap-6">
        <EditableList
          title="Kundenkategorien"
          description="Kategorien zur Klassifizierung von Kunden (z.B. Landwirt, Händler, Genossenschaft)."
          storeKey="system.kundenkategorien"
          placeholder="z.B. Landwirt"
        />
        <EditableList
          title="Mitarbeiter"
          description="Liste der Mitarbeiter für Zuordnungen in CRM und Touren."
          storeKey="system.mitarbeiter"
          placeholder="z.B. Max Mustermann"
        />
        <EditableList
          title="Artikel-Kategorien"
          description="Haupt-Kategorien für Artikel (Futter, Dünger, Saatgut, Pflege …). Erscheinen als Filter und Dropdown bei Artikel-Erfassung."
          storeKey="system.artikelkategorien"
          defaultItems={DEFAULT_ARTIKEL_KATEGORIEN}
          placeholder="z.B. Pflege"
        />
        <EditableList
          title="Einheiten"
          description="Mengeneinheiten für Artikel (kg, t, dt, l, Stk, km …)."
          storeKey="system.einheiten"
          defaultItems={DEFAULT_EINHEITEN}
          placeholder="z.B. Fass"
        />
        <EditableList
          title="Lagerorte"
          description="Vordefinierte Lagerort-Bezeichnungen (Halle 1, Silo A …). Erscheinen als Vorschlagsliste beim Anlegen und Bearbeiten von Artikeln."
          storeKey="system.lagerorte"
          defaultItems={DEFAULT_LAGERORTE}
          placeholder="z.B. Halle 1"
        />
        <EditableList
          title="Fruchtarten (Schlagkartei)"
          description="Fruchtarten für die Schlagkartei (Winterweizen, Raps, Mais …). Erscheinen als Vorschläge beim Anlegen von Schlägen."
          storeKey="system.fruchtarten"
          defaultItems={DEFAULT_FRUCHTARTEN}
          placeholder="z.B. Winterweizen"
        />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-1">Unterkategorien</h2>
          <p className="text-sm text-gray-500 mb-4">
            Sub-Kategorien je Artikel-Kategorie. Werden als Dropdown bei der Artikel-Erfassung und als Filter in der Artikelliste angezeigt.
          </p>
          <SubkategorienSection />
        </div>

        <UnregistrierteUnterkategorien />

        <EditableList
          title="Notiz-Themen"
          description="Kategorien für Kundennotizen (z.B. Wichtig, Info, Offener Punkt)."
          storeKey="system.notiz_themen"
          defaultItems={DEFAULT_NOTIZ_THEMEN}
          placeholder="z.B. Reklamation"
        />
        <EditableList
          title="Gutschrift-Gründe"
          description="Gründe für Gutschriften und Retouren."
          storeKey="system.gutschrift_gruende"
          defaultItems={DEFAULT_GUTSCHRIFT_GRUENDE}
          placeholder="z.B. Transportschaden"
        />

        {/* Kundenimport */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-800">Kundenimport</h2>
              <p className="text-sm text-gray-500 mt-1">
                Excel- oder CSV-Datei hochladen und Kunden-Stammdaten importieren.
                Unterstützte Spalten: Name, Firma, Kategorie, Strasse, PLZ, Ort, Land, Telefon, Mobil, E-Mail, Notizen.
              </p>
            </div>
            <Link
              href="/kundenimport"
              className="whitespace-nowrap px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
            >
              → Importieren
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
