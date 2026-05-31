import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AiConfig {
  provider: "openai" | "anthropic";
  modell: string;
  openaiKey?: string;
  anthropicKey?: string;
}

export interface AiAnalyzeResult {
  raw: string;
  parsed: Record<string, unknown>;
  tokensIn: number;
  tokensOut: number;
}

// ─── Kosten pro 1M Tokens (in Cent) ─────────────────────────────────────────

export const KOSTEN_MAP: Record<string, { input: number; output: number }> = {
  // ─ OpenAI ─
  "gpt-5":              { input: 125, output: 1000 },
  "gpt-5-mini":         { input: 25,  output: 200 },
  "gpt-5-nano":         { input: 5,   output: 40 },
  "gpt-4o":             { input: 250, output: 1000 },
  "gpt-4o-mini":        { input: 15,  output: 60 },
  "gpt-4.1":            { input: 200, output: 800 },
  "gpt-4.1-mini":       { input: 40,  output: 160 },
  "gpt-4.1-nano":       { input: 10,  output: 40 },
  // ─ Anthropic (aktuell) ─
  "claude-opus-4-8":            { input: 1500, output: 7500 },
  "claude-sonnet-4-6":          { input: 300,  output: 1500 },
  "claude-haiku-4-5-20251001":  { input: 100,  output: 500 },
  // ─ Anthropic (Legacy – für historische Nutzungslogs) ─
  "claude-sonnet-4-20250514":   { input: 300,  output: 1500 },
  "claude-opus-4-20250514":     { input: 1500, output: 7500 },
};

function berechneKosten(modell: string, tokensIn: number, tokensOut: number): number {
  const rate = KOSTEN_MAP[modell];
  if (!rate) return 0;
  return Math.round((tokensIn * rate.input + tokensOut * rate.output) / 1_000_000);
}

// ─── Config aus DB laden ─────────────────────────────────────────────────────

