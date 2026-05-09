import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generiereSepaXml, SepaZahlung } from "@/lib/sepa";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";

  try {
    const body = await req.json();
    const lieferungIds: number[] = Array.isArray(body?.lieferungIds)
      ? body.lieferungIds
          .map((id: unknown) => parseInt(String(id), 10))
          .filter((id: number) => !isNaN(id))
      : [];

    if (lieferungIds.length === 0) {
      return NextResponse.json({ error: "Keine Lieferungs-IDs angegeben" }, { status: 400 });
    }

    // Firma-IBAN und Name aus Einstellungen
    const einstellungen = await prisma.einstellung.findMany({
      where: {
        key: { in: ["firma.iban", "firma.bic", "system.firmenname", "firma.name"] },
      },
    });
    const einMap = Object.fromEntries(einstellungen.map((e) => [e.key, e.value]));
    const firmaIban = einMap["firma.iban"] ?? "";
    const firmaBic = einMap["firma.bic"];
    const firmaName =
      einMap["system.firmenname"] ?? einMap["firma.name"] ?? "AgrarOffice";

    if (!firmaIban) {
      return NextResponse.json(
        { error: "Keine Firmen-IBAN konfiguriert. Bitte unter Einstellungen → Firma hinterlegen." },
        { status: 422 }
      );
    }

    // Lieferungen mit Kundendaten und Kontakten laden
    const lieferungen = await prisma.lieferung.findMany({
      where: { id: { in: lieferungIds } },
      include: {
        kunde: {
          include: { kontakte: true },
        },
        positionen: {
          include: {
            artikel: {
              select: { mwstSatz: true },
            },
          },
        },
      },
      take: 500,
    });

    const zahlungen: SepaZahlung[] = [];
    const uebersprungen: string[] = [];

    for (const lief of lieferungen) {
      // Kunden-IBAN suchen: KundeKontakt mit typ="iban"
      const ibanKontakt = lief.kunde.kontakte.find(
        (k) => k.typ.toLowerCase() === "iban"
      );
      if (!ibanKontakt) {
        uebersprungen.push(
          `Lieferung #${lief.id} (${lief.kunde.firma ?? lief.kunde.name}): keine IBAN hinterlegt`
        );
        continue;
      }

      // Betrag berechnen: Summe der Positionen (Menge × Verkaufspreis inkl. MwSt)
      const betrag = lief.positionen.reduce((sum, pos) => {
        const preis = pos.verkaufspreis ?? 0;
        const rabatt = pos.rabattProzent ?? 0;
        const mwst = pos.artikel?.mwstSatz ?? 19;
        const netto = preis * (1 - rabatt / 100);
        return sum + pos.menge * netto * (1 + mwst / 100);
      }, 0);

      if (betrag <= 0) {
        uebersprungen.push(
          `Lieferung #${lief.id} (${lief.kunde.firma ?? lief.kunde.name}): Betrag = 0, übersprungen`
        );
        continue;
      }

      zahlungen.push({
        empfaengerName: lief.kunde.firma ?? lief.kunde.name,
        iban: ibanKontakt.wert,
        betrag: Math.round(betrag * 100) / 100,
        verwendungszweck: lief.rechnungNr
          ? `Rechnung ${lief.rechnungNr}`
          : `Lieferung #${lief.id}`,
        referenz: lief.rechnungNr ?? `LF-${lief.id}`,
      });
    }

    if (zahlungen.length === 0) {
      return NextResponse.json(
        {
          error:
            "Keine Zahlungen exportierbar. " +
            (uebersprungen.length > 0
              ? "Übersprungen: " + uebersprungen.join("; ")
              : "Kein Kunde hat eine IBAN hinterlegt."),
        },
        { status: 422 }
      );
    }

    const heute = new Date().toISOString().slice(0, 10);
    const xml = generiereSepaXml(firmaName, firmaIban, zahlungen, heute);

    const headers = new Headers({
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="sepa-export-${heute}.xml"`,
      "Cache-Control": "no-store",
    });

    if (uebersprungen.length > 0) {
      headers.set("X-Sepa-Uebersprungen", uebersprungen.join(" | ").slice(0, 500));
    }

    return new NextResponse(xml, { headers });
  } catch (err) {
    const msg =
      isDev && err instanceof Error ? err.message : "Interner Fehler beim SEPA-Export";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
