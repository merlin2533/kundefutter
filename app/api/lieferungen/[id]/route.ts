import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer, istLagerrelevant } from "@/lib/utils";
import { auditLog } from "@/lib/audit";
import { isDriveKonfiguriert, uploadPdfToKundeOrdner } from "@/lib/googleDrive";
import { generiereRechnungPdf, generiereLieferscheinPdf } from "@/lib/pdfGenerator";
import { artikelSafeSelect, artikelWithInhaltSelect } from "@/lib/artikel-select";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


type Params = { params: Promise<{ id: string }> };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Prüft, ob eine Rechnungsnummer bereits an eine andere Lieferung oder Sammelrechnung vergeben ist.
async function rechnungsnummerVergeben(
  tx: Tx,
  nr: string,
  exceptLieferungId: number | null,
): Promise<boolean> {
  const l = await tx.lieferung.findFirst({
    where: { rechnungNr: nr, ...(exceptLieferungId ? { id: { not: exceptLieferungId } } : {}) },
    select: { id: true },
  });
  if (l) return true;
  const s = await tx.sammelrechnung.findFirst({ where: { rechnungNr: nr }, select: { id: true } });
  return !!s;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const lieferung = await prisma.lieferung.findUnique({
      where: { id: Number(id) },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: artikelWithInhaltSelect } },
        teilzahlungen: { orderBy: { datum: "asc" as const } },
        streckenLieferant: { select: { id: true, name: true } },
      },
    });
    if (!lieferung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Compute offenerBetrag = gesamtBetrag - SUM(teilzahlungen)
    const gesamtBrutto = lieferung.positionen.reduce((sum, pos) => {
      const netto = pos.menge * pos.verkaufspreis * (1 - pos.rabattProzent / 100);
      return sum + netto;
    }, 0);
    const bezahlt = lieferung.teilzahlungen.reduce((sum, tz) => sum + tz.betrag, 0);
    const offenerBetrag = Math.round((gesamtBrutto - bezahlt) * 100) / 100;

    return NextResponse.json({ ...lieferung, gesamtBetrag: Math.round(gesamtBrutto * 100) / 100, offenerBetrag });
  } catch (e) {
    Sentry.captureException(e);
    console.error("Lieferung GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
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

    // Status: geplant → geliefert: Bestand reduzieren (nicht bei Streckengeschäft)
    if (alt.status === "geplant" && data.status === "geliefert") {
      if (!alt.istStreckengeschaeft) {
        const artikelIds = [...new Set(alt.positionen.map((p) => p.artikelId))];
        const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
        const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

        for (const pos of alt.positionen) {
          const artikel = artikelMap.get(pos.artikelId);
          if (!artikel || !istLagerrelevant(artikel.kategorie)) continue;
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
    }

    // Status: geliefert → storniert: Bestand zurückbuchen (nicht bei Streckengeschäft)
    if (alt.status === "geliefert" && data.status === "storniert") {
      if (!data.stornoBegründung) {
        throw new Error("Stornobegründung ist Pflichtfeld");
      }
      if (!alt.istStreckengeschaeft) {
        const artikelIds = [...new Set(alt.positionen.map((p) => p.artikelId))];
        const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
        const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

        for (const pos of alt.positionen) {
          const artikel = artikelMap.get(pos.artikelId);
          if (!artikel || !istLagerrelevant(artikel.kategorie)) continue;
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
    }

    // Nur erlaubte Felder übergeben
    const toValidDate = (v: unknown): Date | null => {
      if (!v) return null;
      const d = new Date(v as string);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const updateData: {
      status?: string; notiz?: string | null; stornoBegründung?: string;
      datum?: Date; lieferDatum?: Date | null; bezahltAm?: Date | null;
      zahlungsziel?: number; rechnungNr?: string; rechnungDatum?: Date | null;
      lieferscheinNr?: string | null;
      istStreckengeschaeft?: boolean; streckenLieferantId?: number | null;
      skontoProzent?: number | null; skontoTage?: number | null; skontoGenutzt?: boolean;
    } = {};
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
      const neueNr = data.rechnungNr.trim();
      if (neueNr !== alt.rechnungNr && await rechnungsnummerVergeben(tx, neueNr, Number(id))) {
        throw new Error(`Rechnungsnummer ${neueNr} ist bereits vergeben`);
      }
      updateData.rechnungNr = neueNr;
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
    // Lieferschein-Nummer: manuell anpassbar; leer/null → Default (Lieferungs-ID)
    if (data.lieferscheinNr !== undefined) {
      if (data.lieferscheinNr === null || (typeof data.lieferscheinNr === "string" && data.lieferscheinNr.trim() === "")) {
        updateData.lieferscheinNr = null;
      } else if (typeof data.lieferscheinNr === "string") {
        updateData.lieferscheinNr = data.lieferscheinNr.trim();
      } else {
        throw new Error("Lieferschein-Nummer muss Text sein");
      }
    }
    // Skonto-Felder (vom Detail-Header speicherbar)
    if (data.skontoProzent !== undefined) {
      if (data.skontoProzent === null || data.skontoProzent === "") {
        updateData.skontoProzent = null;
      } else {
        const p = typeof data.skontoProzent === "number" ? data.skontoProzent : Number(data.skontoProzent);
        if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error("Skontoprozent muss zwischen 0 und 100 liegen");
        updateData.skontoProzent = p;
      }
    }
    if (data.skontoTage !== undefined) {
      if (data.skontoTage === null || data.skontoTage === "") {
        updateData.skontoTage = null;
      } else {
        const t = typeof data.skontoTage === "number" ? data.skontoTage : Number(data.skontoTage);
        if (!Number.isFinite(t) || !Number.isInteger(t) || t < 0) throw new Error("Skonto-Tage muss eine positive Ganzzahl sein");
        updateData.skontoTage = t;
      }
    }
    if (data.skontoGenutzt !== undefined) {
      updateData.skontoGenutzt = Boolean(data.skontoGenutzt);
    }

    // Streckengeschäft / Direktlieferung — nur änderbar solange "geplant",
    // da die Lagerbuchung bei geplant→geliefert von istStreckengeschaeft abhängt.
    if (data.istStreckengeschaeft !== undefined || data.streckenLieferantId !== undefined) {
      if (alt.status !== "geplant") {
        throw new Error("Streckengeschäft kann nur bei geplanten Lieferungen geändert werden");
      }
      // Nicht gemeinsam mit einem Statuswechsel ändern: die geplant→geliefert-Lagerbuchung
      // weiter oben nutzt den ALTEN istStreckengeschaeft-Wert und würde sonst falsch buchen.
      if (data.status !== undefined && data.status !== alt.status) {
        throw new Error("Bitte Streckengeschäft und Statuswechsel getrennt speichern");
      }
      const istStrecke = data.istStreckengeschaeft !== undefined
        ? Boolean(data.istStreckengeschaeft)
        : alt.istStreckengeschaeft;
      updateData.istStreckengeschaeft = istStrecke;
      if (istStrecke) {
        const liefId = data.streckenLieferantId !== undefined
          ? Number(data.streckenLieferantId)
          : alt.streckenLieferantId;
        if (!liefId || !Number.isInteger(liefId) || liefId <= 0) {
          throw new Error("Bitte einen Direktlieferanten wählen");
        }
        const lief = await tx.lieferant.findUnique({ where: { id: liefId }, select: { id: true } });
        if (!lief) throw new Error("Direktlieferant nicht gefunden");
        updateData.streckenLieferantId = liefId;
      } else {
        updateData.streckenLieferantId = null;
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
    Sentry.captureException(err);
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
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// Rechnung erstellen
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
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
        const aktLieferung = await tx.lieferung.findUnique({
          where: { id: Number(id) },
          select: { istStreckengeschaeft: true },
        });
        if (!aktLieferung?.istStreckengeschaeft) {
          const positionen = await tx.lieferposition.findMany({ where: { lieferungId: Number(id) } });
          const artikelIds = [...new Set(positionen.map((p) => p.artikelId))];
          const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
          const artikelMap = new Map(artikelList.map((a) => [a.id, a]));
          for (const pos of positionen) {
            const artikel = artikelMap.get(pos.artikelId);
            if (!artikel || !istLagerrelevant(artikel.kategorie)) continue;
            const neuerBestand = artikel.aktuellerBestand - pos.menge;
            artikel.aktuellerBestand = neuerBestand;
            await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
            await tx.lagerbewegung.create({
              data: { artikelId: pos.artikelId, typ: "ausgang", menge: -pos.menge, bestandNach: neuerBestand, lieferungId: Number(id) },
            });
          }
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
      Sentry.captureException(err);
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

        const [einstellung, prefixSetting] = await Promise.all([
          tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } }),
          tx.einstellung.findUnique({ where: { key: "system.nummernkreis.rechnung_prefix" } }),
        ]);
        const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null, prefixSetting?.value || "RE");

        // Doppelte Rechnungsnummern verhindern (z.B. wenn der Zähler in den Einstellungen zurückgesetzt wurde)
        if (await rechnungsnummerVergeben(tx, rechnungNr, Number(id))) {
          throw new Error(`Rechnungsnummer ${rechnungNr} ist bereits vergeben – bitte den Zählerstand unter Einstellungen › Nummernkreise korrigieren`);
        }

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
      Sentry.captureException(err);
      console.error("Lieferung aktion error:", err);
      const isDev = process.env.NODE_ENV === "development";
      const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Rechnung stornieren / Storno aufheben
  if (aktion === "rechnung_stornieren" || aktion === "rechnung_storno_aufheben") {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
    const stornieren = aktion === "rechnung_stornieren";
    try {
      const alt = await prisma.lieferung.findUnique({
        where: { id: numId },
        select: { rechnungNr: true, rechnungStorniert: true },
      });
      if (!alt) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
      if (!alt.rechnungNr) {
        return NextResponse.json({ error: "Für diese Lieferung existiert keine Rechnung" }, { status: 400 });
      }
      const updated = await prisma.lieferung.update({
        where: { id: numId },
        data: { rechnungStorniert: stornieren ? new Date() : null },
        include: {
          kunde: { include: { kontakte: true } },
          positionen: { include: { artikel: { select: artikelSafeSelect } } },
        },
      });
      void auditLog({
        entitaet: "Lieferung",
        entitaetId: numId,
        aktion: "geaendert",
        feld: "rechnungStorniert",
        alterWert: alt.rechnungStorniert ? "storniert" : "aktiv",
        neuerWert: stornieren ? "storniert" : "aktiv",
        beschreibung: stornieren
          ? `Rechnung ${alt.rechnungNr} storniert${typeof body.grund === "string" && body.grund.trim() ? ` – ${body.grund.trim()}` : ""}`
          : `Storno der Rechnung ${alt.rechnungNr} aufgehoben`,
      });
      return NextResponse.json(updated);
    } catch (err) {
      Sentry.captureException(err);
      console.error("Rechnung-Storno error:", err);
      const isDev = process.env.NODE_ENV === "development";
      const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Unterschrift speichern
  if (body.unterschriftPng !== undefined) {
    try {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
      const wert = body.unterschriftPng;
      if (typeof wert !== "string" && wert !== null) {
        return NextResponse.json({ error: "unterschriftPng muss ein String oder null sein" }, { status: 400 });
      }
      const updated = await prisma.lieferung.update({
        where: { id: numId },
        data: { unterschriftPng: wert ?? null },
        select: { id: true, unterschriftPng: true },
      });
      return NextResponse.json(updated);
    } catch (err) {
      Sentry.captureException(err);
      console.error("Unterschrift speichern error:", err);
      const isDev = process.env.NODE_ENV === "development";
      const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
}