export async function getAiConfig(): Promise<AiConfig> {
  const rows = await prisma.einstellung.findMany({
    where: { key: { startsWith: "ki." } },
    take: 50,
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  const raw = map["ki.provider"];
  const provider = (raw === "openai" || raw === "anthropic") ? raw : "openai";

  // Modell wird pro Provider gepflegt; Fallback auf altes globales ki.modell,
  // dann auf den Provider-Standard.
  const providerModell = provider === "openai" ? map["ki.modell_openai"] : map["ki.modell_anthropic"];
  const defaultModell = provider === "openai" ? "gpt-4o" : "claude-haiku-4-5-20251001";
  const modell = providerModell || map["ki.modell"] || defaultModell;

  return {
    provider,
    modell,
    openaiKey: map["ki.openai_key"],
    anthropicKey: map["ki.anthropic_key"],
  };
}

// ─── Bild analysieren ────────────────────────────────────────────────────────

export async function analyzeImage(
  base64Image: string,
  systemPrompt: string,
  feature: string,
  config?: AiConfig
): Promise<AiAnalyzeResult> {
  const cfg = config || (await getAiConfig());
  const isPdf = detectIsPdf(base64Image);

  if (cfg.provider === "anthropic") {
    return isPdf
      ? analyzeWithAnthropicPdf(base64Image, systemPrompt, feature, cfg)
      : analyzeWithAnthropic(base64Image, systemPrompt, feature, cfg);
  }
  return isPdf
    ? analyzeWithOpenAIPdf(base64Image, systemPrompt, feature, cfg)
    : analyzeWithOpenAI(base64Image, systemPrompt, feature, cfg);
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function analyzeWithOpenAI(
  base64Image: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.openaiKey) throw new Error("OpenAI API-Key nicht konfiguriert");

  const client = new OpenAI({ apiKey: cfg.openaiKey });

  const mediaType = detectMediaType(base64Image);
  const imageUrl = base64Image.startsWith("data:")
    ? base64Image
    : `data:${mediaType};base64,${base64Image}`;

  try {
    const response = await client.chat.completions.create({
      model: cfg.modell,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
            {
              type: "text",
              text: "Analysiere dieses Bild und extrahiere die relevanten Informationen als JSON.",
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content || "{}";
    const tokensIn = response.usage?.prompt_tokens || 0;
    const tokensOut = response.usage?.completion_tokens || 0;

    const parsed = parseJsonFromText(text);

    await logUsage(cfg, feature, tokensIn, tokensOut, true);

    return { raw: text, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "OpenAI Fehler");
    throw err;
  }
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function analyzeWithAnthropic(
  base64Image: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.anthropicKey) throw new Error("Anthropic API-Key nicht konfiguriert");

  const client = new Anthropic({ apiKey: cfg.anthropicKey });

  const cleanBase64 = base64Image.startsWith("data:")
    ? (base64Image.split(",")[1] ?? "")
    : base64Image;
  if (!cleanBase64) throw new Error("Ungültiges Bildformat");

  const mediaType = detectMediaType(base64Image) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  try {
    const response = await client.messages.create({
      model: cfg.modell,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: cleanBase64 },
            },
            {
              type: "text",
              text: "Analysiere dieses Bild und extrahiere die relevanten Informationen als JSON.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const tokensIn = response.usage?.input_tokens || 0;
    const tokensOut = response.usage?.output_tokens || 0;

    const parsed = parseJsonFromText(text);

    await logUsage(cfg, feature, tokensIn, tokensOut, true);

    return { raw: text, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "Anthropic Fehler");
    throw err;
  }
}

// ─── PDF: Anthropic (natives document-Format) ────────────────────────────────

async function analyzeWithAnthropicPdf(
  base64Image: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.anthropicKey) throw new Error("Anthropic API-Key nicht konfiguriert");

  const client = new Anthropic({ apiKey: cfg.anthropicKey });

  const cleanBase64 = base64Image.startsWith("data:")
    ? (base64Image.split(",")[1] ?? "")
    : base64Image;
  if (!cleanBase64) throw new Error("Ungültiges PDF-Format");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBlock: any = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: cleanBase64 },
    };

    const response = await client.messages.create({
      model: cfg.modell,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [pdfBlock, { type: "text", text: "Analysiere dieses Dokument und extrahiere die relevanten Informationen als JSON." }] as any,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const tokensIn = response.usage?.input_tokens || 0;
    const tokensOut = response.usage?.output_tokens || 0;

    const parsed = parseJsonFromText(text);
    await logUsage(cfg, feature, tokensIn, tokensOut, true);
    return { raw: text, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "Anthropic PDF Fehler");
    throw err;
  }
}

// ─── PDF: OpenAI (Responses API) ─────────────────────────────────────────────

async function analyzeWithOpenAIPdf(
  base64Image: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.openaiKey) throw new Error("OpenAI API-Key nicht konfiguriert");

  const client = new OpenAI({ apiKey: cfg.openaiKey });

  const cleanBase64 = base64Image.startsWith("data:")
    ? (base64Image.split(",")[1] ?? "")
    : base64Image;
  const dataUrl = `data:application/pdf;base64,${cleanBase64}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responses = (client as any).responses;
    const response = await responses.create({
      model: cfg.modell,
      instructions: systemPrompt,
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", filename: "rechnung.pdf", file_data: dataUrl },
            { type: "input_text", text: "Analysiere dieses Dokument und extrahiere die relevanten Informationen als JSON." },
          ],
        },
      ],
    });

    const text: string = response.output_text ?? "{}";
    const tokensIn: number = response.usage?.input_tokens ?? 0;
    const tokensOut: number = response.usage?.output_tokens ?? 0;

    const parsed = parseJsonFromText(text);
    await logUsage(cfg, feature, tokensIn, tokensOut, true);
    return { raw: text, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "OpenAI PDF Fehler");
    throw err;
  }
}

// ─── Text analysieren (Spracheingabe) ────────────────────────────────────────

export async function analyzeText(
  text: string,
  systemPrompt: string,
  feature: string,
  config?: AiConfig
): Promise<AiAnalyzeResult> {
  const cfg = config || (await getAiConfig());

  if (cfg.provider === "anthropic") {
    return analyzeTextWithAnthropic(text, systemPrompt, feature, cfg);
  }
  return analyzeTextWithOpenAI(text, systemPrompt, feature, cfg);
}

async function analyzeTextWithOpenAI(
  text: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.openaiKey) throw new Error("OpenAI API-Key nicht konfiguriert");

  const client = new OpenAI({ apiKey: cfg.openaiKey });

  try {
    const response = await client.chat.completions.create({
      model: cfg.modell,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analysiere den folgenden Text (von einer Spracheingabe) und extrahiere die relevanten Informationen als JSON:\n\n${text}`,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content || "{}";
    const tokensIn = response.usage?.prompt_tokens || 0;
    const tokensOut = response.usage?.completion_tokens || 0;

    const parsed = parseJsonFromText(responseText);
    await logUsage(cfg, feature, tokensIn, tokensOut, true);

    return { raw: responseText, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "OpenAI Fehler");
    throw err;
  }
}

async function analyzeTextWithAnthropic(
  text: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.anthropicKey) throw new Error("Anthropic API-Key nicht konfiguriert");

  const client = new Anthropic({ apiKey: cfg.anthropicKey });

  try {
    const response = await client.messages.create({
      model: cfg.modell,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analysiere den folgenden Text (von einer Spracheingabe) und extrahiere die relevanten Informationen als JSON:\n\n${text}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const responseText = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const tokensIn = response.usage?.input_tokens || 0;
    const tokensOut = response.usage?.output_tokens || 0;

    const parsed = parseJsonFromText(responseText);
    await logUsage(cfg, feature, tokensIn, tokensOut, true);

    return { raw: responseText, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "Anthropic Fehler");
    throw err;
  }
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

function parseJsonFromText(text: string): Record<string, unknown> {
  // Versuche JSON direkt zu parsen
  try {
    return JSON.parse(text);
  } catch {
    // Suche nach JSON-Block in Markdown Code-Fences
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // fall through
      }
    }
    // Suche nach erstem { ... } Block
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        // fall through
      }
    }
    return { rawText: text };
  }
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
        provider: cfg.provider,
        modell: cfg.modell,
        feature,
        tokensIn,
        tokensOut,
        kostenCent: berechneKosten(cfg.modell, tokensIn, tokensOut),
        erfolgreich,
        fehler,
      },
    });
  } catch {
    // Logging-Fehler nicht nach oben durchreichen
    console.error("KI-Nutzung konnte nicht gespeichert werden");
  }
}

