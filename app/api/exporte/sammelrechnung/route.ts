import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { naechsteRechnungsnummer } from "@/lib/utils";
import { generiereSammelrechnungPdf } from "@/lib/pdfGenerator";
import { Sentry } from "@/lib/sentry";
import { isNextcloudKonfiguriert, uploadPdfToKundeOrdner, uploadZuBuchhaltung } from "@/lib/nextcloud";
export const dynamic = "force-dynamic";

/**
 * Erneutes Ansehen/Herunterladen einer bereits erstellten Sammelrechnung — rein lesend,
 * legt nichts an. Pendant zu GET /api/exporte/rechnung, war für Sammelrechnungen bisher
 * nicht erreichbar: der einzige PDF-Weg lief über POST (Erstellung + Sofort-Download in
 * einem Schritt, siehe unten) — wurde die Sammelrechnung stattdessen über /sammelrechnungen/neu
 * angelegt (ruft POST /api/sammelrechnungen, nicht diese Route), gab es überhaupt keine
 * Möglichkeit, sie danach je als PDF zu sehen.
 */
export async function GET(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get("sammelrechnungId");
  const sammelrechnungId = idParam ? parseInt(idParam, 10) : NaN;
  if (isNaN(sammelrechnungId)) {
    return NextResponse.json({ error: "sammelrechnungId ist erforderlich" }, { status: 400 });
  }

  try {
    const pdfBuffer = await generiereSammelrechnungPdf(sammelrechnungId);
    const sammelrechnung = await prisma.sammelrechnung.findUnique({
      where: { id: sammelrechnungId },
      select: { rechnungNr: true },
    });
    const filename = `sammelrechnung-${(sammelrechnung?.rechnungNr ?? String(sammelrechnungId)).replace(/\//g, "-")}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Sammelrechnung PDF error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: err instanceof Error && err.message.includes("nicht gefunden") ? 404 : 500 });
  }
}

/**
 * Legt eine neue Sammelrechnung an UND liefert sofort deren PDF zum Download — genutzt vom
 * "Sammelrechnung erstellen"-Fluss in LieferhistorieTab.tsx (Kunden-Detailseite). Der
 * alternative Weg über /sammelrechnungen/neu nutzt stattdessen POST /api/sammelrechnungen
 * (keine sofortige PDF-Erzeugung) — beide Wege erzeugen denselben Sammelrechnung-Datensatz,
 * die PDF selbst lässt sich danach über GET oben jederzeit erneut ansehen.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { kundeId, lieferungIds } = body as { kundeId: number; lieferungIds: number[] };

  if (!kundeId || !Array.isArray(lieferungIds) || lieferungIds.length < 2) {
    return NextResponse.json({ error: "kundeId und mindestens 2 lieferungIds erforderlich" }, { status: 400 });
  }

  let sammelrechnungId: number;
  try {
    sammelrechnungId = await prisma.$transaction(async (tx) => {
      // Pruefen ob Lieferungen bereits eine Rechnung oder Sammelrechnung haben
      const betroffene = await tx.lieferung.findMany({
        where: { id: { in: lieferungIds }, kundeId },
        select: { id: true, rechnungNr: true, sammelrechnungId: true, status: true },
      });
      if (betroffene.length !== lieferungIds.length) {
        throw new Error("Nicht alle Lieferungen wurden gefunden oder gehoeren nicht zum angegebenen Kunden");
      }
      const bereitsAbgerechnet = betroffene.filter((l) => l.rechnungNr || l.sammelrechnungId);
      if (bereitsAbgerechnet.length > 0) {
        throw new Error(`Lieferungen ${bereitsAbgerechnet.map((l) => l.id).join(", ")} haben bereits eine Rechnung`);
      }
      const nichtGeliefert = betroffene.filter((l) => l.status !== "geliefert");
      if (nichtGeliefert.length > 0) {
        throw new Error(`Lieferungen ${nichtGeliefert.map((l) => l.id).join(", ")} haben nicht den Status "geliefert"`);
      }

      // Get next invoice number
      const einstellung = await tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } });
      const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null);
      await tx.einstellung.upsert({
        where: { key: "letzte_rechnungsnummer" },
        update: { value: rechnungNr },
        create: { key: "letzte_rechnungsnummer", value: rechnungNr },
      });

      const sr = await tx.sammelrechnung.create({
        data: {
          kundeId,
          rechnungNr,
          rechnungDatum: new Date(),
          zahlungsziel: 30,
        },
      });

      // Link all deliveries to this Sammelrechnung
      await tx.lieferung.updateMany({
        where: { id: { in: lieferungIds }, kundeId },
        data: { sammelrechnungId: sr.id, rechnungNr },
      });

      return sr.id;
    });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generiereSammelrechnungPdf(sammelrechnungId);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Sammelrechnung PDF error:", err);
    // Die Sammelrechnung selbst wurde bereits erfolgreich angelegt (siehe oben) — nur die
    // PDF-Erzeugung ist hier fehlgeschlagen. Kein Rollback nötig, da GET diese Sammelrechnung
    // später jederzeit erneut als PDF ausgeben kann, sobald die Ursache behoben ist.
    return NextResponse.json({ error: "Sammelrechnung wurde angelegt, PDF-Erzeugung ist fehlgeschlagen." }, { status: 500 });
  }

  const sammelrechnung = await prisma.sammelrechnung.findUnique({
    where: { id: sammelrechnungId },
    include: {
      kunde: true,
      lieferungen: { include: { positionen: { include: { artikel: { select: liefposArtikelSelect } } } } },
    },
  });
  if (!sammelrechnung) {
    return NextResponse.json({ error: "Fehler beim Erstellen der Sammelrechnung" }, { status: 500 });
  }

  const filename = `sammelrechnung-${sammelrechnung.rechnungNr?.replace(/\//g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;

  // Fire-and-forget: Sammelrechnung in den Kunden- UND Buchhaltungs-Ordner spiegeln
  isNextcloudKonfiguriert()
    .then(async (ok) => {
      if (!ok) return;
      await uploadPdfToKundeOrdner(sammelrechnung.kundeId, sammelrechnung.kunde.name, "Rechnungen", filename, pdfBuffer);
      const d = sammelrechnung.rechnungDatum ?? new Date();
      await uploadZuBuchhaltung(d.getFullYear(), d.getMonth() + 1, "Ausgangsrechnungen", filename, pdfBuffer, "application/pdf");
    })
    .catch((e: unknown) => {
      Sentry.captureException(e);
      console.warn("[nextcloud] Sammelrechnung-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
    });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
