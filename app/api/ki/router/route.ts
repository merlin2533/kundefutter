import { NextRequest, NextResponse } from "next/server";
import { PROMPTS } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { analyzeDocumentFile, parseJsonFromText, strOrNull, numOrNull } from "@/lib/ki-document";

export const dynamic = "force-dynamic";

// Mapping: erkannter Typ → Frontend-Maske (Pfad zur Erfassung).
// Die Route gibt redirectUrl zurück; das Frontend kann sie 1:1 öffnen.
const ROUTING: Record<string, { redirectUrl: string; label: string }> = {
  lieferschein:     { redirectUrl: "/ki/wareneingang",        label: "Wareneingang" },
  rechnung:         { redirectUrl: "/ki/lieferung",           label: "Lieferungs-/Rechnungs-Erkennung" },
  bodenprobe:       { redirectUrl: "/bodenproben/neu",        label: "Bodenprobe" },
  sachkundenachweis:{ redirectUrl: "/sachkundenachweise/neu", label: "Sachkundenachweis" },
  visitenkarte:     { redirectUrl: "/kunden",                 label: "Visitenkarte → Kontakt (im Kundendetail scannen)" },
  sortenversuch:    { redirectUrl: "/sortenversuche/neu",     label: "Sortenversuch" },
  agrarantrag:      { redirectUrl: "/kunden",                 label: "AFIG/HIT-Antrag → Schläge (im Kundendetail importieren)" },
  ausgabenbeleg:    { redirectUrl: "/ausgaben/neu",           label: "Ausgabenbeleg" },
  unbekannt:        { redirectUrl: "",                        label: "Unbekannter Belegtyp" },
};

// POST /api/ki/router — Multipart: file=PDF/Bild
// → klassifiziert den Belegtyp und liefert die Ziel-Maske
export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
    if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: "Datei zu groß (max. 30 MB)" }, { status: 413 });
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Nur PDF oder Bilddateien erlaubt" }, { status: 400 });
    }

    const promptRow = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.belegtyp" } });
    const prompt = promptRow?.value?.trim() || PROMPTS.belegtyp;

    // Klassifizierung ist kurz — niedrige max_tokens reichen
    const result = await analyzeDocumentFile(file, prompt, "router",
      { maxTokens: 500, userText: "Klassifiziere dieses Dokument." });

    const p = parseJsonFromText(result.raw);
    const typRaw = (strOrNull(p.typ) ?? "unbekannt").toLowerCase();
    const typ = ROUTING[typRaw] ? typRaw : "unbekannt";
    const confidence = Math.max(0, Math.min(1, numOrNull(p.confidence) ?? 0));
    const finalTyp = confidence < 0.5 ? "unbekannt" : typ;

    return NextResponse.json({
      typ: finalTyp,
      confidence,
      begruendung: strOrNull(p.begruendung),
      hinweis: strOrNull(p.hinweis),
      redirectUrl: ROUTING[finalTyp].redirectUrl,
      maskeName: ROUTING[finalTyp].label,
      tokens: result.tokensIn + result.tokensOut,
    });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen";
    console.error("KI Router-Klassifizierung Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
