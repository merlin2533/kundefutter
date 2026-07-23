// ─── Zentraler Modell-Katalog — einzige Quelle der Wahrheit ─────────────────
//
// Legt fest, welche Mistral-Modelle je Aufgabentyp in der UI auswählbar sind
// und welches Modell als Standard gilt, falls nichts (oder ein ungültiger
// Wert) in der `Einstellung`-Tabelle hinterlegt ist. Wird sowohl vom
// Server (`lib/ai.ts`, API-Validierung) als auch vom Client
// (`/einstellungen/ki`) importiert — daher keine Server-only Imports hier.

export type KiAuswahlKategorie = "language" | "transcription";

export interface KiModellOption {
  value: string;
  label: string;
}

// Auswählbare Modelle je Kategorie. OCR läuft immer fix über
// "mistral-ocr-latest" (kein Auswahlfeld), TTS hat kein festes
// Modell-Line-up bei Mistral und bleibt daher ein freies Textfeld.
export const KI_MODELLE: Record<KiAuswahlKategorie, KiModellOption[]> = {
  language: [
    { value: "mistral-large-latest", label: "Mistral Large (empfohlen)" },
    { value: "mistral-medium-3", label: "Mistral Medium 3" },
    { value: "mistral-small-latest", label: "Mistral Small" },
    { value: "open-mistral-nemo", label: "Open Mistral Nemo (Open Source)" },
  ],
  transcription: [
    { value: "voxtral-mini-latest", label: "Voxtral Mini (empfohlen)" },
  ],
};

// Standardwert je Kategorie — wird verwendet, wenn kein Wert gespeichert ist
// ODER der gespeicherte Wert nicht (mehr) in KI_MODELLE enthalten ist.
export const KI_MODELL_STANDARD: Record<KiAuswahlKategorie, string> = {
  language: "mistral-large-latest",
  transcription: "voxtral-mini-latest",
};

export function istGueltigesKiModell(kategorie: KiAuswahlKategorie, modell: string): boolean {
  return KI_MODELLE[kategorie].some((m) => m.value === modell);
}

// Liefert den gespeicherten Wert zurück, falls gültig — sonst sauber den
// Standardwert der Kategorie (nie einen leeren/kaputten Modellnamen).
export function aufloesenKiModell(kategorie: KiAuswahlKategorie, gespeichert: string | undefined): string {
  if (gespeichert && istGueltigesKiModell(kategorie, gespeichert)) return gespeichert;
  return KI_MODELL_STANDARD[kategorie];
}
