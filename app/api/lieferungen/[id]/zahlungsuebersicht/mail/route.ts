import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { berechneLieferungBrutto, berechneGutschriftBrutto } from "@/lib/lieferung-brutto";
import { rundeKaufmaennisch } from "@/lib/utils";
import { sendEmail } from "@/lib/email";
import { zahlungsuebersichtEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/lieferungen/[id]/zahlungsuebersicht/mail — Body: { empfaenger?: string; cc?: string }
// Reine Info-Mail über den aktuellen Zahlungsstand (Rechnungsbetrag, erhaltene Teilzahlungen
// inkl. Notiz, verbuchte Gutschriften/Forderungen, verbleibender Restbetrag) — ändert NICHTS
// an der Rechnung selbst und erzeugt keinen PDF-Anhang, siehe zahlungsuebersichtEmail() in
// lib/email-templates.ts.
export async function POST(req: NextRequest, { params }: Params) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EXPORT_RECHNUNG_MAIL);
  if (deny) return deny;

  const { id } = await params;
  const lieferungId = parseInt(id, 10);
  if (isNaN(lieferungId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { empfaenger?: unknown; cc?: unknown };

    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
        teilzahlungen: { orderBy: { datum: "asc" } },
        gutschriftenVerbucht: {
          include: { positionen: { include: { artikel: { select: { mwstSatz: true } } } } },
          orderBy: { createdAt: "asc" },
        },
        forderungenAlsQuelle: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!lieferung) {
      return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    }
    if (!lieferung.rechnungNr) {
      return NextResponse.json({ error: "Lieferung hat noch keine Rechnungsnummer" }, { status: 400 });
    }

    const emailKontakt =
      lieferung.kunde.kontakte.find((k) => k.typ === "email" && k.rechnungsEmail) ??
      lieferung.kunde.kontakte.find((k) => k.typ === "email");
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
    const rechnungDatum = lieferung.rechnungDatum ? new Date(lieferung.rechnungDatum) : new Date(lieferung.datum);

    const bruttoBetrag = berechneLieferungBrutto(lieferung);
    const teilzahlungenSumme = lieferung.teilzahlungen.reduce((s, tz) => s + tz.betrag, 0);
    const gutschriftenSumme = lieferung.gutschriftenVerbucht.reduce(
      (s, g) => s + berechneGutschriftBrutto(g.positionen),
      0,
    );
    const forderungenSumme = lieferung.forderungenAlsQuelle.reduce((s, f) => s + f.betrag, 0);
    const offenerBetrag = rundeKaufmaennisch(
      Math.max(0, bruttoBetrag - teilzahlungenSumme - gutschriftenSumme - forderungenSumme),
      2,
    );

    const weiterePositionen = [
      ...lieferung.gutschriftenVerbucht.map((g) => ({
        label: `Gutschrift ${g.nummer} verrechnet`,
        betrag: rundeKaufmaennisch(berechneGutschriftBrutto(g.positionen), 2),
      })),
      ...lieferung.forderungenAlsQuelle.map((f) => ({
        label: "Restforderung verrechnet",
        betrag: f.betrag,
      })),
    ];

    const kontaktMitName = lieferung.kunde.kontakte.find(
      (k) => (k.vorname && k.vorname.trim()) || (k.nachname && k.nachname.trim()),
    );
    const kundenAnrede = kontaktMitName
      ? [kontaktMitName.vorname, kontaktMitName.nachname].filter(Boolean).join(" ").trim()
      : lieferung.kunde.firma ?? lieferung.kunde.name;

    const { subject, text, html } = zahlungsuebersichtEmail({
      rechnungNr: lieferung.rechnungNr,
      rechnungDatum,
      bruttoBetrag: rundeKaufmaennisch(bruttoBetrag, 2),
      teilzahlungen: lieferung.teilzahlungen.map((tz) => ({
        datum: new Date(tz.datum),
        betrag: tz.betrag,
        notiz: tz.notiz,
      })),
      weiterePositionen: weiterePositionen.length ? weiterePositionen : undefined,
      offenerBetrag,
      kundenAnrede,
      firma,
    });

    const ccAdresse = typeof body.cc === "string" && body.cc.trim() ? body.cc.trim() : undefined;

    await sendEmail({
      to: empfaenger,
      cc: ccAdresse,
      subject,
      text,
      html,
      fromName: firma.name,
      feature: "zahlungsuebersicht",
      entityId: lieferungId,
    });

    await prisma.kundeAktivitaet.create({
      data: {
        kundeId: lieferung.kundeId,
        typ: "email",
        betreff: `Zahlungsübersicht zu Rechnung ${lieferung.rechnungNr} versendet`,
        inhalt: `Zahlungsübersicht (noch offen: ${offenerBetrag.toFixed(2)} €) an ${empfaenger} verschickt.`,
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
