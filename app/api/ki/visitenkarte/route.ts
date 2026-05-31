import { NextRequest, NextResponse } from "next/server";
import { getAiConfig, analyzeImage, PROMPTS } from "@/lib/ai";
import { parseJsonFromText, strOrNull } from "@/lib/ki-document";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Nur Bilddateien (Foto der Visitenkarte) erlaubt" }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Bild zu groß (max. 15 MB)" }, { status: 413 });

    const promptRow = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.visitenkarte" } });
    const prompt = promptRow?.value?.trim() || PROMPTS.visitenkarte;
    const cfg = await getAiConfig();

    const bytes = await file.arrayBuffer();
    const dataUrl = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
    const result = await analyzeImage(dataUrl, prompt, "visitenkarte", cfg);

    const p = parseJsonFromText(result.raw);
    const data = {
      vorname: strOrNull(p.vorname),
      nachname: strOrNull(p.nachname),
      firma: strOrNull(p.firma),
      position: strOrNull(p.position),
      telefon: strOrNull(p.telefon),
      mobil: strOrNull(p.mobil),
      fax: strOrNull(p.fax),
      email: strOrNull(p.email)?.toLowerCase() ?? null,
      website: strOrNull(p.website),
      strasse: strOrNull(p.strasse),
      plz: strOrNull(p.plz),
      ort: strOrNull(p.ort),
      hinweis: strOrNull(p.hinweis),
    };

    return NextResponse.json({ data, tokens: result.tokensIn + result.tokensOut });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen";
    console.error("KI Visitenkarte-Analyse Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
