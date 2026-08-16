"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import { receiptNumberHit } from "@/lib/bankabgleich-matching";
import SearchableSelect from "@/components/SearchableSelect";
import * as Sentry from "@sentry/nextjs";

export interface WeitereZuordnung {
  id: number;
  lieferungId: number | null;
  sammelrechnungId: number | null;
  rechnungNr: string | null;
  kundeName: string | null;
}

interface OffeneRechnungOption {
  typ: "lieferung" | "sammelrechnung";
  id: number;
  rechnungNr: string;
  betrag: number;
}

interface Props {
  umsatzId: number;
  /** Kunde der Haupt-Zuordnung — weitere Rechnungen werden auf denselben Kunden eingeschränkt. */
  kundeId: number | null;
  /** Verwendungszweck des Kontoumsatzes — wird genutzt, um offene Rechnungen zu markieren, deren
   * Rechnungsnummer darin vorkommt (z.B. Kunde nennt mehrere Rechnungsnummern in einer
   * Sammelüberweisung). Rein ein Hinweis, kein automatisches Hinzufügen. */
  verwendungszweck: string;
  weitereZuordnungen: WeitereZuordnung[];
  onChange: () => void;
}

/**
 * Zusatz-Panel für einen bereits zugeordneten Kontoumsatz: ein Kunde begleicht in EINER
 * Überweisung oft mehrere offene Rechnungen — die Haupt-Zuordnung deckt nur eine davon ab. Hier
 * lassen sich weitere offene Rechnungen DESSELBEN Kunden dazu erfassen; jede wird beim Hinzufügen
 * genauso wie die Haupt-Rechnung als bezahlt markiert (siehe /api/bankabgleich/[id]/weitere).
 */
