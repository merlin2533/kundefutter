import { prisma } from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";
import { Mistral } from "@mistralai/mistralai";
import { KI_MODELL_STANDARD, aufloesenKiModell } from "@/lib/ki-modelle";

// ─── Zentraler KI-Service — ausschließlich Mistral AI ───────────────────────
//
// Ein Provider, eine Abstraktion: `getAiConfig()` liest je Kategorie
// (language | ocr | transcription | tts) das konfigurierte Modell + den
// Mistral-API-Key aus der `Einstellung`-Tabelle. Dokumenterkennung (Bild +
// PDF) läuft immer über die dedizierte Mistral-OCR-API (`client.ocr.process`),
// gefolgt von einer Sprachmodell-Anfrage zur strukturierten JSON-Extraktion.
// Diktieren läuft über Mistrals Voxtral-Transkriptionsmodell.

// ─── Typen ───────────────────────────────────────────────────────────────────

export type ModelCategory = "language" | "ocr" | "transcription" | "tts";

export interface AiConfig {
  modell: string;
  mistralKey?: string;
}

export interface AiAnalyzeResult {
  raw: string;
  parsed: Record<string, unknown>;
  tokensIn: number;
  tokensOut: number;
}

export interface AiTranscribeResult {
  text: string;
  language: string | null;
  tokensIn: number;
  tokensOut: number;
}

// ─── Kosten pro 1M Tokens (in US-Cent) ──────────────────────────────────────

export const KOSTEN_MAP: Record<string, { input: number; output: number }> = {
  "mistral-large-latest":  { input: 200, output: 600 },
  "mistral-medium-3":      { input: 40,  output: 200 },
  "mistral-small-latest":  { input: 10,  output: 30 },
  "open-mistral-nemo":     { input: 4,   output: 10 },
  "codestral-latest":      { input: 20,  output: 60 },
  "mistral-ocr-latest":    { input: 0,   output: 0 },  // seitenbasierte Abrechnung, nicht tokenbasiert
  "voxtral-mini-latest":   { input: 0,   output: 0 },  // audiodauerbasierte Abrechnung, nicht tokenbasiert
};

// Default-Modelle je Kategorie — Sprachmodell/Transkription kommen aus dem
// zentralen Katalog in lib/ki-modelle.ts (einzige Quelle der Wahrheit).
const DEFAULT_MODELS: Record<ModelCategory, string> = {
  language:      KI_MODELL_STANDARD.language,
  ocr:            "mistral-ocr-latest",
  transcription:  KI_MODELL_STANDARD.transcription,
  tts:            "",  // kein festes Standardmodell — Mistral wählt serverseitig, falls leer
};

function berechneKosten(modell: string, tokensIn: number, tokensOut: number): number {
  const rate = KOSTEN_MAP[modell];
  if (!rate) return 0;
  return Math.round((tokensIn * rate.input + tokensOut * rate.output) / 1_000_000);
}

// ─── Config aus DB laden ─────────────────────────────────────────────────────

