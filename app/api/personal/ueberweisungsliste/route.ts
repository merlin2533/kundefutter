import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const monat = parseInt(searchParams.get("monat") ?? String(now.getMonth() + 1), 10);
  const jahr = parseInt(searchParams.get("jahr") ?? String(now.getFullYear()), 10);
  const format = searchParams.get("format") ?? "json";

  if (isNaN(monat) || isNaN(jahr)) {
    return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  }

  try {
    const abrechnungen = await prisma.gehaltsabrechnung.findMany({
      where: { monat, jahr, status: "ABGERECHNET" },
      include: {
        mitarbeiter: {
          select: { id: true, vorname: true, nachname: true, iban: true, bic: true, kontoinhaber: true },
        },
      },
      orderBy: [{ mitarbeiter: { nachname: "asc" } }],
    });

    if (format === "csv") {
      const mm = String(monat).padStart(2, "0");
      const header = "Name;IBAN;BIC;Betrag;Verwendungszweck\n";
      const rows = abrechnungen.map((a) => {
        const name = `${a.mitarbeiter.vorname} ${a.mitarbeiter.nachname}`;
        const iban = a.mitarbeiter.iban ?? "";
        const bic = a.mitarbeiter.bic ?? "";
        const betrag = a.netto.toFixed(2).replace(".", ",");
        const zweck = `Gehalt ${mm}/${a.jahr}`;
        return `${name};${iban};${bic};${betrag};${zweck}`;
      }).join("\n");

      const csv = "\uFEFF" + header + rows; // UTF-8 BOM für Excel
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ueberweisungen-${mm}-${jahr}.csv"`,
        },
      });
    }

    // JSON-Antwort mit Zusammenfassung
    const gesamt = abrechnungen.reduce((sum, a) => sum + a.netto, 0);
    return NextResponse.json({
      monat,
      jahr,
      anzahl: abrechnungen.length,
      gesamtbetrag: Math.round(gesamt * 100) / 100,
      abrechnungen: abrechnungen.map((a) => ({
        id: a.id,
        mitarbeiterId: a.mitarbeiter.id,
        name: `${a.mitarbeiter.vorname} ${a.mitarbeiter.nachname}`,
        kontoinhaber: a.mitarbeiter.kontoinhaber || `${a.mitarbeiter.vorname} ${a.mitarbeiter.nachname}`,
        iban: a.mitarbeiter.iban,
        bic: a.mitarbeiter.bic,
        netto: a.netto,
        verwendungszweck: `Gehalt ${String(monat).padStart(2, "0")}/${jahr}`,
      })),
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}
