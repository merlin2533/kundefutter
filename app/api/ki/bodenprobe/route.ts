import { NextRequest, NextResponse } from "next/server";
import { PROMPTS, KOSTEN_MAP } from "@/lib/ai";
import { analyzeDocumentFile, parseJsonFromText, strOrNull, numOrNull } from "@/lib/ki-document";
import { getUploadBase } from "@/lib/upload";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
    }

    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: "Datei zu groß (max. 30 MB)" }, { status: 413 });
    }

    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Nur PDF oder Bilddateien erlaubt" },
        { status: 400 }
      );
    }

    // Load custom prompt or use default
    const promptRow = await prisma.einstellung.findUnique({
      where: { key: "ki.prompt.bodenprobe" },
    });
    const prompt = promptRow?.value?.trim() || PROMPTS.bodenprobe;

    // ── Save file to disk (for belegPfad) ──────────────────────────────────
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
    const filename = `${timestamp}-${safeName}`;
    const uploadDir = path.join(getUploadBase(), "bodenproben");

    await mkdir(uploadDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, Buffer.from(bytes));

    const belegPfad = `bodenproben/${filename}`;
    const belegName = file.name;

    // ── Analyse via KI ──────────────────────────────────────────────────────
    // 15+ Proben mit allen Feldern + Empfehlungstabelle brauchen reichlich Output-Budget
    const kiResult = await analyzeDocumentFile(file, prompt, "bodenprobe", {
      maxTokens: 16000,
      userText: "Analysiere diesen Bodenproben-Laborbericht und extrahiere alle Werte als JSON.",
    });
    const raw = kiResult.raw;
    const tokensIn = kiResult.tokensIn;
    const tokensOut = kiResult.tokensOut;
    const cfg = kiResult.cfg;

    // ── Parse and sanitize result ───────────────────────────────────────────
    const parsed = parseJsonFromText(raw);

    function klasseOrNull(v: unknown): string | null {
      const s = strOrNull(v);
      return s && ["A", "B", "C", "D", "E", "F"].includes(s.toUpperCase()) ? s.toUpperCase() : null;
    }
    function datumOrNull(v: unknown): string | null {
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      return null;
    }

    function sanitizeProbe(p: Record<string, unknown>) {
      const emp = p.empfehlungen && typeof p.empfehlungen === "object" ? p.empfehlungen : null;
      return {
        probenNr: strOrNull(p.probenNr),
        schlagName: strOrNull(p.schlagName),
        nutzungsart: strOrNull(p.nutzungsart),
        bodenart: strOrNull(p.bodenart),
        bodenartGruppe: strOrNull(p.bodenartGruppe),
        tiefe: strOrNull(p.tiefe),
        pH: numOrNull(p.pH),
        pHSoll: strOrNull(p.pHSoll),
        phosphor: numOrNull(p.phosphor),
        kalium: numOrNull(p.kalium),
        magnesium: numOrNull(p.magnesium),
        bor: numOrNull(p.bor),
        schwefel: numOrNull(p.schwefel),
        zink: numOrNull(p.zink),
        kupfer: numOrNull(p.kupfer),
        mangan: numOrNull(p.mangan),
        natrium: numOrNull(p.natrium),
        kak: numOrNull(p.kak),
        kalkbedarf: numOrNull(p.kalkbedarf),
        kalkbedarfDt: numOrNull(p.kalkbedarfDt),
        humus: numOrNull(p.humus),
        corg: numOrNull(p.corg),
        nGesamt: numOrNull(p.nGesamt),
        nMin: numOrNull(p.nMin),
        cn: numOrNull(p.cn),
        klasseP: klasseOrNull(p.klasseP),
        klasseK: klasseOrNull(p.klasseK),
        klasseMg: klasseOrNull(p.klasseMg),
        klasseBor: klasseOrNull(p.klasseBor),
        klasseSchwefel: klasseOrNull(p.klasseSchwefel),
        klasseZink: klasseOrNull(p.klasseZink),
        klasseKupfer: klasseOrNull(p.klasseKupfer),
        klasseMangan: klasseOrNull(p.klasseMangan),
        klasseNatrium: klasseOrNull(p.klasseNatrium),
        empfehlungen: emp,
      };
    }

    // Unterstütze sowohl das neue Multi-Proben-Format als auch das alte Einzel-Proben-Format
    type ProbeRaw = Record<string, unknown>;
    const probenRaw: ProbeRaw[] = Array.isArray(parsed.proben)
      ? (parsed.proben as ProbeRaw[])
      : [parsed as ProbeRaw];
    const proben = probenRaw.map(sanitizeProbe);

    const auftragRaw = (parsed.auftrag && typeof parsed.auftrag === "object")
      ? parsed.auftrag as Record<string, unknown>
      : {};

    const auftrag = {
      labor: strOrNull(auftragRaw.labor) ?? strOrNull(parsed.labor),
      auftragsNr: strOrNull(auftragRaw.auftragsNr),
      kundeNrLabor: strOrNull(auftragRaw.kundeNrLabor),
      probenahmeDatum: datumOrNull(auftragRaw.probenahmeDatum) ?? datumOrNull(parsed.datum),
      berichtDatum: datumOrNull(auftragRaw.berichtDatum),
      probenehmer: strOrNull(auftragRaw.probenehmer),
      kundeName: strOrNull(auftragRaw.kundeName),
      kundeAdresse: strOrNull(auftragRaw.kundeAdresse),
      berichtArt: strOrNull(auftragRaw.berichtArt) ?? "pruefbericht",
    };

    const hinweis = strOrNull(parsed.hinweis);

    // Legacy-Kompatibilitätsblock: erstes-Proben-Objekt im alten Schema
    const erste = proben[0] ?? null;
    const data = erste ? {
      ...erste,
      labor: auftrag.labor,
      datum: auftrag.probenahmeDatum,
      auftragsNr: auftrag.auftragsNr,
      probenehmer: auftrag.probenehmer,
      kundeNrLabor: auftrag.kundeNrLabor,
      hinweis,
    } : null;

    const rate = KOSTEN_MAP[cfg.modell];
    const kostenCent = rate ? Math.round((tokensIn * rate.input + tokensOut * rate.output) / 1_000_000) : 0;

    return NextResponse.json({
      auftrag,
      proben,
      data,           // Backwards-Compat: erstes Probe-Objekt im alten Schema
      hinweis,
      belegPfad,
      belegName,
      tokens: tokensIn + tokensOut,
      kostenCent,
    });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen";
    console.error("KI Bodenprobe-Analyse Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
