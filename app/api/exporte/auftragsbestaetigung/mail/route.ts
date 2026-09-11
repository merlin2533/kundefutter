import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generiereAuftragsbestaetigungPdf } from "@/lib/pdfGenerator";
import { sendEmail } from "@/lib/email";
import { auftragsbestaetigungEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// POST /api/exporte/auftragsbestaetigung/mail
// Body: { lieferungId: number; empfaenger?: string; cc?: string }
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EXPORT_LIEFERSCHEIN);
  if (deny) return deny;

  try {
    const body = (await req.json()) as { lieferungId?: unknown; empfaenger?: unknown; cc?: unknown };
    const lieferungId = Number(body.lieferungId);
    if (!Number.isInteger(lieferungId) || lieferungId <= 0) {
      return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
    }

    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      include: {
        kunde: { include: { kontakte: true } },
      },
    });
    if (!lieferung) {
      return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    }

    const emailKontakt = lieferung.kunde.kontakte.find(
      (k: { typ: string; wert: string }) => k.typ === "email",
    );
    const empfaenger =
      typeof body.empfaenger === "string" && body.empfaenger.trim()
        ? body.empfaenger.trim()
        : emailKontakt?.wert ?? "";

    if (!empfaenger) {
      return NextResponse.json(
        { error: "Keine E-Mail-Adresse für diesen Kunden hinterlegt und keine Empfänger-Adresse angegeben." },
        { status: 422 },
      );
    }

    const firma = await ladeFirmaDaten();
    const pdfBuffer = await generiereAuftragsbestaetigungPdf(lieferungId);

    const auftragsNr = lieferung.lieferscheinNr?.trim() || String(lieferung.id);
    const pdfFilename = `Auftragsbestaetigung_${auftragsNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;

    const kontaktMitName = lieferung.kunde.kontakte.find(
      (k: { vorname?: string | null; nachname?: string | null }) =>
        (k.vorname && k.vorname.trim()) || (k.nachname && k.nachname.trim()),
    );
    const kundenAnrede = kontaktMitName
      ? [kontaktMitName.vorname, kontaktMitName.nachname].filter(Boolean).join(" ").trim()
      : lieferung.kunde.firma ?? lieferung.kunde.name;

    const { subject, text, html } = auftragsbestaetigungEmail({
      auftragsNr,
      auftragsDatum: new Date(lieferung.datum),
      kundenAnrede,
      firma,
      pdfFilename,
    });

    const ccAdresse = typeof body.cc === "string" && body.cc.trim() ? body.cc.trim() : undefined;

    await sendEmail({
      to: empfaenger,
      cc: ccAdresse,
      subject,
      text,
      html,
      fromName: firma.name,
      feature: "auftragsbestaetigung",
      entityId: lieferungId,
      attachments: [{ filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" }],
    });

    await prisma.lieferung.update({
      where: { id: lieferungId },
      data: { auftragsbestaetigungVersendetAm: new Date() },
    });

    await prisma.kundeAktivitaet.create({
      data: {
        kundeId: lieferung.kundeId,
        typ: "email",
        betreff: `Auftragsbestätigung ${auftragsNr} versendet`,
        inhalt: `PDF an ${empfaenger} verschickt.`,
        datum: new Date(),
        erledigt: true,
      },
    });

    const kundenname = lieferung.kunde.firma ?? lieferung.kunde.name;
    return NextResponse.json({ ok: true, empfaenger, kundenname });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