export default function WeitereRechnungenPanel({ umsatzId, kundeId, verwendungszweck, weitereZuordnungen, onChange }: Props) {
  const [offene, setOffene] = useState<OffeneRechnungOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [auswahl, setAuswahl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!kundeId) { setOffene([]); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/lieferungen?kundeId=${kundeId}&rechnungOffen=true&limit=100`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/sammelrechnungen?kundeId=${kundeId}&status=offen`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([lieferungenRes, sammelRes]) => {
        const lieferungen: { id: number; rechnungNr: string | null; positionen?: { menge: number; verkaufspreis: number; rabattProzent: number | null }[] }[] =
          Array.isArray(lieferungenRes) ? lieferungenRes : [];
        const sammel: { id: number; rechnungNr: string | null; lieferungen?: { positionen: { menge: number; verkaufspreis: number; rabattProzent: number | null }[] }[] }[] =
          Array.isArray(sammelRes) ? sammelRes : [];
        const posNetto = (p: { menge: number; verkaufspreis: number; rabattProzent: number | null }) =>
          p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100);
        const lieferungOptions: OffeneRechnungOption[] = lieferungen
          .filter((l) => l.rechnungNr)
          .map((l) => ({
            typ: "lieferung" as const,
            id: l.id,
            rechnungNr: l.rechnungNr as string,
            betrag: (l.positionen ?? []).reduce((s, p) => s + posNetto(p), 0),
          }));
        const sammelOptions: OffeneRechnungOption[] = sammel
          .filter((s) => s.rechnungNr)
          .map((s) => ({
            typ: "sammelrechnung" as const,
            id: s.id,
            rechnungNr: s.rechnungNr as string,
            betrag: (s.lieferungen ?? []).reduce((sum, l) => sum + l.positionen.reduce((ps, p) => ps + posNetto(p), 0), 0),
          }));
        setOffene([...lieferungOptions, ...sammelOptions]);
      })
      .catch((err) => {
        Sentry.captureException(err);
      })
      .finally(() => setLoading(false));
  }, [kundeId]);

  const bereitsZugeordnetIds = new Set(weitereZuordnungen.map((w) => `${w.lieferungId ? "lieferung" : "sammelrechnung"}:${w.lieferungId ?? w.sammelrechnungId}`));
  // Rechnungen, deren Nummer im Verwendungszweck auftaucht, zuerst anzeigen — reiner Hinweis,
  // damit man bei mehreren offenen Rechnungen nicht raten muss, welche wohl gemeint ist. Kein
  // automatisches Hinzufügen, das bleibt bewusst ein expliziter Klick.
  const auswahlbar = offene
    .filter((o) => !bereitsZugeordnetIds.has(`${o.typ}:${o.id}`))
    .map((o) => ({ ...o, erkannt: receiptNumberHit(verwendungszweck, o.rechnungNr) > 0 }))
    .sort((a, b) => Number(b.erkannt) - Number(a.erkannt));

  async function hinzufuegen() {
    if (!auswahl) return;
    const [typ, idStr] = auswahl.split(":");
    setBusy(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/bankabgleich/${umsatzId}/weitere`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typ === "lieferung" ? { lieferungId: Number(idStr) } : { sammelrechnungId: Number(idStr) }),
      });
      if (!res.ok) {
        const d = await res.json().catch((err) => { Sentry.captureException(err); return {}; });
        throw new Error((d as { error?: string }).error ?? "Fehler beim Hinzufügen");
      }
      setAuswahl("");
      onChange();
    } catch (err) {
      Sentry.captureException(err);
      setFehler(err instanceof Error ? err.message : "Fehler beim Hinzufügen");
    } finally {
      setBusy(false);
    }
  }

  async function entfernen(zuordnungId: number) {
    if (!confirm("Diese weitere Rechnung wirklich entfernen? Falls dadurch als bezahlt markiert, wird sie wieder als offen geführt.")) return;
    setBusy(true);
    try {
      await fetch(`/api/bankabgleich/${umsatzId}/weitere?zuordnungId=${zuordnungId}`, { method: "DELETE" });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <h4 className="text-xs font-semibold text-gray-600 mb-2">
        Weitere Rechnungen, die mit dieser Zahlung beglichen wurden
      </h4>

      {weitereZuordnungen.length > 0 && (
        <ul className="space-y-1 mb-2">
          {weitereZuordnungen.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-2 text-xs bg-white border border-gray-200 rounded px-2.5 py-1.5">
              <span>
                {w.lieferungId ? (
                  <Link href={`/lieferungen/${w.lieferungId}`} className="underline text-green-700">
                    {w.rechnungNr ?? `Lieferung ${w.lieferungId}`}
                  </Link>
                ) : (
                  <Link href={`/lieferungen?sammelrechnungId=${w.sammelrechnungId}`} className="underline text-green-700">
                    {w.rechnungNr ?? `Sammelrechnung ${w.sammelrechnungId}`}
                  </Link>
                )}
                {w.kundeName && <span className="text-gray-400 ml-1.5">· {w.kundeName}</span>}
              </span>
              <button onClick={() => entfernen(w.id)} disabled={busy} className="text-gray-400 hover:text-red-600 disabled:opacity-50">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {fehler && <p className="text-xs text-red-600 mb-2">{fehler}</p>}

      {!kundeId ? (
        <p className="text-xs text-gray-400">Kunde der Haupt-Zuordnung konnte nicht ermittelt werden.</p>
      ) : loading ? (
        <p className="text-xs text-gray-400">Lade offene Rechnungen…</p>
      ) : auswahlbar.length === 0 ? (
        <p className="text-xs text-gray-400">Keine weiteren offenen Rechnungen dieses Kunden gefunden.</p>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-xs">
            <SearchableSelect
              options={auswahlbar.map((o) => ({
                value: `${o.typ}:${o.id}`,
                label: `${o.erkannt ? "✓ " : ""}${o.rechnungNr} — ${formatEuro(o.betrag)}${o.erkannt ? " (im Verwendungszweck erkannt)" : ""}`,
              }))}
              value={auswahl}
              onChange={setAuswahl}
              placeholder="Offene Rechnung wählen…"
            />
          </div>
          <button
            onClick={hinzufuegen}
            disabled={!auswahl || busy}
            className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium whitespace-nowrap"
          >
            {busy ? "…" : "+ Hinzufügen"}
          </button>
        </div>
      )}
    </div>
  );
}