export async function getAiConfig(category: ModelCategory = "language"): Promise<AiConfig> {
  const rows = await prisma.einstellung.findMany({
    where: { key: { startsWith: "ki." } },
    take: 100,
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  const gespeichert = map[`ki.modell_${category}`];
  // Sprachmodell/Transkription: nur ein Wert aus dem Katalog gilt — ein
  // veralteter oder manuell in der DB verbogener Eintrag fällt sauber auf
  // den Standardwert der Kategorie zurück statt einen ungültigen Modellnamen
  // an Mistral zu schicken.
  const modell = (category === "language" || category === "transcription")
    ? aufloesenKiModell(category, gespeichert)
    : gespeichert || DEFAULT_MODELS[category];

  return {
    modell,
    mistralKey: map["ki.mistral_key"],
  };
}

// ─── Dokument analysieren (Bild oder PDF, OCR-Kategorie) ─────────────────────
//
// Einheitliche Pipeline für Bild UND PDF: Schritt 1 extrahiert den Text via
// Mistral OCR (client.ocr.process — akzeptiert image_url und document_url
// gleichermaßen als data:-URL), Schritt 2 wandelt den extrahierten Text via
// Sprachmodell in strukturiertes JSON um.

export async function analyzeDocument(
  base64Image: string,
  systemPrompt: string,
  feature: string,
  config?: AiConfig,
  opts: { maxTokens?: number; userInstruction?: string } = {}
): Promise<AiAnalyzeResult> {
  const ocrCfg = config || (await getAiConfig("ocr"));
  if (!ocrCfg.mistralKey) throw new Error("Mistral API-Key nicht konfiguriert");

  const isPdf = detectIsPdf(base64Image);
  const dataUrl = base64Image.startsWith("data:")
    ? base64Image
    : `data:${detectMediaType(base64Image)};base64,${base64Image}`;

  try {
    const client = new Mistral({ apiKey: ocrCfg.mistralKey });
    const ocrResponse = await client.ocr.process({
      model: "mistral-ocr-latest",
      document: isPdf
        ? { type: "document_url", documentUrl: dataUrl }
        : { type: "image_url", imageUrl: dataUrl },
    });

    const documentText = (ocrResponse.pages ?? [])
      .map((p) => p.markdown || "")
      .join("\n\n")
      .trim();

    if (!documentText) {
      throw new Error("Mistral OCR konnte keinen Text aus dem Dokument extrahieren.");
    }

    // Schritt 2: JSON-Extraktion via Sprachmodell — eigene Kategorie, unabhängig
    // vom übergebenen OCR-Konfig laden. Sonst würde bei Aufrufern, die ihr
    // ocrCfg als `config` durchreichen, "mistral-ocr-latest" (kein Chat-Modell)
    // an client.chat.complete() gehen und JEDE Dokumentenanalyse fehlschlagen.
    const languageCfg = await getAiConfig("language");
    const chatResponse = await client.chat.complete({
      model: languageCfg.modell,
      maxTokens: opts.maxTokens ?? 4096,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${opts.userInstruction ?? "Analysiere das folgende Dokument und extrahiere die relevanten Informationen als JSON:"}\n\n${documentText}`,
        },
      ],
    });

    const content = chatResponse.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : "{}";
    const tokensIn = chatResponse.usage?.promptTokens || 0;
    const tokensOut = chatResponse.usage?.completionTokens || 0;
    const parsed = parseJsonFromText(text);
    await logUsage(languageCfg, feature, tokensIn, tokensOut, true);
    return { raw: text, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(ocrCfg, feature, 0, 0, false, err instanceof Error ? err.message : "Mistral OCR Fehler");
    throw err;
  }
}

// ─── Datei (multipart Upload) analysieren ────────────────────────────────────
//
// Dünner Adapter für Routen, die eine hochgeladene Datei statt eines
// bereits-base64-kodierten Bildes erhalten (z. B. multipart/form-data).

export async function analyzeDocumentFile(
  file: File,
  prompt: string,
  feature: string,
  opts: { maxTokens?: number; userText?: string } = {}
): Promise<{ raw: string; tokensIn: number; tokensOut: number; cfg: AiConfig }> {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${file.type || "application/octet-stream"};base64,${base64}`;
  const cfg = await getAiConfig("language");
  const result = await analyzeDocument(dataUrl, prompt, feature, undefined, {
    maxTokens: opts.maxTokens,
    userInstruction: opts.userText,
  });
  return { raw: result.raw, tokensIn: result.tokensIn, tokensOut: result.tokensOut, cfg };
}

// ─── Text analysieren (Language-Kategorie) ───────────────────────────────────

export async function analyzeText(
  text: string,
  systemPrompt: string,
  feature: string,
  config?: AiConfig
): Promise<AiAnalyzeResult> {
  const cfg = config || (await getAiConfig("language"));
  if (!cfg.mistralKey) throw new Error("Mistral API-Key nicht konfiguriert");

  const client = new Mistral({ apiKey: cfg.mistralKey });

  try {
    const response = await client.chat.complete({
      model: cfg.modell,
      maxTokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analysiere den folgenden Text (von einer Spracheingabe) und extrahiere die relevanten Informationen als JSON:\n\n${text}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    const responseText = typeof content === "string" ? content : "{}";
    const tokensIn = response.usage?.promptTokens || 0;
    const tokensOut = response.usage?.completionTokens || 0;
    const parsed = parseJsonFromText(responseText);
    await logUsage(cfg, feature, tokensIn, tokensOut, true);
    return { raw: responseText, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "Mistral Fehler");
    throw err;
  }
}

// ─── Audio transkribieren (Diktieren, Transcription-Kategorie) ──────────────

export async function transcribeAudio(
  audio: { fileName: string; content: ArrayBuffer },
  feature: string,
  config?: AiConfig
): Promise<AiTranscribeResult> {
  const cfg = config || (await getAiConfig("transcription"));
  if (!cfg.mistralKey) throw new Error("Mistral API-Key nicht konfiguriert");

  const client = new Mistral({ apiKey: cfg.mistralKey });

  try {
    const response = await client.audio.transcriptions.complete({
      model: cfg.modell,
      file: { fileName: audio.fileName, content: audio.content },
      language: "de",
    });

    const tokensIn = response.usage?.promptTokens || 0;
    const tokensOut = response.usage?.completionTokens || 0;
    await logUsage(cfg, feature, tokensIn, tokensOut, true);
    return { text: response.text, language: response.language, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "Mistral Transkriptions-Fehler");
    throw err;
  }
}

// ─── Text-zu-Sprache (TTS-Kategorie) ─────────────────────────────────────────

export async function textToSpeech(
  text: string,
  config?: AiConfig,
  voiceId?: string
): Promise<ArrayBuffer> {
  const cfg = config || (await getAiConfig("tts"));
  if (!cfg.mistralKey) throw new Error("Mistral API-Key nicht konfiguriert");

  const client = new Mistral({ apiKey: cfg.mistralKey });

  const response = await client.audio.speech.complete({
    model: cfg.modell || undefined,
    input: text,
    voiceId: voiceId || undefined,
    responseFormat: "mp3",
  });

  if ("audioData" in response) {
    return Buffer.from(response.audioData, "base64").buffer as ArrayBuffer;
  }
  throw new Error("Unerwartetes Antwortformat von Mistral Sprachausgabe");
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function detectMediaType(base64: string): string {
  if (base64.startsWith("data:image/png")) return "image/png";
  if (base64.startsWith("data:image/webp")) return "image/webp";
  if (base64.startsWith("data:image/gif")) return "image/gif";
  if (base64.startsWith("data:application/pdf")) return "application/pdf";
  if (base64.startsWith("data:")) return "image/jpeg";
  // Raw Base64: Magic Bytes prüfen
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("R0lGO")) return "image/gif";
  if (base64.startsWith("UklGR")) return "image/webp";
  // PDF magic bytes (%PDF- in base64 = JVBERi0)
  if (base64.startsWith("JVBERi0")) return "application/pdf";
  return "image/jpeg";
}

function detectIsPdf(base64: string): boolean {
  return detectMediaType(base64) === "application/pdf";
}

export function parseJsonFromText(text: string): Record<string, unknown> {
  try { return JSON.parse(text); } catch { /* fall */ }
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) { try { return JSON.parse(match[1]); } catch { /* fall */ } }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch { /* fall */ } }
  return { rawText: text };
}

export function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
export function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

async function logUsage(
  cfg: AiConfig,
  feature: string,
  tokensIn: number,
  tokensOut: number,
  erfolgreich: boolean,
  fehler?: string
) {
  try {
    await prisma.kiNutzung.create({
      data: {
        provider: "mistral",
        modell: cfg.modell,
        feature,
        tokensIn,
        tokensOut,
        kostenCent: berechneKosten(cfg.modell, tokensIn, tokensOut),
        erfolgreich,
        fehler,
      },
    });
  } catch (err) {
    console.error("KI-Nutzung konnte nicht gespeichert werden");
    Sentry.captureException(err);
  }
}

export async function logError(feature: string, error: string) {
  try {
    const cfg = await getAiConfig();
    await logUsage(cfg, feature, 0, 0, false, error);
  } catch (err) {
    console.error("logError fehlgeschlagen:", error);
    Sentry.captureException(err);
  }
}

// ─── Verbindungstest ─────────────────────────────────────────────────────────

export async function testConnection(cfg: AiConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!cfg.mistralKey) return { ok: false, error: "Kein Mistral API-Key konfiguriert" };
    const client = new Mistral({ apiKey: cfg.mistralKey });
    await client.chat.complete({
      model: cfg.modell || "mistral-small-latest",
      maxTokens: 10,
      messages: [{ role: "user", content: "test" }],
    });
    return { ok: true };
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
    return { ok: false, error: msg };
  }
}

// ─── Feature-spezifische Prompts ─────────────────────────────────────────────

export const PROMPTS = {
  wareneingang: `Du bist ein Experte für die Analyse von Lieferscheinen in der Agrarbranche (Futter, Dünger, Saatgut).
Analysiere das Bild eines Lieferscheins und extrahiere alle relevanten Informationen.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "lieferant": "Name des Lieferanten (falls erkennbar)",
  "lieferscheinNr": "Nummer des Lieferscheins (falls erkennbar)",
  "datum": "Datum im Format YYYY-MM-DD (falls erkennbar)",
  "positionen": [
    {
      "name": "Artikelbezeichnung",
      "artikelnummer": "Artikelnummer falls vorhanden",
      "menge": 100,
      "einheit": "kg|t|Sack|Liter|Stück",
      "einzelpreis": 12.50,
      "chargeNr": "Chargennummer/Losnummer falls vorhanden (z.B. LOT-123, CH-2024-001)"
    }
  ]
}

Wenn ein Feld nicht erkennbar ist, setze null. Extrahiere ALLE Positionen. Chargennummern sind besonders wichtig bei Saatgut, Düngemitteln und Futtermitteln — achte auf Begriffe wie Charge, Los, Lot, Batch, Ch.-Nr., L-Nr.`,

  lieferung: `Du bist ein Experte für die Analyse von Bestellungen und Aufträgen in der Agrarbranche.
Der Input ist entweder ein Bild (Foto eines Lieferscheins/einer Bestellung) oder ein Text aus einer
Spracheingabe/einem Diktat. Analysiere den Input und extrahiere Kunden- und Artikelinformationen.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "kunde": {
    "name": "Kundenname",
    "firma": "Firmenname falls vorhanden",
    "ort": "Ort falls erkennbar",
    "betriebsnummer": "Betriebsnummer/VVVO-Nummer falls genannt, sonst null"
  },
  "datum": "YYYY-MM-DD",
  "positionen": [
    {
      "name": "Artikelbezeichnung",
      "artikelnummer": "Artikelnummer falls vorhanden",
      "menge": 100,
      "einheit": "kg|t|Sack|Liter|Stück",
      "einzelpreis": 12.50,
      "chargeNr": "Chargennummer/Losnummer falls vorhanden (z.B. LOT-123, CH-2024-001)"
    }
  ]
}

Wenn ein Feld nicht erkennbar ist, setze null. Chargennummern sind besonders wichtig bei Saatgut, Düngemitteln und Futtermitteln — achte auf Begriffe wie Charge, Los, Lot, Batch, Ch.-Nr., L-Nr.
Bei Spracheingabe: Zahlwörter und mündliche Mengenangaben (z.B. "zwei Tonnen", "fünfzig Kilo",
"drei Sack") korrekt in "menge" + "einheit" übersetzen. Eine genannte Zahlenfolge im Kontext von
"Betriebsnummer", "VVVO-Nummer" oder ähnlich klingenden, möglicherweise durch Spracherkennung leicht
verfälschten Begriffen gehört in "betriebsnummer", nicht in eine Artikelposition.`,

  crm: `Du bist ein CRM-Assistent für ein Agrarunternehmen.
Analysiere den Input (Bild oder Text/Spracheingabe) und extrahiere Kundeninformationen und relevante Notizen.
Optimiere den Text für eine professionelle CRM-Aktivität.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "kunde": {
    "name": "Kundenname",
    "firma": "Firmenname falls vorhanden"
  },
  "betreff": "Kurzer Betreff der Aktivität",
  "inhalt": "Optimierter, professioneller Text der Notiz/Aktivität",
  "typ": "besuch|anruf|email|notiz"
}

Wenn ein Feld nicht erkennbar ist, setze null.`,

  beleg: `Du bist ein Buchhalter-Assistent für ein Agrarunternehmen.
Analysiere das Foto oder PDF einer Eingangsrechnung / eines Kassenbelegs und extrahiere alle buchungsrelevanten Daten.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "datum": "Rechnungsdatum im Format YYYY-MM-DD (falls erkennbar, sonst null)",
  "belegNr": "Rechnungsnummer / Belegnummer des Lieferanten (falls erkennbar, sonst null)",
  "faelligAm": "Fälligkeitsdatum im Format YYYY-MM-DD (aus Zahlungsziel, Fälligkeitsvermerk oder Zahlungskonditionen berechnet, sonst null)",
  "beschreibung": "Kurze, prägnante Beschreibung des Kaufgegenstands (max. 80 Zeichen)",
  "betragNetto": 123.45,
  "mwstSatz": 19,
  "betragBrutto": 146.91,
  "lieferant": "Name des Rechnungsstellers (falls erkennbar, sonst null)",
  "iban": "IBAN des Zahlungsempfängers (z.B. DE89370400440532013000, Leerzeichen entfernen, nur wenn eindeutig erkennbar, sonst null)",
  "bic": "BIC/SWIFT-Code der Bank (z.B. COBADEFFXXX, nur wenn angegeben, sonst null)",
  "kategorie": "Eine der folgenden Kategorien: Wareneinkauf | Betriebsbedarf | Fahrtkosten | Bürobedarf | Telefon/Internet | Versicherung | Miete | Sonstige"
}

Regeln:
- "mwstSatz" muss 0, 7 oder 19 sein. Wenn mehrere Sätze auf dem Beleg, wähle den dominanten.
- "betragNetto" und "betragBrutto" als Dezimalzahl mit Punkt (kein €-Zeichen).
- Wenn Netto nicht direkt angegeben: berechne aus Brutto und MwSt.
- "faelligAm": Berechne aus Rechnungsdatum + Zahlungsziel (z.B. "30 Tage netto" → datum + 30 Tage). Falls kein Zahlungsziel angegeben: null.
- "iban": Leerzeichen aus IBAN entfernen. Nur setzen wenn eindeutig als IBAN erkennbar (beginnt mit 2-Buchstaben-Ländercode + Ziffern).
- "kategorie" anhand des Inhalts einordnen (z.B. Dünger/Futter → Wareneinkauf, Reparatur → Betriebsbedarf).
- Fehlende Felder auf null setzen, niemals erfinden.`,

  bodenprobe: `Du bist ein Experte für die Analyse von Bodenuntersuchungsberichten aus Agrarlaboren
(LUFA Nord-West / Institut für Boden und Umwelt, AGROLAB, Eurofins Agro, LKS Lichtenwalde, LUFA NRW etc.).

Ein einzelner Prüfbericht enthält häufig MEHRERE Bodenproben (ein Sammelauftrag für viele Schläge eines
Betriebes). Du extrahierst ALLE Proben des Berichts. Bei einer Düngungsempfehlungs-Anlage extrahierst du
zusätzlich die Empfehlungstabelle pro Probe.

Antworte AUSSCHLIESSLICH mit gültigem JSON in exakt diesem Format (ohne Markdown-Codeblöcke):
{
  "auftrag": {
    "labor": "Name des Labors (z.B. 'LUFA Nord-West' / 'Institut für Boden und Umwelt') oder null",
    "auftragsNr": "Auftrags-Nr. des Labors oder null",
    "kundeNrLabor": "Kunden-Nr. beim Labor oder null",
    "probenahmeDatum": "Probenahmedatum YYYY-MM-DD oder null",
    "berichtDatum": "Berichts-/Analysedatum YYYY-MM-DD oder null",
    "probenehmer": "Auftraggeber | Labor | Name oder null",
    "kundeName": "Empfänger-Name (Auftraggeber) oder null",
    "kundeAdresse": "Empfänger-Adresse einzeilig oder null",
    "berichtArt": "pruefbericht | duengungsempfehlung — je nach PDF-Typ"
  },
  "proben": [
    {
      "probenNr": "Proben-Nr. des Labors z.B. '26BB022422'",
      "schlagName": "Schlagbezeichnung laut Auftraggeber z.B. '1_Hinterm Bach'",
      "nutzungsart": "A | W | G | F | O | X (A=Acker, W=Grünland, G=Garten, F=Forst, O=Obstbau, X=Sonstige)",
      "bodenart": "Bodenartenkürzel z.B. sL, lS, S, L, T",
      "bodenartGruppe": "Bodenart-Zusatz in Klammern z.B. '(h)' humos, '(s)' sandig, sonst null",
      "tiefe": "Beprobungstiefe z.B. '0-30 cm' oder null",
      "pH": 6.5,
      "pHSoll": "anzustrebender pH-Bereich als Text z.B. '6,3-7,0' oder null",
      "phosphor": 12.0,
      "kalium": 15.0,
      "magnesium": 8.0,
      "bor": 0.5,
      "schwefel": 2.5,
      "zink": 3.0,
      "kupfer": 2.0,
      "mangan": 60.0,
      "natrium": 4.0,
      "kak": 14.0,
      "kalkbedarf": 1.5,
      "kalkbedarfDt": 32,
      "humus": 1.8,
      "corg": 1.45,
      "nGesamt": 0.139,
      "nMin": 45.0,
      "cn": 10.5,
      "klasseP": "A|B|C|D|E|F oder null",
      "klasseK": "A|B|C|D|E|F oder null",
      "klasseMg": "A|B|C|D|E|F oder null",
      "klasseBor": "A|B|C|D|E|F oder null",
      "klasseSchwefel": "A|B|C|D|E|F oder null",
      "klasseZink": "A|B|C|D|E|F oder null",
      "klasseKupfer": "A|B|C|D|E|F oder null",
      "klasseMangan": "A|B|C|D|E|F oder null",
      "klasseNatrium": "A|B|C|D|E|F oder null",
      "empfehlungen": {
        "kalkDtHa": 32,
        "p2o5": { "AckerRuebenKartoffeln": 100, "AckerGetreideRaps": 80, "AckerZwischenfruechte": 20 },
        "k2o": { "AckerRuebenFeldgras": 290, "AckerMais": 150, "AckerStaerkekartoffelnRaps": 110 },
        "mgO": { "AckerWintergetreide": 40 },
        "cu": 40, "mn": 60, "b": 80, "zn": null, "na": null
      }
    }
  ],
  "hinweis": "Optionaler Hinweis falls Werte unsicher oder Bericht unvollständig"
}

Wichtige Regeln:
- Bei einem Prüfbericht: Werte (pH, P, K, …) und Klassen befüllen, 'empfehlungen' = null.
- Bei einer Düngungsempfehlungs-Anlage: NUR 'empfehlungen' befüllen, alle Werte = null lassen.
- ALLE Proben des Berichts extrahieren — NICHT nur die ersten.
- Antworte NUR mit JSON — keine Erklärungen, kein Text davor oder danach, keine Markdown-Codeblöcke.`,

  sachkundenachweis: `Du bist ein Experte für die Erkennung von Sachkundenachweisen und Zertifikaten im Agrarbereich
(PSM-Sachkunde nach § 9 PflSchG, Spritzgerätekontrolle/JKI-Plakette, Düngerschulung,
Sprengstoff-Sachkunde, Mais-Beize-Sachkunde, Wildlebensmittelschulung).

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format (ohne Markdown-Codeblöcke):
{
  "typ": "PSM-Sachkunde | Spritzgeraetekontrolle | Duengerschulung | Sprengstoff-Sachkunde | Mais-Beize-Sachkunde | Wildlebensmittel-Schulung | Sonstige",
  "inhaberName": "Vor- und Nachname des Inhabers, sonst null",
  "nummer": "Zertifikats-/Sachkundenummer (z.B. 'NW-2024-12345'), sonst null",
  "ausstellung": "Ausstellungsdatum YYYY-MM-DD oder null",
  "gueltigBis": "Gültig bis YYYY-MM-DD oder null (bei Spritzgerätekontrolle: nächste Pflichtprüfung)",
  "ausgestelltVon": "Ausstellende Behörde/Kammer (z.B. 'LWK Niedersachsen', 'JKI Braunschweig', 'LWK NRW'), sonst null",
  "hinweis": "Optional: Anmerkung zur Erkennungsqualität oder fehlenden Feldern"
}

Regeln:
- typ-Whitelist exakt einhalten.
- gueltigBis: bei PSM-Sachkunde steht oft kein direktes Ablaufdatum — leiten ab aus Ausstellungsdatum + 3 Jahre wenn nichts anderes vermerkt; alternativ null.
- Datumsformate normieren auf YYYY-MM-DD.
- Wenn Foto unscharf oder Feld nicht lesbar: null setzen, KEINE Werte erfinden.
- Antworte NUR mit JSON — keine Erklärungen, kein Text, keine Markdown-Codeblöcke.`,

  schlaegte: `Du bist ein Experte für Agrarflächen-Antrags-PDFs (AFIG / iBALIS / HIT-Karten /
GAP-Antrag / Bewirtschaftungsliste / Schlagskizze einer Landwirtschaftskammer).

Extrahiere ALLE Schläge (Feldstücke / Teilschläge) eines Antrags als JSON.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format (ohne Markdown-Codeblöcke):
{
  "antrag": {
    "antragsteller": "Name des Antragstellers oder null",
    "betriebsNr": "12-stellige VVVO-/Betriebsnummer (DE…), sonst null",
    "antragsJahr": 2026
  },
  "schlaege": [
    {
      "name": "Schlagname/-bezeichnung (z.B. 'Hinterm Bach' oder 'FS 12.1')",
      "flaeche": 12.45,
      "fruchtart": "Winterweizen | Silomais | Raps | ... oder null",
      "sorte": "Sortenname oder null",
      "vorfrucht": "Vorfrucht-Kultur oder null",
      "aussaatJahr": 2026,
      "feldstueckNr": "Flurstück-/FS-Nummer oder null",
      "gemarkung": "Gemarkung/Flur oder null"
    }
  ],
  "hinweis": "Optional: fehlende Felder oder Mehrdeutigkeiten"
}

Regeln:
- 'flaeche' immer in Hektar (ha). Falls in ar oder m² angegeben → umrechnen.
- ALLE Schläge des Antrags zurückgeben — nicht nur die ersten.
- Antworte NUR mit JSON — keine Erklärungen, keine Markdown-Codeblöcke.`,

  mahnungstext: `Du bist ein professioneller Geschäftsbrief-Assistent für ein Agrarunternehmen
(Landhandel, Futtermittel, Düngemittel, Saatgut). Du verfasst eine Mahnung an einen Kunden in
freundlich-bestimmtem Ton — kein aggressiver Stil. B2B-Landwirtschaft = persönliche Geschäftsbeziehung.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format (ohne Markdown-Codeblöcke):
{
  "betreff": "Betreffzeile (knapp, ohne Anrede)",
  "anrede": "Sehr geehrter Herr/Frau …, oder bei langjährigen Kunden 'Guten Tag Herr/Frau …'",
  "text": "Volltext-Brief (ohne Anrede und ohne Grußformel). Plain Text, Absätze mit \\n\\n trennen.",
  "gruss": "Schlussformel z.B. 'Mit freundlichen Grüßen'",
  "hinweis": "Optional: Hinweis für den Sachbearbeiter (intern)"
}

Anpassung je Mahnstufe:
- Stufe 1: freundlich, mögliches Versehen unterstellen, Frist 7 Tage.
- Stufe 2: bestimmt, auf bereits ergangene Erinnerung verweisen, Mahngebühr benennen, Frist 7 Tage.
- Stufe 3: klar, Hinweis auf gerichtliches Mahnverfahren/Inkasso, Frist 7 Tage.
- Antworte NUR mit JSON — keine Erklärungen, keine Markdown-Codeblöcke.`,

  belegtyp: `Du bist ein Klassifizierer für hochgeladene Geschäftsdokumente eines Agrarhändlers.
Bestimme den TYP des Dokuments und gib die wahrscheinlichste Verarbeitungs-Maske an.

Mögliche Typen:
- "lieferschein"      — eingehender Lieferschein vom Lieferanten (Wareneingang)
- "rechnung"          — eingehende Lieferanten-Rechnung
- "bodenprobe"        — Laborbericht Bodenuntersuchung
- "sachkundenachweis" — PSM-/Düngerschulungs-/Spritzgerätekontroll-Zertifikat
- "visitenkarte"      — Visitenkarte (eine einzelne Person)
- "sortenversuch"     — Sortenversuchs-/Demoflächen-Auswertungstabelle
- "agrarantrag"       — AFIG/iBALIS/HIT-Karte/GAP-Antrag mit Schlagliste
- "ausgabenbeleg"     — Kassenbon, Tankquittung, Diesel-/Werkstattbeleg
- "unbekannt"         — keine eindeutige Zuordnung möglich

Antworte AUSSCHLIESSLICH mit gültigem JSON (ohne Markdown-Codeblöcke):
{
  "typ": "<einer der Werte oben>",
  "confidence": 0.95,
  "begruendung": "Knappe Erklärung warum (1 Satz, deutsch)",
  "hinweis": "Optional: was unklar bleibt"
}

Regeln:
- confidence zwischen 0.0 und 1.0. Unter 0.5 → typ = "unbekannt".
- Antworte NUR mit JSON.`,

  sortenversuch: `Du bist ein Experte für Sortenversuchs-Auswertungen aus dem Agrarbereich.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format (ohne Markdown-Codeblöcke):
{
  "versuch": {
    "name": "Versuchsbezeichnung z.B. 'LSV Wintergerste 2026 Standort Bad Oeynhausen'",
    "jahr": 2026,
    "kultur": "Wintergerste | Winterweizen | Mais | Raps | ...",
    "standort": "Standort/Ort oder null",
    "flaeche": null,
    "startDatum": "YYYY-MM-DD oder null",
    "endeDatum": "YYYY-MM-DD oder null"
  },
  "positionen": [
    {
      "sorte": "Sortenname (genau wie im Bericht)",
      "saatstaerke": 320,
      "ertragDtHa": 92.5,
      "feuchteProzent": 13.8,
      "proteinProzent": 11.4,
      "hektolitergew": 68.5,
      "bonitur": 3,
      "reife": "früh | mittel | spät | null"
    }
  ],
  "hinweis": "Optional"
}

Regeln:
- Erträge IMMER in dt/ha. Falls Tabelle in t/ha → ×10.
- ALLE Sortenzeilen extrahieren.
- Antworte NUR mit JSON — keine Markdown-Codeblöcke.`,

  visitenkarte: `Du bist ein OCR-Assistent für Visitenkarten und Kontaktdaten im B2B-Agrarbereich.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format (ohne Markdown-Codeblöcke):
{
  "vorname": "Vorname oder null",
  "nachname": "Nachname (inkl. Titel wie 'Dr.') oder null",
  "firma": "Firma/Betrieb/Genossenschaft oder null",
  "position": "Funktion/Rolle z.B. 'Geschäftsführer', sonst null",
  "telefon": "Festnetz-Telefon im Format mit Vorwahl, sonst null",
  "mobil": "Mobiltelefon, sonst null",
  "fax": "Fax-Nummer, sonst null",
  "email": "E-Mail-Adresse (kleingeschrieben), sonst null",
  "website": "Website-URL ohne https://, sonst null",
  "strasse": "Straße + Hausnummer oder null",
  "plz": "Postleitzahl oder null",
  "ort": "Ort oder null",
  "hinweis": "Optional: fehlende Felder oder Mehrdeutigkeiten"
}

Regeln:
- Telefonnummern als String mit Leerzeichen-Gruppierung. Keine Klammern um die Vorwahl.
- E-Mail immer kleingeschrieben.
- Antworte NUR mit JSON — keine Erklärungen, keine Markdown-Codeblöcke.`,

  inhaltsstoffe: `Du bist ein Experte für Agrarprodukte (Futtermittel, Ergänzungsfutter, Mineralfutter, Düngemittel, Saatgut, Pflanzenhilfsmittel).
Recherchiere die Inhaltsstoffe / Zusammensetzung des genannten Produkts anhand seines Namens.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "inhaltsstoffe": [
    { "name": "Rohprotein", "menge": 12.5, "einheit": "%" },
    { "name": "Schwefel", "menge": 90, "einheit": "%" }
  ],
  "aehnlicheProdukte": ["Produktname 1 (Hersteller)", "Produktname 2"],
  "hinweis": "Optionaler Hinweis falls das Produkt nicht eindeutig identifiziert werden konnte"
}

Regeln:
- Gib nur Inhaltsstoffe an, die du sicher kennst oder die sich aus dem Produktnamen eindeutig ableiten lassen. Erfinde KEINE Werte.
- "menge" kann null sein wenn der Wert unbekannt ist; "einheit" leer lassen wenn nicht anwendbar.
- Einheiten: typischerweise "%", "mg/kg", "g/kg", "MJ/kg", "g/l", "IE/kg"
- WICHTIG: Wenn du das exakte Produkt nicht kennst, ordne es anhand des Namens einem ähnlichen/verwandten Produkt zu.
- Nur wenn du gar keine Zuordnung machen kannst, gib ein leeres Array und einen Hinweis zurück.`,

  bankabgleich: `Du bist ein Buchhaltungs-Assistent für ein Agrarhandelsunternehmen. Gleiche Bankbuchungen mit
offenen Rechnungen/Ausgaben ab, die der automatische Abgleich NICHT eindeutig zuordnen konnte.

Eine Übereinstimmung liegt vor, wenn Bankbuchung und Kandidat sehr wahrscheinlich dieselbe Zahlung sind. Beachte:
- Betrag ist vorzeichenbehaftet (positiv = Zahlungseingang, negativ = Zahlungsausgang). Beträge sollten nahezu gleich sein.
- Datum kann leicht abweichen (Buchungs- vs. Rechnungsdatum), in der Regel wenige Tage bis wenige Wochen.
- Namen/Verwendungszweck können unterschiedlich geschrieben sein (Abkürzungen, Tippfehler, zusätzliche Referenzen, Firmenzusätze wie GmbH/e.K.).
- Ordne jede Bankbuchung höchstens einem Kandidaten zu und umgekehrt (1:1).
- Ordne NICHT zu, wenn du unsicher bist (lieber weglassen als falsch zuordnen).

Antworte AUSSCHLIESSLICH mit gültigem JSON in genau diesem Format (ohne Erklärtext, ohne Markdown):
{
  "matches": [
    { "bankIndex": 0, "candidateKind": "lieferung", "candidateId": 42, "confidence": 0.8, "reason": "Kurze Begründung" }
  ]
}

Regeln:
- "bankIndex" ist der Index in die gesendete Liste der Bankbuchungen (0-basiert).
- "candidateKind" ist genau einer von "lieferung" | "sammelrechnung" | "ausgabe" | "eingangsrechnung".
- "candidateId" MUSS eine der tatsächlich gesendeten Kandidaten-IDs sein — erfinde KEINE IDs.
- "confidence" ist eine Zahl zwischen 0 und 1. Gib nur Treffer mit confidence >= 0.5 zurück.
- Gib ein leeres "matches"-Array zurück, wenn du keinen einzigen sicheren Treffer findest.`,
};
