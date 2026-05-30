import { NextRequest, NextResponse } from "next/server";
import { PROMPTS, analyzeText, getAiConfig } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { parseJsonFromText, strOrNull } from "@/lib/ki-document";

export const dynamic = "force-dynamic";

// POST /api/ki/mahnungstext
// Body: { kundeId, mahnstufe (1|2|3), rechnungen: [{nr, datum, betrag, tageUeberfaellig}],
//         mahngebuehr?: number, frist?: string (YYYY-MM-DD) }
export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const body = await req.json();
    const kundeId = parseInt(String(body.kundeId), 10);
    const stufe = parseInt(String(body.mahnstufe), 10);
    if (isNaN(kundeId)) return NextResponse.json({ error: "kundeId erforderlich" }, { status: 400 });
    if (![1, 2, 3].includes(stufe)) return NextResponse.json({ error: "mahnstufe muss 1, 2 oder 3 sein" }, { status: 400 });
    if (!Array.isArray(body.rechnungen) || body.rechnungen.length === 0) {
      return NextResponse.json({ error: "rechnungen[] erforderlich" }, { status: 400 });
    }

    const kunde = await prisma.kunde.findUnique({
      where: { id: kundeId },
      include: { kontakte: { take: 5 } },
    });
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    // Kundenhistorie: erste Lieferung (Alter der Geschäftsbeziehung)
    const ersteLieferung = await prisma.lieferung.findFirst({
      where: { kundeId },
      orderBy: { datum: "asc" },
      select: { datum: true },
    });
    const beziehungsJahre = ersteLieferung
      ? Math.floor((Date.now() - ersteLieferung.datum.getTime()) / (365.25 * 86400000))
      : null;

    const summeOffen = body.rechnungen.reduce((s: number, r: { betrag?: number }) =>
      s + (Number(r.betrag) || 0), 0);

    const rechnungenText = body.rechnungen.map((r: { nr?: string; datum?: string; betrag?: number; tageUeberfaellig?: number }) =>
      `- Rechnung ${r.nr ?? "(ohne Nr.)"} vom ${r.datum ?? "(kein Datum)"}, Betrag ${Number(r.betrag ?? 0).toFixed(2)} € — ${r.tageUeberfaellig ?? 0} Tage überfällig`
    ).join("\n");

    const prompt = (await prisma.einstellung.findUnique({ where: { key: "ki.prompt.mahnungstext" } }))?.value?.trim()
      || PROMPTS.mahnungstext;

    const stufeText = stufe === 1 ? "Zahlungserinnerung (Stufe 1)" : stufe === 2 ? "Mahnung (Stufe 2)" : "Letzte Mahnung (Stufe 3)";
    const kundenName = kunde.firma || kunde.name;
    const hauptKontakt = kunde.kontakte.find(k => k.nachname) ?? kunde.kontakte[0];
    const anrede = hauptKontakt
      ? `${hauptKontakt.vorname ?? ""} ${hauptKontakt.nachname ?? ""}`.trim() || kundenName
      : kundenName;

    const userText = `Kunde: ${kundenName}
Ansprechpartner: ${anrede}
Mahnstufe: ${stufeText}
Geschäftsbeziehung: ${beziehungsJahre != null ? `${beziehungsJahre} Jahr(e)` : "unbekannt"}
${body.mahngebuehr ? `Mahngebühr (anzusetzen): ${Number(body.mahngebuehr).toFixed(2)} €` : ""}
${body.frist ? `Neue Zahlungsfrist: bis ${body.frist}` : ""}

Offene Rechnungen (Summe: ${summeOffen.toFixed(2)} €):
${rechnungenText}

Verfasse den Mahntext gemäß den Stufenregeln.`;

    const cfg = await getAiConfig();

    // Konfigurationscheck – user-facing Fehlermeldung (kein isDev-Guard nötig)
    if (cfg.provider === "openai" && !cfg.openaiKey) {
      return NextResponse.json(
        { error: "OpenAI API-Key nicht konfiguriert. Bitte unter Einstellungen → KI hinterlegen." },
        { status: 422 }
      );
    }
    if (cfg.provider === "anthropic" && !cfg.anthropicKey) {
      return NextResponse.json(
        { error: "Anthropic API-Key nicht konfiguriert. Bitte unter Einstellungen → KI hinterlegen." },
        { status: 422 }
      );
    }

    const result = await analyzeText(userText, prompt, "mahnungstext", cfg);
    const p = parseJsonFromText(result.raw);

    return NextResponse.json({
      betreff: strOrNull(p.betreff) ?? `${stufeText} — offene Rechnungen`,
      anrede: strOrNull(p.anrede) ?? `Sehr geehrte/r ${anrede},`,
      text: strOrNull(p.text) ?? "",
      gruss: strOrNull(p.gruss) ?? "Mit freundlichen Grüßen",
      hinweis: strOrNull(p.hinweis),
      tokens: result.tokensIn + result.tokensOut,
    });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen";
    console.error("KI Mahnungstext-Generierung Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
