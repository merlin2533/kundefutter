import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// RFC 6350 (vCard 3.0/4.0): Backslash zuerst escapen, sonst würde ein bereits
// escapetes Komma/Semikolon durch den nachfolgenden Backslash-Schritt erneut getroffen.
function escapeVCard(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r?\n/g, "\\n");
}

// GET /api/kunden/[id]/vcard — Stammdaten (Name, Firma, Telefon(e), E-Mail(s), Adresse) als
// vCard-Datei (.vcf) zum Download. iOS/Android erkennen den vCard-MIME-Type beim Öffnen/
// Herunterladen automatisch und bieten "Zu Kontakten hinzufügen" an — kein App-Zugriff nötig.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const kunde = await prisma.kunde.findUnique({
      where: { id: Number(id) },
      include: { kontakte: true },
    });
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    const telefone = kunde.kontakte.filter((k) => k.typ === "telefon" || k.typ === "mobil");
    const emails = kunde.kontakte.filter((k) => k.typ === "email");

    const lines = ["BEGIN:VCARD", "VERSION:3.0"];
    lines.push(`FN:${escapeVCard(kunde.name)}`);
    lines.push(`N:${escapeVCard(kunde.name)};;;;`);
    if (kunde.firma) lines.push(`ORG:${escapeVCard(kunde.firma)}`);
    for (const t of telefone) {
      const typ = t.typ === "mobil" ? "CELL" : "VOICE";
      lines.push(`TEL;TYPE=${typ}:${escapeVCard(t.wert)}`);
    }
    for (const e of emails) {
      lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(e.wert)}`);
    }
    if (kunde.strasse || kunde.plz || kunde.ort) {
      const adr = [
        "", "", // Postfach, Adresszusatz
        escapeVCard(kunde.strasse ?? ""),
        escapeVCard(kunde.ort ?? ""),
        "", // Bundesland
        escapeVCard(kunde.plz ?? ""),
        escapeVCard(kunde.land ?? "Deutschland"),
      ].join(";");
      lines.push(`ADR;TYPE=WORK:${adr}`);
    }
    lines.push("NOTE:Kunde aus AGRI-Office");
    lines.push("END:VCARD");

    const vcard = lines.join("\r\n") + "\r\n";
    const safeName = (kunde.firma ?? kunde.name).replace(/[^a-zA-Z0-9äöüÄÖÜ\-]/g, "_").slice(0, 40);

    return new NextResponse(vcard, {
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.vcf"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
