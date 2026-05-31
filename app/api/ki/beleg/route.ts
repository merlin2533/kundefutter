import { NextRequest, NextResponse } from "next/server";
import { analyzeImage, getAiConfig, PROMPTS } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const KATEGORIEN = [
  "Wareneinkauf",
  "Betriebsbedarf",
  "Fahrtkosten",
  "Bürobedarf",
  "Telefon/Internet",
  "Versicherung",
  "Miete",
  "Personal",
  "Sonstige",
];

export async function POST(req: NextRequest) {
  try {
    let image: string | undefined;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
      }
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mime = file.type || "application/octet-stream";
      image = `data:${mime};base64,${base64}`;
    } else {
      const body = await req.json();
      image = (body as { image?: string }).image;
    }

    if (!image) {
      return NextResponse.json({ error: "Kein Bild/PDF übergeben" }, { status: 400 });
    }

    // Allow custom prompt override from settings
    const promptRow = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.beleg" } });
    const prompt = (promptRow?.value?.trim()) || PROMPTS.beleg;

    const cfg = await getAiConfig();
    const result = await analyzeImage(image, prompt, "beleg", cfg);

    const p = result.parsed as Record<string, unknown>;

    // Sanitize and validate the extracted fields
    const kategorie = KATEGORIEN.includes(String(p.kategorie ?? "")) ? String(p.kategorie) : "Sonstige";
    const mwstRaw = Number(p.mwstSatz ?? 19);
    const mwstSatz = [0, 7, 19].includes(mwstRaw) ? mwstRaw : 19;

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    // IBAN validieren: muss mit 2-Buchstaben-Ländercode beginnen, dann Ziffern
    const ibanRaw = typeof p.iban === "string" ? p.iban.replace(/\s/g, "").toUpperCase() : null;
    const iban = ibanRaw && /^[A-Z]{2}[0-9A-Z]{10,30}$/.test(ibanRaw) ? ibanRaw : null;
    const bic = typeof p.bic === "string" && p.bic.trim() ? p.bic.trim().toUpperCase() : null;

    return NextResponse.json({
      datum: typeof p.datum === "string" && datePattern.test(p.datum) ? p.datum : null,
      belegNr: typeof p.belegNr === "string" ? p.belegNr : null,
      faelligAm: typeof p.faelligAm === "string" && datePattern.test(p.faelligAm) ? p.faelligAm : null,
      beschreibung: typeof p.beschreibung === "string" ? p.beschreibung.substring(0, 80) : null,
      betragNetto: typeof p.betragNetto === "number" ? Math.round(p.betragNetto * 100) / 100 : null,
      betragBrutto: typeof p.betragBrutto === "number" ? Math.round(p.betragBrutto * 100) / 100 : null,
      mwstSatz,
      kategorie,
      lieferant: typeof p.lieferant === "string" ? p.lieferant : null,
      iban,
      bic,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
  } catch (err) {
    console.error("KI Beleg-Analyse Fehler:", err);
    return NextResponse.json(
      { error: "KI-Analyse fehlgeschlagen" },
      { status: 500 }
    );
  }
}
