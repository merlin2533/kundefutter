import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer } from "@/lib/utils";
import { auditLog } from "@/lib/audit";
import { isDriveKonfiguriert, uploadPdfToKundeOrdner } from "@/lib/googleDrive";
import { generiereRechnungPdf, generiereLieferscheinPdf } from "@/lib/pdfGenerator";
import { artikelSafeSelect } from "@/lib/artikel-select";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const lieferung = await prisma.lieferung.findUnique({
      where: { id: Number(id) },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: { select: artikelSafeSelect } } },
      },
    });
    if (!lieferung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(lieferung);
  } catch (e) {
    console.error("Lieferung GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { positionen, ...data } = body;

  // Capture old status for audit log before transaction
  const altLieferung = data.status !== undefined
    ? await prisma.lieferung.findUnique({ where: { id: Number(id) }, select: { status: true } })
    : null;

  try {
  const transaction = await prisma.$transaction(async (tx) => {
    const alt = await tx.lieferung.findUnique({
      where: { id: Number(id) },
      include: { positionen: true },
    });
    if (!alt) throw new Error("Nicht gefunden");

    // Status-Uebergangsvalidierung
    if (data.status !== undefined && data.status !== alt.status) {
      const erlaubteUebergaenge: Record<string, string[]> = {
        geplant: ["geliefert", "storniert"],
        geliefert: ["storniert", "geplant"],
        storniert: [],
      };
      // Zurück zu geplant nur wenn noch keine Rechnung erstellt wurde
      if (data.status === "geplant" && alt.rechnungNr) {
        throw new Error("Lieferung hat bereits eine Rechnung und kann nicht wieder geöffnet werden.");
      }
      const erlaubt = erlaubteUebergaenge[alt.status] ?? [];
      if (!erlaubt.includes(data.status)) {
        throw new Error(`Statuswechsel von "${alt.status}" nach "${data.status}" ist nicht erlaubt`);
      }
    }

    // Status: geplant → geliefert: Bestand reduzieren
    if (alt.status === "geplant" && data.status === "geliefert") {
      const artikelIds = [...new Set(alt.positionen.map((p) => p.artikelId))];
      const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
      const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

      for (const pos of alt.positionen) {
        const artikel = artikelMap.get(pos.artikelId);
        if (!artikel) continue;
        const neuerBestand = artikel.aktuellerBestand - pos.menge;
        artikel.aktuellerBestand = neuerBestand;
        await tx.artikel.update({
          where: { id: pos.artikelId },
          data: { aktuellerBestand: neuerBestand },
        });
        await tx.lagerbewegung.create({
          data: {
            artikelId: pos.artikelId,
            typ: "ausgang",
            menge: -pos.menge,
            bestandNach: neuerBestand,
            lieferungId: Number(id),
          },
        });
      }
    }

    // Status: geliefert → storniert: Bestand zurückbuchen
    if (alt.status === "geliefert" && data.status === "storniert") {
      if (!data.stornoBegründung) {
        throw new Error("Stornobegründung ist Pflichtfeld");
      }
      const artikelIds = [...new Set(alt.positionen.map((p) => p.artikelId))];
      const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
      const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

      for (const pos of alt.positionen) {
        const artikel = artikelMap.get(pos.artikelId);
        if (!artikel) continue;
        const neuerBestand = artikel.aktuellerBestand + pos.menge;
        artikel.aktuellerBestand = neuerBestand;
        await tx.artikel.update({
          where: { id: pos.artikelId },
          data: { aktuellerBestand: neuerBestand },
        });
        await tx.lagerbewegung.create({
          data: {
            artikelId: pos.artikelId,
            typ: "eingang",
            menge: pos.menge,
            bestandNach: neuerBestand,
            lieferungId: Number(id),
            notiz: `Storno: ${data.stornoBegründung}`,
          },
        });
      }
    }

    // Nur erlaubte Felder übergeben
    const toValidDate = (v: unknown): Date | null => {
      if (!v) return null;
      const d = new Date(v as string);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notiz !== undefined) updateData.notiz = data.notiz;
    if (data.stornoBegründung !== undefined) updateData.stornoBegründung = data.stornoBegründung;
    if (data.datum !== undefined) {
      const d = toValidDate(data.datum);
      if (!d) throw new Error("Ungültiges Datum");
      updateData.datum = d;
    }
    if (data.lieferDatum !== undefined) {
      if (data.lieferDatum === null || data.lieferDatum === "") {
        updateData.lieferDatum = null;
      } else {
        const d = toValidDate(data.lieferDatum);
        if (!d) throw new Error("Ungültiges Lieferdatum");
        updateData.lieferDatum = d;
      }
    }
    if (data.bezahltAm !== undefined) {
      if (data.bezahltAm === null || data.bezahltAm === "") {
        updateData.bezahltAm = null;
      } else {
        const d = toValidDate(data.bezahltAm);
        if (!d) throw new Error("Ungültiges bezahltAm-Datum");
        updateData.bezahltAm = d;
      }
    }
    if (data.zahlungsziel !== undefined) {
      if (data.zahlungsziel === null || data.zahlungsziel === "") {
        throw new Error("Zahlungsziel darf nicht leer sein");
      }
      const z = typeof data.zahlungsziel === "number" ? data.zahlungsziel : Number(data.zahlungsziel);
      if (!Number.isFinite(z) || !Number.isInteger(z) || z < 0 || z > 365) {
        throw new Error("Zahlungsziel muss eine Ganzzahl zwischen 0 und 365 sein");
      }
      updateData.zahlungsziel = z;
    }
    if (data.rechnungNr !== undefined) {
      if (typeof data.rechnungNr !== "string" || data.rechnungNr.trim() === "") {
        throw new Error("Rechnungsnummer darf nicht leer sein");
      }
      updateData.rechnungNr = data.rechnungNr.trim();
    }
    if (data.rechnungDatum !== undefined) {
      if (data.rechnungDatum === null || data.rechnungDatum === "") {
        updateData.rechnungDatum = null;
      } else {
        const d = toValidDate(data.rechnungDatum);
        if (!d) throw new Error("Ungültiges Rechnungsdatum");
        updateData.rechnungDatum = d;
      }
    }

    const updated = await tx.lieferung.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        kunde: true,
        positionen: { include: { artikel: { select: artikelSafeSelect } } },
      },
    });
    return { updated, altRechnungNr: alt.rechnungNr, altZahlungsziel: alt.zahlungsziel };
  });
  const result = transaction.updated;

  if (altLieferung && data.status !== undefined && altLieferung.status !== data.status) {
    void auditLog({
      entitaet: "Lieferung",
      entitaetId: Number(id),
      aktion: "geaendert",
      feld: "status",
      alterWert: altLieferung.status,
      neuerWert: result.status,
      beschreibung: `Status geändert: "${altLieferung.status}" → "${result.status}"`,
    });
  }

  if (data.rechnungNr !== undefined && transaction.altRechnungNr !== result.rechnungNr) {
    void auditLog({
      entitaet: "Lieferung",
      entitaetId: Number(id),
      aktion: "geaendert",
      feld: "rechnungNr",
      alterWert: transaction.altRechnungNr,
      neuerWert: result.rechnungNr,
      beschreibung: `Rechnungsnummer geändert: "${transaction.altRechnungNr ?? ""}" → "${result.rechnungNr ?? ""}"`,
    });
  }

  if (data.zahlungsziel !== undefined && transaction.altZahlungsziel !== result.zahlungsziel) {
    void auditLog({
      entitaet: "Lieferung",
      entitaetId: Number(id),
      aktion: "geaendert",
      feld: "zahlungsziel",
      alterWert: transaction.altZahlungsziel,
      neuerWert: result.zahlungsziel,
      beschreibung: `Zahlungsziel geändert: ${transaction.altZahlungsziel ?? "—"} → ${result.zahlungsziel ?? "—"} Tage`,
    });
  }

  // Fire-and-forget: Bei Status-Wechsel nach "geliefert" Lieferschein-PDF hochladen
  if (altLieferung?.status === "geplant" && result.status === "geliefert") {
    const lieferungIdNum = Number(id);
    const datumStr = new Date(result.datum).toISOString().slice(0, 10);
    isDriveKonfiguriert()
      .then(async (ok) => {
        if (!ok) return;
        const pdfBuffer = await generiereLieferscheinPdf(lieferungIdNum);
        const fileName = `Lieferschein-${lieferungIdNum}-${datumStr}.pdf`;
        await uploadPdfToKundeOrdner(result.kundeId, result.kunde.name, "Lieferscheine", fileName, pdfBuffer);
        console.log(`[drive] Lieferschein ${lieferungIdNum} für Kunde ${result.kunde.name} hochgeladen`);
      })
      .catch((e: unknown) => {
        console.warn("[drive] Lieferschein-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
      });
  }

  return NextResponse.json(result);
  } catch (err) {
    console.error("Lieferung PATCH error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  try {
    const lieferung = await prisma.lieferung.findUnique({
      where: { id: numId },
      select: { status: true },
    });
    if (!lieferung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (lieferung.status === "geliefert") {
      return NextResponse.json(
        { error: "Gelieferte Lieferungen können nicht gelöscht werden." },
        { status: 400 },
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.lagerbewegung.deleteMany({ where: { lieferungId: numId } });
      await tx.lieferposition.deleteMany({ where: { lieferungId: numId } });
      await tx.lieferung.delete({ where: { id: numId } });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// Rechnung erstellen
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { aktion } = body;

  // QR-Mobilerfassung: Status auf "geliefert" setzen
  if (body.status === "geliefert") {
    try {
      const lieferung = await prisma.lieferung.findUnique({ where: { id: Number(id) } });
      if (!lieferung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
      if (lieferung.status !== "geplant") {
        return NextResponse.json({ error: "Status kann nicht geändert werden", currentStatus: lieferung.status }, { status: 400 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const positionen = await tx.lieferposition.findMany({ where: { lieferungId: Number(id) } });
        const artikelIds = [...new Set(positionen.map((p) => p.artikelId))];
        const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
        const artikelMap = new Map(artikelList.map((a) => [a.id, a]));
        for (const pos of positionen) {
          const artikel = artikelMap.get(pos.artikelId);
          if (!artikel) continue;
          const neuerBestand = artikel.aktuellerBestand - pos.menge;
          artikel.aktuellerBestand = neuerBestand;
          await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
          await tx.lagerbewegung.create({
            data: { artikelId: pos.artikelId, typ: "ausgang", menge: -pos.menge, bestandNach: neuerBestand, lieferungId: Number(id) },
          });
        }
        return tx.lieferung.update({
          where: { id: Number(id) },
          data: { status: "geliefert" },
          include: { kunde: { include: { kontakte: true } }, positionen: { include: { artikel: { select: artikelSafeSelect } } } },
        });
      });
      // Fire-and-forget: Lieferschein-PDF in Google Drive hochladen
      const lieferungIdNum = Number(id);
      const kundeId = updated.kundeId;
      const kundeName = updated.kunde.name;
      const datumStr = new Date(updated.datum).toISOString().slice(0, 10);
      isDriveKonfiguriert()
        .then(async (ok) => {
          if (!ok) return;
          const pdfBuffer = await generiereLieferscheinPdf(lieferungIdNum);
          const fileName = `Lieferschein-${lieferungIdNum}-${datumStr}.pdf`;
          await uploadPdfToKundeOrdner(kundeId, kundeName, "Lieferscheine", fileName, pdfBuffer);
          console.log(`[drive] Lieferschein ${lieferungIdNum} für Kunde ${kundeName} hochgeladen`);
        })
        .catch((e: unknown) => {
          console.warn("[drive] Lieferschein-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
        });

      return NextResponse.json(updated);
    } catch (err) {
      console.error("Lieferung aktion error:", err);
      const isDev = process.env.NODE_ENV === "development";
      const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (aktion === "rechnung_erstellen") {
    try {
      const lieferung = await prisma.$transaction(async (tx) => {
        // Pruefen ob bereits eine Rechnungsnummer existiert
        const existing = await tx.lieferung.findUnique({ where: { id: Number(id) }, select: { rechnungNr: true } });
        if (existing?.rechnungNr) {
          throw new Error("Lieferung hat bereits eine Rechnungsnummer");
        }

        const einstellung = await tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } });
        const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null);

        await tx.einstellung.upsert({
          where: { key: "letzte_rechnungsnummer" },
          update: { value: rechnungNr },
          create: { key: "letzte_rechnungsnummer", value: rechnungNr },
        });

        return tx.lieferung.update({
          where: { id: Number(id) },
          data: { rechnungNr, rechnungDatum: new Date() },
          include: {
            kunde: { include: { kontakte: true } },
            positionen: { include: { artikel: { select: artikelSafeSelect } } },
          },
        });
      });
      // Fire-and-forget: Rechnungs-PDF generieren und in Google Drive hochladen
      isDriveKonfiguriert()
        .then(async (ok) => {
          if (!ok) return;
          const pdfBuffer = await generiereRechnungPdf(Number(id));
          const fileName = `Rechnung-${lieferung.rechnungNr?.replace(/\//g, "-")}.pdf`;
          await uploadPdfToKundeOrdner(lieferung.kundeId, lieferung.kunde.name, "Rechnungen", fileName, pdfBuffer);
          console.log(`[drive] Rechnung ${lieferung.rechnungNr} für Kunde ${lieferung.kunde.name} hochgeladen`);
        })
        .catch((e: unknown) => {
          console.warn("[drive] Rechnungs-Upload fehlgeschlagen:", e instanceof Error ? e.message : e);
        });

      return NextResponse.json(lieferung);
    } catch (err) {
      console.error("Lieferung aktion error:", err);
      const isDev = process.env.NODE_ENV === "development";
      const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
}
