import { NextRequest, NextResponse } from "next/server";
import { PROMPTS } from "@/lib/ai";
import { analyzeDocumentFile, parseJsonFromText, strOrNull } from "@/lib/ki-document";
import { getUploadBase } from "@/lib/upload";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const TYPEN_WHITELIST = new Set([
  "PSM-Sachkunde",
  "Spritzgeraetekontrolle",
  "Duengerschulung",
  "Sprengstoff-Sachkunde",
  "Mais-Beize-Sachkunde",
  "Wildlebensmittel-Schulung",
  "Sonstige",
]);

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

    const promptRow = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.sachkundenachweis" } });
    const prompt = promptRow?.value?.trim() || PROMPTS.sachkundenachweis;

    // Datei speichern
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
    const filename = `${ts}-${safeName}`;
    const uploadDir = path.join(getUploadBase(), "sachkunde");
    await mkdir(uploadDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
    const belegPfad = `sachkunde/${filename}`;
    const belegName = file.name;

    const kiResult = await analyzeDocumentFile(file, prompt, "sachkundenachweis", {
      maxTokens: 1500,
      userText: "Extrahiere die Sachkundenachweis-Daten als JSON.",
    });
    const raw = kiResult.raw;
    const tokensIn = kiResult.tokensIn;
    const tokensOut = kiResult.tokensOut;

    const p = parseJsonFromText(raw);
    function datumOrNull(v: unknown): string | null {
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      return null;
    }
    const typRaw = strOrNull(p.typ);
    const data = {
      typ: typRaw && TYPEN_WHITELIST.has(typRaw) ? typRaw : "Sonstige",
      inhaberName: strOrNull(p.inhaberName),
      nummer: strOrNull(p.nummer),
      ausstellung: datumOrNull(p.ausstellung),
      gueltigBis: datumOrNull(p.gueltigBis),
      ausgestelltVon: strOrNull(p.ausgestelltVon),
      hinweis: strOrNull(p.hinweis),
    };

    return NextResponse.json({ data, belegPfad, belegName, tokens: tokensIn + tokensOut });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen";
    console.error("KI Sachkundenachweis-Analyse Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