export async function logError(feature: string, error: string) {
  try {
    const cfg = await getAiConfig();
    await logUsage(cfg, feature, 0, 0, false, error);
  } catch {
    console.error("logError fehlgeschlagen:", error);
  }
}

// ─── Verbindungstest ─────────────────────────────────────────────────────────

export async function testConnection(cfg: AiConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    if (cfg.provider === "openai") {
      if (!cfg.openaiKey) return { ok: false, error: "Kein API-Key" };
      const client = new OpenAI({ apiKey: cfg.openaiKey });
      await client.models.retrieve(cfg.modell || "gpt-4o");
      return { ok: true };
    } else {
      if (!cfg.anthropicKey) return { ok: false, error: "Kein API-Key" };
      const client = new Anthropic({ apiKey: cfg.anthropicKey });
      await client.messages.create({
        model: cfg.modell || "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      });
      return { ok: true };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unbekannter Fehler" };
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
Analysiere das Bild und extrahiere Kunden- und Artikelinformationen.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "kunde": {
    "name": "Kundenname",
    "firma": "Firmenname falls vorhanden",
    "ort": "Ort falls erkennbar"
  },
  "datum": "YYYY-MM-DD",
  "positionen": [
    {
      "name": "Artikelbezeichnung",
      "artikelnummer": "Artikelnummer falls vorhanden",
      "menge": 100,
      "einheit": "kg|t|Sack|Liter|Stück",
      "einzelpreis": 12.50
    }
  ]
}

Wenn ein Feld nicht erkennbar ist, setze null.`,

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
  "kategorie": "Eine der folgenden Kategorien: Wareneinkauf | Betriebsbedarf | Fahrtkosten | Bürobedarf | Telefon/Internet | Versicherung | Miete | Sonstige"
}

Regeln:
- "mwstSatz" muss 0, 7 oder 19 sein. Wenn mehrere Sätze auf dem Beleg, wähle den dominanten.
- "betragNetto" und "betragBrutto" als Dezimalzahl mit Punkt (kein €-Zeichen).
- Wenn Netto nicht direkt angegeben: berechne aus Brutto und MwSt.
- "faelligAm": Berechne aus Rechnungsdatum + Zahlungsziel (z.B. "30 Tage netto" → datum + 30 Tage). Falls kein Zahlungsziel angegeben: null.
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
- Bei einer Düngungsempfehlungs-Anlage: NUR 'empfehlungen' befüllen, alle Werte = null lassen. Setze
  empfehlungen-Spalten aus der Tabelle als Strings die der Spaltenüberschrift entsprechen (Camelcase ohne
  Sonderzeichen). Wenn unsicher, übernimm die Werte einer ganzen Zeile als JSON-Objekt mit lesbaren Keys.
- Eine PDF mit BEIDEN Bestandteilen: kombiniere — selbe Proben-Nr. = selbes Objekt im 'proben'-Array.
- ALLE Proben des Berichts extrahieren — NICHT nur die ersten. Bei 15 Proben gib 15 Objekte zurück.
- Setze "berichtArt" entsprechend ("pruefbericht" für Werte-Bericht, "duengungsempfehlung" für reine
  Empfehlungstabelle, "kombiniert" wenn beides vorliegt).
- P₂O₅ (Phosphor als Phosphorpentoxid) und K₂O (Kalium als Kaliumoxid) sind die Standardwerte.
- Einheiten: pH dimensionslos · P/K/Mg/S mg/100g · Bor/Zn/Cu/Mn/Na mg/kg · KAK cmol+/kg
  · Humus % · nMin kg N/ha · Corg % · N_ges % · cn dimensionslos
- Kalkbedarf: kalkbedarfDt = Wert in dt CaO/ha (IfB nutzt dt). Falls Bericht t/ha angibt, in dt umrechnen
  (1 t = 10 dt) und beides setzen.
- Klassenkürzel A–F nach LWK Niedersachsen (A sehr niedrig, B niedrig, C anzustreben, D hoch,
  E sehr hoch, F extrem hoch). Falls Labor nur A–E nutzt, F nicht setzen.
- Bodenart-Kürzel: S (Sand), lS (lehmiger Sand), sL (sandiger Lehm), L (Lehm), sT (sandiger Ton),
  T (Ton), Mo (Moor) etc. Die Gruppe '(h)' = humos / '(s)' = sandig / '(l)' = lehmig wird separat als
  'bodenartGruppe' geliefert.
- Wenn ein Feld nicht erkennbar ist: null setzen, NIEMALS Werte erfinden.
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
- typ-Whitelist exakt einhalten. Spritzgerätekontrolle ist die Plakette/Bescheinigung der JKI-anerkannten
  Kontrollwerkstatt (alle 3 Jahre).
- gueltigBis: bei PSM-Sachkunde steht oft kein direktes Ablaufdatum — leiten ab aus Ausstellungsdatum + 3 Jahre
  Fortbildungsintervall, wenn nichts anderes vermerkt ist; alternativ null.
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
- Schlagname bevorzugt der vom Landwirt vergebene Eigenname; sonst die Flurstücks-Nr.
- 'flaeche' immer in Hektar (ha). Falls in ar oder m² angegeben → umrechnen (1 ha = 100 ar = 10 000 m²).
- fruchtart-Kürzel ausschreiben (WW = Winterweizen, SM = Silomais, WR = Winterraps, ZR = Zuckerrüben,
  WG = Wintergerste, SG = Sommergerste, SH = Silohirse, EG = Erbsen, AB = Ackerbohnen, KL = Klee,
  LG = Luzerne-Gras, GR = Grünland, DK = Dauerkultur).
- ALLE Schläge des Antrags zurückgeben — nicht nur die ersten. Bei 30 Schlägen gib 30 Objekte zurück.
- Doppelte Einträge (z.B. Brutto- und Netto-Fläche) zu einem zusammenfassen.
- Antworte NUR mit JSON — keine Erklärungen, keine Markdown-Codeblöcke.`,

  mahnungstext: `Du bist ein professioneller Geschäftsbrief-Assistent für ein Agrarunternehmen
(Landhandel, Futtermittel, Düngemittel, Saatgut). Du verfasst eine Mahnung an einen Kunden in
freundlich-bestimmtem Ton — kein aggressiver Stil. B2B-Landwirtschaft = persönliche
Geschäftsbeziehung.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format (ohne Markdown-Codeblöcke):
{
  "betreff": "Betreffzeile (knapp, ohne Anrede)",
  "anrede": "Sehr geehrter Herr/Frau …, oder bei langjährigen Kunden 'Guten Tag Herr/Frau …'",
  "text": "Volltext-Brief (deutscher Geschäftsbrief, ohne Anrede und ohne Grußformel — diese werden separat eingesetzt). Plain Text, keine Markdown-Formatierung. Absätze mit \\n\\n trennen.",
  "gruss": "Schlussformel z.B. 'Mit freundlichen Grüßen' oder 'Mit landwirtschaftlichen Grüßen'",
  "hinweis": "Optional: Hinweis für den Sachbearbeiter (intern, nicht für den Kunden)"
}

Anpassung je Mahnstufe:
- Stufe 1 (Zahlungserinnerung): freundlich, mögliches Versehen unterstellen, keine Mahngebühr betonen.
  Frist: 7 Tage.
- Stufe 2 (Mahnung): bestimmt, auf bereits ergangene Erinnerung verweisen, Mahngebühr und Verzugszinsen
  benennen. Frist: 7 Tage.
- Stufe 3 (Letzte Mahnung): klar, mit Hinweis auf gerichtliches Mahnverfahren/Inkasso bei weiterem
  Verzug, Mahngebühr und Verzugszinsen quantifizieren. Frist: 7 Tage.

Regeln:
- Konkrete Rechnungsnummer(n), Datum(e) und offene Beträge im Text nennen.
- Bei langjähriger Beziehung (Kunde >5 Jahre, hohe Vorjahresumsätze) ggf. Bemerkung "in unserer langjährigen
  Geschäftsbeziehung" — sonst weglassen.
- Konkrete IBAN/Bankverbindung NICHT erfinden — Platzhalter "[IBAN siehe Rechnung]" nutzen.
- Keine Drohungen oder ultimative Formulierungen unterhalb von Stufe 3.
- Antworte NUR mit JSON — keine Erklärungen, keine Markdown-Codeblöcke.`,

  belegtyp: `Du bist ein Klassifizierer für hochgeladene Geschäftsdokumente eines Agrarhändlers.
Bestimme den TYP des Dokuments und gib die wahrscheinlichste Verarbeitungs-Maske an.

Mögliche Typen:
- "lieferschein"      — eingehender Lieferschein vom Lieferanten (Wareneingang)
- "rechnung"          — eingehende Lieferanten-Rechnung
- "bodenprobe"        — Laborbericht Bodenuntersuchung (LUFA/AGROLAB/Eurofins/IfB)
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
- Bei Mischformen (z.B. Lieferschein + Rechnung in einer PDF) den DOMINANTEN Typ wählen.
- Antworte NUR mit JSON.`,

  sortenversuch: `Du bist ein Experte für Sortenversuchs-Auswertungen aus dem Agrarbereich
(Landessortenversuche, Demoflächen, Streifenversuche von Saatgut-Vermehrern oder Beratungsorganisationen
wie LWK, LfL, Bayer/BASF/KWS/DSV/IG-Pflanzenzucht).

Eine Auswertungstabelle enthält pro Sorte eine Zeile mit Ertrag, Qualitätsparametern und Bonituren.

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
- Erträge IMMER in dt/ha. Falls Tabelle in t/ha → ×10. Falls in kg/ha → ÷100.
- Bonitur als 1–9-Skala (1 = sehr gut, 9 = sehr schlecht). Falls Tabelle 1–5-Skala nutzt, ×1,8 zur
  Umrechnung NICHT machen — stattdessen Wert übernehmen und im hinweis darauf hinweisen.
- Saatstärke entweder Körner/m² oder kg/ha — Einheit aus der Tabelle übernehmen, der Wert allein wird
  gespeichert.
- ALLE Sortenzeilen extrahieren (auch Standardsorten am Tabellenende).
- Antworte NUR mit JSON — keine Markdown-Codeblöcke.`,

  visitenkarte: `Du bist ein OCR-Assistent für Visitenkarten und Kontaktdaten im B2B-Agrarbereich
(Landwirt, Berater, Lieferant, Genossenschaft, Maschinenring).

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format (ohne Markdown-Codeblöcke):
{
  "vorname": "Vorname oder null",
  "nachname": "Nachname (inkl. Titel wie 'Dr.') oder null",
  "firma": "Firma/Betrieb/Genossenschaft oder null",
  "position": "Funktion/Rolle z.B. 'Geschäftsführer', 'Außendienst Futtermittel', sonst null",
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
- Telefonnummern als String mit Leerzeichen-Gruppierung (z.B. "05151 9871 24"). Keine Klammern um die Vorwahl.
- E-Mail immer kleingeschrieben.
- Wenn mehrere Telefonnummern: die mit Bezeichnung "Mobil"/"Handy"/"+49 17…"/"+49 15…" als 'mobil', den Rest als 'telefon'.
- Wenn nur ein Name ohne Position erkennbar: position = null, nicht erfinden.
- Antworte NUR mit JSON — keine Erklärungen, keine Markdown-Codeblöcke.`,

  inhaltsstoffe: `Du bist ein Experte für Agrarprodukte (Futtermittel, Ergänzungsfutter, Mineralfutter, Düngemittel, Saatgut, Pflanzenhilfsmittel).
Recherchiere die Inhaltsstoffe / Zusammensetzung des genannten Produkts anhand seines Namens.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "inhaltsstoffe": [
    { "name": "Rohprotein", "menge": 12.5, "einheit": "%" },
    { "name": "Schwefel", "menge": 90, "einheit": "%" }
  ],
  "hinweis": "Optionaler Hinweis falls das Produkt nicht eindeutig identifiziert werden konnte"
}

Regeln:
- Gib nur Inhaltsstoffe an, die du sicher kennst oder die sich aus dem Produktnamen eindeutig ableiten lassen. Erfinde KEINE Werte.
- "menge" kann null sein wenn der Wert unbekannt ist; "einheit" leer lassen wenn nicht anwendbar.
- Einheiten: typischerweise "%", "mg/kg", "g/kg", "MJ/kg", "g/l", "IE/kg"

Produkttypen und relevante Inhaltsstoffe:

PFERDEFUTTER / ERGÄNZUNGSFUTTER (z.B. marstall, Agrobs, Pavo):
  Grundfutter/Müsli: Rohprotein, Rohfett, Rohfaser, Rohasche, Stärke, Zucker, Calcium, Phosphor, Natrium, Magnesium, Energie (MJ DE/kg)
  Mineralfutter/Ergänzung: je nach Produkt die deklarierten Spurenelemente (Zn, Cu, Mn, Fe, I, Se, Co), Vitamine (A, D3, E, B1, B2, Biotin), Aminosäuren (Lysin, Methionin)
  Produkt-Hinweise marstall:
    - "Magnesium" → Hauptwirkstoff Magnesium (Mg), Angabe in % oder mg/kg
    - "Biotin & Zink" → Biotin (μg/kg), Zink (Zn, mg/kg)
    - "Elektrolyte" → Na, K, Cl, Mg
    - "Vitamin E & Selen" → Vitamin E (mg/kg oder IE/kg), Selen (Se, mg/kg)
    - "Force" / Mineralfutter → Rohprotein, Rohasche, Ca, P, Na, Mg + Spurenelemente
    - "FlexoFit" → Glucosamin, Chondroitin, MSM, Teufelskralle
    - "ProAir" → Menthol, ätherische Öle, Eukalyptus
    - "ProGastro" → Pektin, Leinsamen, Bentonit, MOS
    - "Huf-Regulator" → Biotin, Zink, Methionin, Kieselsäure
    - "Darm-Regulator" → Probiotika, Präbiotika (FOS/MOS), Bentonit
    - "Kollagen" → Kollagenhydrolysat, Aminosäurenprofil
    - "Leinöl" → Omega-3 (ALA), Omega-6, Rohfett
    - "Mash" → Weizenkleie, Leinsamen, Rohfaser, Rohprotein
    - "Granutop" → Flohsamenschalen, Leinsamen, Inulin (FOS)
    - "Amino-Muskel" → Rohprotein, Lysin, Methionin, BCAA
    - "MineralOrganic+" → organisch gebundene Spurenelemente (Zn, Cu, Mn, Se)
    - Wiesen-Cobs/Fasern/Chips → Rohfaser, Rohprotein, Stärke, Energie

DÜNGEMITTEL / SCHWEFELPRODUKTE (z.B. BvG, Compo, SKW):
  S-Produkte: Schwefel (S, %), Bentonit (%), ggf. Bor (B, %), Selen (Se, %), Stickstoff (N, %)
  Flüssigschwefel: S (%), Dichte (g/l)
  N-Dünger: N gesamt, davon NO3-N, NH4-N, Harnstoff-N; ggf. S, MgO, CaO
  P/K-Dünger: P2O5, K2O; ggf. S, Na, Cl
  Spurennährstoffe: B, Cu, Fe, Mn, Mo, Zn, Se – jeweils in %

PFLANZENHILFSMITTEL / EFFEKTIVE MIKROORGANISMEN:
  Wirkstoff und Konzentration, pH-Wert, ggf. Zuckergehalt

SAATGUT:
  Sortenname, Keimfähigkeit (%), TKG (g), Tausendkorngewicht

- WICHTIG: Wenn du das exakte Produkt nicht kennst, ordne es anhand des Namens einem ähnlichen/verwandten Produkt zu und gib dessen Werte als Näherung zurück.
- Wenn du ähnliche Produkte findest, fülle "aehnlicheProdukte" mit bis zu 3 Vorschlägen.
- Nur wenn du gar keine Zuordnung machen kannst, gib ein leeres Array und einen Hinweis zurück.

Erweitertes Antwortformat:
{
  "inhaltsstoffe": [...],
  "aehnlicheProdukte": ["Produktname 1 (Hersteller)", "Produktname 2"],
  "hinweis": "Optionaler Hinweis"
}`,
};
