// Gemeinsame Fuzzy-Matching-Logik für KI-erkannte Lieferschein-/Bestellungsdaten
// (Kunde/Artikel-Zuordnung), genutzt sowohl vom Einzel-Scan (app/ki/lieferung,
// app/ki/wareneingang) als auch vom Batch-Modus (app/ki/lieferung/batch).

export type Konfidenz = "hoch" | "mittel" | "niedrig" | "keine" | "gelernt";

/**
 * Lädt eine paginierte Liste-API vollständig durch (alle Seiten), statt sich
 * auf ein festes Limit zu verlassen. Für die KI-Zuordnung muss immer der
 * komplette Artikel-/Kunden-/Lieferantenbestand im Client verfügbar sein —
 * ein starres Limit (z.B. 500) würde bei wachsendem Datenbestand irgendwann
 * wieder Einträge im Zuordnungs-Dropdown verschwinden lassen.
 */
export async function fetchAlleSeiten<T>(
  ladeSeite: (page: number) => Promise<{ items: T[]; total: number } | null>
): Promise<T[]> {
  const alle: T[] = [];
  let page = 1;
  for (;;) {
    const seite = await ladeSeite(page);
    if (!seite || seite.items.length === 0) break;
    alle.push(...seite.items);
    if (alle.length >= seite.total) break;
    page++;
  }
  return alle;
}

export function normalisiereSuchtext(text: string): string {
  return text.trim().toLowerCase();
}

export interface MatchArtikelInput {
  name: string;
  artikelnummer?: string;
}

export interface MatchableArtikel {
  id: number;
  name: string;
  artikelnummer: string;
}

/**
 * Ordnet eine KI-erkannte Position einem bestehenden Artikel zu. Prüft zuerst
 * gelernte Korrekturen (KiLernZuordnung), dann exakte Artikelnummer, dann
 * Namens-Teilstring, dann Wort-Teiltreffer.
 */
export function matchArtikel<T extends MatchableArtikel>(
  kiPos: MatchArtikelInput,
  artikel: T[],
  gelernt?: Map<string, number>
): { artikel: T | null; konfidenz: Konfidenz } {
  if (!artikel.length) return { artikel: null, konfidenz: "keine" };

  if (gelernt && gelernt.size > 0 && kiPos.name) {
    const gelerntId = gelernt.get(normalisiereSuchtext(kiPos.name));
    if (gelerntId != null) {
      const treffer = artikel.find((a) => a.id === gelerntId);
      if (treffer) return { artikel: treffer, konfidenz: "gelernt" };
    }
  }

  if (kiPos.artikelnummer) {
    const exact = artikel.find(
      (a) => a.artikelnummer.toLowerCase() === kiPos.artikelnummer!.toLowerCase()
    );
    if (exact) return { artikel: exact, konfidenz: "hoch" };
  }

  const nameLower = kiPos.name.toLowerCase();

  const nameContains = artikel.find(
    (a) => a.name.toLowerCase().includes(nameLower) || nameLower.includes(a.name.toLowerCase())
  );
  if (nameContains) return { artikel: nameContains, konfidenz: "mittel" };

  const words = nameLower.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    const partial = artikel.find((a) => a.name.toLowerCase().includes(word));
    if (partial) return { artikel: partial, konfidenz: "niedrig" };
  }

  return { artikel: null, konfidenz: "keine" };
}

export interface MatchKundeInput {
  name: string;
  firma?: string;
  ort?: string;
}

export interface MatchableKunde {
  id: number;
  name: string;
  firma?: string;
}

/**
 * Ordnet einen KI-erkannten Kunden einem bestehenden Kunden zu. Prüft zuerst
 * gelernte Korrekturen (KiLernZuordnung), dann exakten Namens-/Firmentreffer,
 * dann Teilstring, dann Wort-Teiltreffer.
 */
export function matchKunde<T extends MatchableKunde>(
  kiKunde: MatchKundeInput,
  kunden: T[],
  gelernt?: Map<string, number>
): { kunde: T | null; konfidenz: Konfidenz } {
  if (!kunden.length) return { kunde: null, konfidenz: "keine" };

  const search = (kiKunde.firma || kiKunde.name).toLowerCase();

  if (gelernt && gelernt.size > 0 && search) {
    const gelerntId = gelernt.get(normalisiereSuchtext(search));
    if (gelerntId != null) {
      const treffer = kunden.find((k) => k.id === gelerntId);
      if (treffer) return { kunde: treffer, konfidenz: "gelernt" };
    }
  }

  const exact = kunden.find(
    (k) => k.name.toLowerCase() === search || (k.firma && k.firma.toLowerCase() === search)
  );
  if (exact) return { kunde: exact, konfidenz: "hoch" };

  const containsMatch =
    search.length >= 3
      ? kunden.find(
          (k) =>
            k.name.toLowerCase().includes(search) ||
            (k.firma && k.firma.toLowerCase().includes(search)) ||
            search.includes(k.name.toLowerCase())
        )
      : null;
  if (containsMatch) return { kunde: containsMatch, konfidenz: "mittel" };

  const words = search.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    const partial = kunden.find(
      (k) =>
        k.name.toLowerCase().includes(word) ||
        (k.firma && k.firma.toLowerCase().includes(word))
    );
    if (partial) return { kunde: partial, konfidenz: "niedrig" };
  }

  return { kunde: null, konfidenz: "keine" };
}

export interface FehlendeFelderPosition {
  artikelId: string | number | null;
  konfidenz: Konfidenz;
  verkaufspreis?: number;
  menge?: number;
}

/**
 * Berechnet eine Liste von Hinweistexten für Dinge, die bei einer KI-erkannten
 * Lieferung noch manuell geprüft/ergänzt werden sollten (für Batch-Übersicht).
 */
export function berechneFehlendeFelder(input: {
  kundeKonfidenz: Konfidenz;
  positionen: FehlendeFelderPosition[];
}): string[] {
  const felder: string[] = [];

  if (input.kundeKonfidenz === "keine" || input.kundeKonfidenz === "niedrig") {
    felder.push("Kunde nicht eindeutig zugeordnet");
  }

  input.positionen.forEach((p, i) => {
    if (!p.artikelId) {
      felder.push(`Position ${i + 1}: Artikel nicht gefunden`);
    } else if (p.konfidenz === "niedrig") {
      felder.push(`Position ${i + 1}: Artikel-Zuordnung unsicher`);
    }
    if (p.verkaufspreis == null || p.verkaufspreis <= 0) {
      felder.push(`Position ${i + 1}: Preis fehlt`);
    }
    if (p.menge == null || p.menge <= 0) {
      felder.push(`Position ${i + 1}: Menge fehlt`);
    }
  });

  return felder;
}
