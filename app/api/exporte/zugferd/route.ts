import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateZugferdXml, ZugferdData } from "@/lib/zugferd-xml";

// GET /api/exporte/zugferd?lieferungId=N
// GET /api/exporte/zugferd?sammelrechnungId=N
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferungIdStr = searchParams.get("lieferungId");
  const sammelrechnungIdStr = searchParams.get("sammelrechnungId");

  try {
    // ── Firmendaten laden ──────────────────────────────────────────────────────
    const einstellungen = await prisma.einstellung.findMany({
      where: { key: { startsWith: "firma." } },
    });
    const firmaCfg: Record<string, string> = {};
    for (const e of einstellungen) {
      firmaCfg[e.key] = e.value;
    }

    const firma: ZugferdData["firma"] = {
      name: firmaCfg["firma.firmenname"] ?? "",
      strasse: firmaCfg["firma.adresse"] ?? "",
      plz: firmaCfg["firma.plz"] ?? "",
      ort: firmaCfg["firma.ort"] ?? "",
      ustIdNr: firmaCfg["firma.ustidnr"] || undefined,
      steuernummer: firmaCfg["firma.steuernr"] || undefined,
      iban: firmaCfg["firma.iban"] || undefined,
      bic: firmaCfg["firma.bic"] || undefined,
      bank: firmaCfg["firma.bankname"] || undefined,
    };

    // ── Lieferung ──────────────────────────────────────────────────────────────
    if (lieferungIdStr) {
      const lieferungId = parseInt(lieferungIdStr, 10);
      if (isNaN(lieferungId)) {
        return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
      }

      const lieferung = await prisma.lieferung.findUnique({
        where: { id: lieferungId },
        include: {
          kunde: true,
          positionen: { include: { artikel: true } },
        },
      });

      if (!lieferung) {
        return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
      }
      if (!lieferung.rechnungNr) {
        return NextResponse.json({ error: "Lieferung hat noch keine Rechnungsnummer" }, { status: 400 });
      }

      const rechnungDatum = lieferung.rechnungDatum
        ? new Date(lieferung.rechnungDatum)
        : new Date(lieferung.datum);

      const data: ZugferdData = {
        rechnungNr: lieferung.rechnungNr,
        datum: rechnungDatum,
        lieferDatum: lieferung.lieferDatum
          ? new Date(lieferung.lieferDatum)
          : new Date(lieferung.datum),
        zahlungsziel: lieferung.zahlungsziel ?? 30,
        firma,
        kunde: {
          name: lieferung.kunde.name,
          firma: lieferung.kunde.firma ?? undefined,
          strasse: lieferung.kunde.strasse ?? undefined,
          plz: lieferung.kunde.plz ?? undefined,
          ort: lieferung.kunde.ort ?? undefined,
          ustIdNr: (lieferung.kunde as { ustIdNr?: string | null }).ustIdNr ?? undefined,
        },
        positionen: lieferung.positionen.map((p) => ({
          bezeichnung: p.artikel.name,
          menge: p.menge,
          einheit: p.artikel.einheit,
          einzelpreis: p.verkaufspreis,
          mwstSatz: p.artikel.mwstSatz ?? 19,
          rabattProzent: p.rabattProzent ?? 0,
        })),
      };

      const xml = generateZugferdXml(data);
      const filename = `RE-${lieferung.rechnungNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.xml`;

      return new Response(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── Sammelrechnung ─────────────────────────────────────────────────────────
    if (sammelrechnungIdStr) {
      const sammelrechnungId = parseInt(sammelrechnungIdStr, 10);
      if (isNaN(sammelrechnungId)) {
        return NextResponse.json({ error: "Ungültige sammelrechnungId" }, { status: 400 });
      }

      const sr = await prisma.sammelrechnung.findUnique({
        where: { id: sammelrechnungId },
        include: {
          kunde: true,
          lieferungen: {
            include: {
              positionen: { include: { artikel: true } },
            },
          },
        },
      });

      if (!sr) {
        return NextResponse.json({ error: "Sammelrechnung nicht gefunden" }, { status: 404 });
      }
      if (!sr.rechnungNr) {
        return NextResponse.json({ error: "Sammelrechnung hat noch keine Rechnungsnummer" }, { status: 400 });
      }

      const rechnungDatum = sr.rechnungDatum ? new Date(sr.rechnungDatum) : new Date(sr.createdAt);

      // Alle Positionen aus allen Lieferungen sammeln
      const positionen: ZugferdData["positionen"] = [];
      for (const lieferung of sr.lieferungen) {
        for (const p of lieferung.positionen) {
          positionen.push({
            bezeichnung: p.artikel.name,
            menge: p.menge,
            einheit: p.artikel.einheit,
            einzelpreis: p.verkaufspreis,
            mwstSatz: p.artikel.mwstSatz ?? 19,
            rabattProzent: p.rabattProzent ?? 0,
          });
        }
      }

      const data: ZugferdData = {
        rechnungNr: sr.rechnungNr,
        datum: rechnungDatum,
        zahlungsziel: sr.zahlungsziel ?? 30,
        firma,
        kunde: {
          name: sr.kunde.name,
          firma: sr.kunde.firma ?? undefined,
          strasse: (sr.kunde as { strasse?: string | null }).strasse ?? undefined,
          plz: (sr.kunde as { plz?: string | null }).plz ?? undefined,
          ort: (sr.kunde as { ort?: string | null }).ort ?? undefined,
          ustIdNr: (sr.kunde as { ustIdNr?: string | null }).ustIdNr ?? undefined,
        },
        positionen,
      };

      const xml = generateZugferdXml(data);
      const filename = `RE-${sr.rechnungNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.xml`;

      return new Response(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Parameter lieferungId oder sammelrechnungId erforderlich" },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    // P2025: Record not found
    if (message.includes("P2025")) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
