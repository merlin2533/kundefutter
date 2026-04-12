import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generiereRechnungPdf } from "@/lib/pdfGenerator";
import { generateZugferdXml, ZugferdData } from "@/lib/zugferd-xml";
import nodemailer from "nodemailer";

// POST /api/exporte/rechnung/mail
// Body: { lieferungId: number; empfaenger?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { lieferungId?: unknown; empfaenger?: unknown };
    const lieferungId = Number(body.lieferungId);
    if (!Number.isInteger(lieferungId) || lieferungId <= 0) {
      return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
    }

    // ── SMTP-Einstellungen aus DB laden ────────────────────────────────────────
    const smtpKeys = await prisma.einstellung.findMany({
      where: { key: { startsWith: "smtp." } },
    });
    const smtp: Record<string, string> = {};
    for (const e of smtpKeys) smtp[e.key] = e.value;

    if (!smtp["smtp.host"]) {
      return NextResponse.json(
        { error: "SMTP nicht konfiguriert. Bitte unter Einstellungen → E-Mail einrichten." },
        { status: 422 },
      );
    }

    // ── Lieferung + Rechnungsnummer sicherstellen ───────────────────────────────
    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: true } },
      },
    });
    if (!lieferung) {
      return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    }
    if (!lieferung.rechnungNr) {
      return NextResponse.json({ error: "Lieferung hat noch keine Rechnungsnummer" }, { status: 400 });
    }

    // ── Empfänger-E-Mail ermitteln ─────────────────────────────────────────────
    let empfaenger = typeof body.empfaenger === "string" && body.empfaenger.trim()
      ? body.empfaenger.trim()
      : lieferung.kunde.kontakte.find((k: { typ: string; wert: string }) => k.typ === "email")?.wert ?? "";

    if (!empfaenger) {
      return NextResponse.json(
        { error: "Keine E-Mail-Adresse für diesen Kunden hinterlegt und keine Empfänger-Adresse angegeben." },
        { status: 422 },
      );
    }

    // ── PDF generieren ─────────────────────────────────────────────────────────
    const pdfBuffer = await generiereRechnungPdf(lieferungId);

    // ── ZUGFeRD XML generieren ─────────────────────────────────────────────────
    const firmaEinstellungen = await prisma.einstellung.findMany({
      where: { key: { startsWith: "firma." } },
    });
    const firmaCfg: Record<string, string> = {};
    for (const e of firmaEinstellungen) firmaCfg[e.key] = e.value;

    const zugferdData: ZugferdData = {
      rechnungNr: lieferung.rechnungNr,
      datum: lieferung.rechnungDatum ? new Date(lieferung.rechnungDatum) : new Date(lieferung.datum),
      zahlungsziel: lieferung.zahlungsziel ?? 30,
      firma: {
        name: firmaCfg["firma.firmenname"] ?? "",
        strasse: firmaCfg["firma.adresse"] ?? "",
        plz: firmaCfg["firma.plz"] ?? "",
        ort: firmaCfg["firma.ort"] ?? "",
        ustIdNr: firmaCfg["firma.ustidnr"] || undefined,
        steuernummer: firmaCfg["firma.steuernr"] || undefined,
        iban: firmaCfg["firma.iban"] || undefined,
        bic: firmaCfg["firma.bic"] || undefined,
        bank: firmaCfg["firma.bankname"] || undefined,
      },
      kunde: {
        name: lieferung.kunde.name,
        firma: lieferung.kunde.firma ?? undefined,
        strasse: lieferung.kunde.strasse ?? undefined,
        plz: lieferung.kunde.plz ?? undefined,
        ort: lieferung.kunde.ort ?? undefined,
        ustIdNr: (lieferung.kunde as { ustIdNr?: string | null }).ustIdNr ?? undefined,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      positionen: (lieferung.positionen as any[]).map((p) => ({
        bezeichnung: p.artikel.name,
        menge: p.menge,
        einheit: p.artikel.einheit,
        einzelpreis: p.verkaufspreis,
        mwstSatz: p.artikel.mwstSatz ?? 19,
        rabattProzent: p.rabattProzent ?? 0,
      })),
    };
    const zugferdXml = generateZugferdXml(zugferdData);
    const xmlFilename = `RE-${lieferung.rechnungNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.xml`;
    const pdfFilename = `Rechnung_${lieferung.rechnungNr.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;

    // ── Transporter aufbauen ───────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: smtp["smtp.host"],
      port: Number(smtp["smtp.port"] ?? "587"),
      secure: smtp["smtp.secure"] === "true",
      auth: {
        user: smtp["smtp.user"],
        pass: smtp["smtp.password"],
      },
    });

    const firmenname = firmaCfg["firma.firmenname"] ?? firmaCfg["firma.name"] ?? "Ihr Lieferant";
    const fromAddress = smtp["smtp.from"] ?? smtp["smtp.user"] ?? "";
    const kundenname = lieferung.kunde.firma ?? lieferung.kunde.name;

    await transporter.sendMail({
      from: `"${firmenname}" <${fromAddress}>`,
      to: empfaenger,
      subject: `Rechnung ${lieferung.rechnungNr} von ${firmenname}`,
      text: [
        `Sehr geehrte Damen und Herren,`,
        ``,
        `anbei erhalten Sie Rechnung ${lieferung.rechnungNr}.`,
        ``,
        `Im Anhang befinden sich:`,
        `• ${pdfFilename} – Rechnung als PDF`,
        `• ${xmlFilename} – Rechnung als ZUGFeRD / Factur-X E-Rechnung`,
        ``,
        `Mit freundlichen Grüßen`,
        firmenname,
      ].join("\n"),
      html: `<p>Sehr geehrte Damen und Herren,</p>
<p>anbei erhalten Sie Rechnung <strong>${lieferung.rechnungNr}</strong>.</p>
<p>Im Anhang befinden sich:<br>
• <b>${pdfFilename}</b> – Rechnung als PDF<br>
• <b>${xmlFilename}</b> – Rechnung als ZUGFeRD / Factur-X E-Rechnung</p>
<p>Mit freundlichen Grüßen<br>${firmenname}</p>`,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
        {
          filename: xmlFilename,
          content: Buffer.from(zugferdXml, "utf-8"),
          contentType: "application/xml",
        },
      ],
    });

    // CRM-Aktivität anlegen
    await prisma.kundeAktivitaet.create({
      data: {
        kundeId: lieferung.kundeId,
        typ: "email",
        betreff: `Rechnung ${lieferung.rechnungNr} versendet`,
        inhalt: `PDF + ZUGFeRD XML an ${empfaenger} verschickt.`,
        datum: new Date(),
        erledigt: true,
      },
    });

    return NextResponse.json({ ok: true, empfaenger, kundenname });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
