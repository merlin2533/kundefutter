// VVVO / HIT — Format-Validierung der Betriebsnummer
//
// Aufbau Betriebsnummer (15-stellig im EU-Format DEnnYYYYYYYY...):
//   - Format: 12 Ziffern (z.B. "276031234567" oder mit Trennzeichen "276 03 1234567")
//   - 276 = ISO-Code Deutschland (numerisch, 3-stellig)
//   - 2 Ziffern Land/Bundesland (01-16)
//   - 7 Ziffern Betriebs-ID
// HIT verlangt zudem das Bundeslandkürzel davor; im SaaS reicht Format + Prüfziffer.
//
// Da HIT keine offene API hat, validieren wir Format + Bundesland-Bereich.
//
// Bundesland-Codes (1. Stelle nach DE-Präfix):
//   01 Schleswig-Holstein  09 Bayern
//   02 Hamburg              10 Saarland
//   03 Niedersachsen        11 Berlin
//   04 Bremen               12 Brandenburg
//   05 Nordrhein-Westfalen  13 Mecklenburg-Vorpommern
//   06 Hessen               14 Sachsen
//   07 Rheinland-Pfalz      15 Sachsen-Anhalt
//   08 Baden-Württemberg    16 Thüringen

export const BUNDESLAENDER_VVVO: Record<string, string> = {
  "01": "Schleswig-Holstein",
  "02": "Hamburg",
  "03": "Niedersachsen",
  "04": "Bremen",
  "05": "Nordrhein-Westfalen",
  "06": "Hessen",
  "07": "Rheinland-Pfalz",
  "08": "Baden-Württemberg",
  "09": "Bayern",
  "10": "Saarland",
  "11": "Berlin",
  "12": "Brandenburg",
  "13": "Mecklenburg-Vorpommern",
  "14": "Sachsen",
  "15": "Sachsen-Anhalt",
  "16": "Thüringen",
};

export type VvvoValidierung = {
  gueltig: boolean;
  normalisiert?: string;        // "276031234567"
  bundesland?: string;
  bundeslandCode?: string;
  fehler?: string;
};

export function validiereVvvo(input: string | null | undefined): VvvoValidierung {
  if (!input || !input.trim()) {
    return { gueltig: false, fehler: "Keine Nummer angegeben" };
  }

  // Alle Nicht-Ziffern entfernen (Leerzeichen, Bindestriche, "DE" Präfix)
  const ziffern = input.replace(/\D/g, "");

  // Erlaubt: 12 Ziffern (276 + 2 BL + 7 Betrieb) ODER 9 Ziffern (BL + 7 Betrieb, dann DE prefix dazu)
  let normalisiert: string;
  let blCode: string;

  if (ziffern.length === 12 && ziffern.startsWith("276")) {
    normalisiert = ziffern;
    blCode = ziffern.substring(3, 5);
  } else if (ziffern.length === 9) {
    // Nur BL + Betriebs-ID — DE-Präfix ergänzen
    normalisiert = "276" + ziffern;
    blCode = ziffern.substring(0, 2);
  } else if (ziffern.length === 15) {
    // Erweitertes Format mit Tierart-Präfix oder Halterart — wir nehmen die ersten 12
    normalisiert = ziffern.substring(0, 12);
    if (!normalisiert.startsWith("276")) {
      return { gueltig: false, fehler: "Erwartet wird DE (276…)" };
    }
    blCode = normalisiert.substring(3, 5);
  } else {
    return {
      gueltig: false,
      fehler: `Ungültige Länge (${ziffern.length}); erwartet 9 oder 12 Ziffern`,
    };
  }

  const bundesland = BUNDESLAENDER_VVVO[blCode];
  if (!bundesland) {
    return {
      gueltig: false,
      fehler: `Unbekannter Bundeslandcode ${blCode}`,
      normalisiert,
    };
  }

  return {
    gueltig: true,
    normalisiert,
    bundesland,
    bundeslandCode: blCode,
  };
}

// Schöne Anzeige: "DE 03 1234567" aus 276031234567
export function formatiereVvvo(normalisiert: string): string {
  if (normalisiert.length !== 12) return normalisiert;
  return `DE ${normalisiert.substring(3, 5)} ${normalisiert.substring(5)}`;
}
