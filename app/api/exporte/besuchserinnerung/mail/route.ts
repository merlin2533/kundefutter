import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { besuchserinnerungEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";
export const dynamic = "force-dynamic";

// POST /api/exporte/besuchserinnerung/mail
// Body: { aktivitaetId: number; empfaenger?: string }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { aktivitaetId?: unknown; empfaenger?: unknown };
    const aktivitaetId = Number(body.aktivitaetId);
    if (!Number.isInteger(aktivitaetId) || aktivitaetId <= 0) {
      return NextResponse.json({ error: "Ungültige aktivitaetId" }, { status: 400 });
    }

    const aktivitaet = await prisma.kundeAktivitaet.findUnique({
      where: { id: aktivitaetId },
      include: { kunde: { include: { kontakte: true } } },
    });
    if (!aktivitaet) {
      return NextResponse.json({ error: "Aktivität nicht gefunden" }, { status: 404 });
    }

    const emailKontakt = aktivitaet.kunde?.kontakte.find(
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

    const kontaktMitName = aktivitaet.kunde?.kontakte.find(
      (k: { vorname?: string | null; nachname?: string | null }) =>
        (k.vorname && k.vorname.trim()) || (k.nachname && k.nachname.trim()),
    );
    const kundenAnrede = kontaktMitName
      ? [kontaktMitName.vorname, kontaktMitName.nachname].filter(Boolean).join(" ").trim()
      : aktivitaet.kunde?.firma ?? aktivitaet.kunde?.name ?? undefined;

    // Uhrzeit aus "faelligAm" ableiten (HH:MM), falls vorhanden
    const faelligAm = aktivitaet.faelligAm ? new Date(aktivitaet.faelligAm) : new Date(aktivitaet.datum);
    const uhrzeit = aktivitaet.faelligAm
      ? faelligAm.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
      : null;

    const { subject, text, html } = besuchserinnerungEmail({
      datum: faelligAm,
      uhrzeit,
      notiz: aktivitaet.inhalt || null,
      kundenAnrede,
      firma,
    });

    await sendEmail({ to: empfaenger, subject, text, html, fromName: firma.name });

    if (aktivitaet.kundeId) {
      await prisma.kundeAktivitaet.create({
        data: {
          kundeId: aktivitaet.kundeId,
          typ: "email",
          betreff: `Besuchstermin-Erinnerung versendet`,
          inhalt: `Erinnerung an ${empfaenger} verschickt.`,
          datum: new Date(),
          erledigt: true,
        },
      });
    }

    const kundenname = aktivitaet.kunde?.firma ?? aktivitaet.kunde?.name ?? "";
    return NextResponse.json({ ok: true, empfaenger, kundenname });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
