import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import {
  generiereRechnungPdfMitZugferd,
  generiereGutschriftPdf,
  generiereAngebotPdf,
  generiereLieferscheinPdf,
} from "@/lib/pdfGenerator";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Features, deren ursprüngliche Mail einen PDF-Anhang hatte – muss beim
// erneuten Senden frisch erzeugt werden, da MailLog keine Anhang-Binärdaten speichert.
const ANHANG_FEATURES = new Set(["rechnung", "gutschrift", "angebot", "lieferschein"]);

async function baueAnhang(feature: string, entityId: number): Promise<EmailAttachment | null> {
  if (feature === "rechnung") {
    const lieferung = await prisma.lieferung.findUnique({ where: { id: entityId } });
    if (!lieferung || !lieferung.rechnungNr) return null;
    const content = await generiereRechnungPdfMitZugferd(entityId);
    return { filename: `Rechnung_${lieferung.rechnungNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`, content, contentType: "application/pdf" };
  }
  if (feature === "gutschrift") {
    const gutschrift = await prisma.gutschrift.findUnique({ where: { id: entityId } });
    if (!gutschrift) return null;
    const content = await generiereGutschriftPdf(entityId);
    return { filename: `Gutschrift_${gutschrift.nummer.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`, content, contentType: "application/pdf" };
  }
  if (feature === "angebot") {
    const angebot = await prisma.angebot.findUnique({ where: { id: entityId } });
    if (!angebot) return null;
    const content = await generiereAngebotPdf(entityId);
    return { filename: `Angebot_${angebot.nummer.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`, content, contentType: "application/pdf" };
  }
  if (feature === "lieferschein") {
    const lieferung = await prisma.lieferung.findUnique({ where: { id: entityId } });
    if (!lieferung) return null;
    const lieferscheinNr = lieferung.lieferscheinNr?.trim() || String(lieferung.id);
    const content = await generiereLieferscheinPdf(entityId);
    return { filename: `Lieferschein_${lieferscheinNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`, content, contentType: "application/pdf" };
  }
  return null;
}

// POST /api/einstellungen/mail-log/[id]/resend — E-Mail erneut versenden
export async function POST(_req: NextRequest, ctx: Params) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const log = await prisma.mailLog.findUnique({ where: { id } });
    if (!log) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    let attachments: EmailAttachment[] | undefined;
    if (log.feature && ANHANG_FEATURES.has(log.feature)) {
      if (log.entityId == null) {
        return NextResponse.json(
          { error: "Anhang kann nicht wiederhergestellt werden (alter Log-Eintrag ohne Referenz auf das Ursprungsdokument). Bitte das Dokument erneut über seine Detailseite versenden." },
          { status: 422 },
        );
      }
      const anhang = await baueAnhang(log.feature, log.entityId);
      if (!anhang) {
        return NextResponse.json(
          { error: "Ursprungsdokument wurde nicht gefunden – Anhang kann nicht neu erzeugt werden." },
          { status: 404 },
        );
      }
      attachments = [anhang];
    }

    await sendEmail({
      to: log.empfaenger,
      subject: log.betreff,
      text: log.textBody ?? "",
      html: log.htmlBody ?? log.textBody ?? "",
      feature: log.feature ?? undefined,
      entityId: log.entityId ?? undefined,
      attachments,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Versand fehlgeschlagen" }, { status: 500 });
  }
}
