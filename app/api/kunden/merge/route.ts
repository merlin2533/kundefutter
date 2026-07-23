import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditChanges, auditLog } from "@/lib/audit";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// Scalar-Felder, die beim Zusammenführen wahlweise vom Ziel- oder Quell-Kunden
// übernommen werden können (deckt sich mit app/api/kunden/[id]/route.ts PUT).
const KUNDE_FELD_NAMEN = [
  "name", "firma", "kategorie", "verantwortlicher", "betriebsnummer", "flaeche",
  "strasse", "plz", "ort", "land", "lat", "lng", "notizen", "ustIdNr",
  "kreditlimit", "sachkundeNr", "sachkundeGueltigBis", "vvvoNr",
] as const;

function parseId(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Anzahl verknüpfter Datensätze je Relation für einen Kunden — Basis für die Merge-Vorschau. */
async function zaehleRelationen(kundeId: number) {
  const [
    kontakte, kundeNotizen, aktivitaeten, schlaegte, lieferungen, mengenrabatte,
    sammelrechnungen, bestellpositionen, antragDaten, aufgaben, angebote,
    gutschriften, psmAusbringungen, kontrakte, reklamationen, sachkundenachweise,
    sortenversuche, vorbestellungen, tiere, rationsberechnungen, anlieferungen,
    anbauplaene, zertifizierungen, benachrichtigungen,
    artikelPreise, bedarfe, sprengstoffErklaerungen, kampagnen, portalZugang,
  ] = await Promise.all([
    prisma.kundeKontakt.count({ where: { kundeId } }),
    prisma.kundeNotiz.count({ where: { kundeId } }),
    prisma.kundeAktivitaet.count({ where: { kundeId } }),
    prisma.kundeSchlag.count({ where: { kundeId } }),
    prisma.lieferung.count({ where: { kundeId } }),
    prisma.mengenrabatt.count({ where: { kundeId } }),
    prisma.sammelrechnung.count({ where: { kundeId } }),
    prisma.bestellposition.count({ where: { kundeId } }),
    prisma.antragEmpfaenger.count({ where: { kundeId } }),
    prisma.aufgabe.count({ where: { kundeId } }),
    prisma.angebot.count({ where: { kundeId } }),
    prisma.gutschrift.count({ where: { kundeId } }),
    prisma.psmAusbringung.count({ where: { kundeId } }),
    prisma.kontrakt.count({ where: { kundeId } }),
    prisma.reklamation.count({ where: { kundeId } }),
    prisma.sachkundenachweis.count({ where: { kundeId } }),
    prisma.sortenversuch.count({ where: { kundeId } }),
    prisma.vorbestellung.count({ where: { kundeId } }),
    prisma.kundeTier.count({ where: { kundeId } }),
    prisma.rationsberechnung.count({ where: { kundeId } }),
    prisma.anlieferung.count({ where: { kundeId } }),
    prisma.anbauplan.count({ where: { kundeId } }),
    prisma.zertifizierung.count({ where: { kundeId } }),
    prisma.benachrichtigung.count({ where: { kundeId } }),
    prisma.kundeArtikelPreis.count({ where: { kundeId } }),
    prisma.kundeBedarf.count({ where: { kundeId } }),
    prisma.kundeSprengstoffErklaerung.count({ where: { kundeId } }),
    prisma.kampagneKunde.count({ where: { kundeId } }),
    prisma.kundePortalZugang.count({ where: { kundeId } }),
  ]);
  return {
    kontakte, kundeNotizen, aktivitaeten, schlaegte, lieferungen, mengenrabatte,
    sammelrechnungen, bestellpositionen, antragDaten, aufgaben, angebote,
    gutschriften, psmAusbringungen, kontrakte, reklamationen, sachkundenachweise,
    sortenversuche, vorbestellungen, tiere, rationsberechnungen, anlieferungen,
    anbauplaene, zertifizierungen, benachrichtigungen,
    artikelPreise, bedarfe, sprengstoffErklaerungen, kampagnen, portalZugang,
  };
}

/** GET ?zielId=&quelleId= — Vorschau vor dem Zusammenführen (Stammdaten + Anzahl verknüpfter Datensätze + Konflikte). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zielId = parseId(searchParams.get("zielId"));
  const quelleId = parseId(searchParams.get("quelleId"));

  if (!zielId || !quelleId) {
    return NextResponse.json({ error: "zielId und quelleId sind erforderlich" }, { status: 400 });
  }
  if (zielId === quelleId) {
    return NextResponse.json({ error: "Ziel- und Quell-Kunde müssen unterschiedlich sein" }, { status: 400 });
  }

  try {
    const [ziel, quelle] = await Promise.all([
      prisma.kunde.findUnique({ where: { id: zielId } }),
      prisma.kunde.findUnique({ where: { id: quelleId } }),
    ]);
    if (!ziel || !quelle) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const [anzahlQuelle, anzahlZiel] = await Promise.all([
      zaehleRelationen(quelleId),
      zaehleRelationen(zielId),
    ]);

    // Konflikte: Datensätze der Quelle, die wegen eines unique-Constraints beim
    // Zusammenführen NICHT einfach umgehängt werden können (Duplikat beim Ziel
    // existiert bereits) und daher verworfen würden (Ziel-Wert bleibt erhalten).
    const [quelleArtikelPreise, zielArtikelPreise, quelleBedarfe, zielBedarfe,
      quelleErklaerungen, zielErklaerungen, quelleKampagnen, zielKampagnen] = await Promise.all([
      prisma.kundeArtikelPreis.findMany({ where: { kundeId: quelleId }, select: { artikelId: true } }),
      prisma.kundeArtikelPreis.findMany({ where: { kundeId: zielId }, select: { artikelId: true } }),
      prisma.kundeBedarf.findMany({ where: { kundeId: quelleId }, select: { artikelId: true } }),
      prisma.kundeBedarf.findMany({ where: { kundeId: zielId }, select: { artikelId: true } }),
      prisma.kundeSprengstoffErklaerung.findMany({ where: { kundeId: quelleId }, select: { jahr: true } }),
      prisma.kundeSprengstoffErklaerung.findMany({ where: { kundeId: zielId }, select: { jahr: true } }),
      prisma.kampagneKunde.findMany({ where: { kundeId: quelleId }, select: { kampagneId: true } }),
      prisma.kampagneKunde.findMany({ where: { kundeId: zielId }, select: { kampagneId: true } }),
    ]);
    const zielArtikelIds = new Set(zielArtikelPreise.map((p) => p.artikelId));
    const zielBedarfArtikelIds = new Set(zielBedarfe.map((b) => b.artikelId));
    const zielJahre = new Set(zielErklaerungen.map((e) => e.jahr));
    const zielKampagneIds = new Set(zielKampagnen.map((k) => k.kampagneId));

    const konflikte = {
      artikelPreise: quelleArtikelPreise.filter((p) => zielArtikelIds.has(p.artikelId)).length,
      bedarfe: quelleBedarfe.filter((b) => zielBedarfArtikelIds.has(b.artikelId)).length,
      sprengstoffErklaerungen: quelleErklaerungen.filter((e) => zielJahre.has(e.jahr)).length,
      kampagnen: quelleKampagnen.filter((k) => zielKampagneIds.has(k.kampagneId)).length,
      portalZugang: anzahlQuelle.portalZugang > 0 && anzahlZiel.portalZugang > 0,
    };

    return NextResponse.json({ ziel, quelle, anzahl: { ziel: anzahlZiel, quelle: anzahlQuelle }, konflikte });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Kunden-Merge GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler bei der Merge-Vorschau" }, { status: 500 });
  }
}

/** POST { zielId, quelleId, felder } — führt Quell- in Ziel-Kunde zusammen und löscht die Quelle danach. */
export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const zielId = typeof body.zielId === "number" ? body.zielId : parseId(String(body.zielId ?? ""));
  const quelleId = typeof body.quelleId === "number" ? body.quelleId : parseId(String(body.quelleId ?? ""));
  const felder = body.felder && typeof body.felder === "object" ? body.felder : {};

  if (!zielId || !quelleId) {
    return NextResponse.json({ error: "zielId und quelleId sind erforderlich" }, { status: 400 });
  }
  if (zielId === quelleId) {
    return NextResponse.json({ error: "Ziel- und Quell-Kunde müssen unterschiedlich sein" }, { status: 400 });
  }

  // Whitelist + Sanitisierung analog PUT /api/kunden/[id]
  const updateData: Record<string, unknown> = {};
  for (const feld of KUNDE_FELD_NAMEN) {
    if (felder[feld] === undefined) continue;
    const wert = felder[feld];
    switch (feld) {
      case "flaeche":
      case "lat":
      case "lng":
      case "kreditlimit":
        updateData[feld] = wert != null && wert !== "" ? Number(wert) : null;
        break;
      case "sachkundeGueltigBis":
        updateData[feld] = wert ? new Date(wert) : null;
        break;
      case "vvvoNr":
        if (wert) {
          const ziffern = String(wert).replace(/\D/g, "");
          updateData.vvvoNr = ziffern.length === 9 ? "276" + ziffern : ziffern.substring(0, 12);
        } else {
          updateData.vvvoNr = null;
        }
        break;
      case "land":
        updateData.land = wert || "Deutschland";
        break;
      case "kategorie":
        updateData.kategorie = wert || "Sonstige";
        break;
      case "name":
        updateData.name = typeof wert === "string" ? wert.trim() : wert;
        break;
      default:
        updateData[feld] = wert || null;
    }
  }
  if (Array.isArray(felder.tags)) {
    updateData.tags = JSON.stringify(felder.tags);
  }

  if (updateData.name !== undefined && (!updateData.name || typeof updateData.name !== "string")) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [zielVorher, quelle] = await Promise.all([
        tx.kunde.findUnique({ where: { id: zielId } }),
        tx.kunde.findUnique({ where: { id: quelleId } }),
      ]);
      if (!zielVorher || !quelle) {
        throw new Error("NICHT_GEFUNDEN");
      }

      const zielNachher = await tx.kunde.update({ where: { id: zielId }, data: updateData });

      // ── Relationen mit unique-Constraint: Duplikate der Quelle verwerfen, Rest umhängen ──
      const [quelleArtikelPreise, zielArtikelIds] = await Promise.all([
        tx.kundeArtikelPreis.findMany({ where: { kundeId: quelleId } }),
        tx.kundeArtikelPreis.findMany({ where: { kundeId: zielId }, select: { artikelId: true } })
          .then((rows) => new Set(rows.map((r) => r.artikelId))),
      ]);
      const artikelPreiseDup = quelleArtikelPreise.filter((p) => zielArtikelIds.has(p.artikelId)).map((p) => p.id);
      const artikelPreiseUmhaengen = quelleArtikelPreise.filter((p) => !zielArtikelIds.has(p.artikelId)).map((p) => p.id);
      if (artikelPreiseDup.length) await tx.kundeArtikelPreis.deleteMany({ where: { id: { in: artikelPreiseDup } } });
      if (artikelPreiseUmhaengen.length) await tx.kundeArtikelPreis.updateMany({ where: { id: { in: artikelPreiseUmhaengen } }, data: { kundeId: zielId } });

      const [quelleBedarfe, zielBedarfArtikelIds] = await Promise.all([
        tx.kundeBedarf.findMany({ where: { kundeId: quelleId } }),
        tx.kundeBedarf.findMany({ where: { kundeId: zielId }, select: { artikelId: true } })
          .then((rows) => new Set(rows.map((r) => r.artikelId))),
      ]);
      const bedarfeDup = quelleBedarfe.filter((b) => zielBedarfArtikelIds.has(b.artikelId)).map((b) => b.id);
      const bedarfeUmhaengen = quelleBedarfe.filter((b) => !zielBedarfArtikelIds.has(b.artikelId)).map((b) => b.id);
      if (bedarfeDup.length) await tx.kundeBedarf.deleteMany({ where: { id: { in: bedarfeDup } } });
      if (bedarfeUmhaengen.length) await tx.kundeBedarf.updateMany({ where: { id: { in: bedarfeUmhaengen } }, data: { kundeId: zielId } });

      const [quelleErklaerungen, zielJahre] = await Promise.all([
        tx.kundeSprengstoffErklaerung.findMany({ where: { kundeId: quelleId } }),
        tx.kundeSprengstoffErklaerung.findMany({ where: { kundeId: zielId }, select: { jahr: true } })
          .then((rows) => new Set(rows.map((r) => r.jahr))),
      ]);
      const erklaerungenDup = quelleErklaerungen.filter((e) => zielJahre.has(e.jahr)).map((e) => e.id);
      const erklaerungenUmhaengen = quelleErklaerungen.filter((e) => !zielJahre.has(e.jahr)).map((e) => e.id);
      if (erklaerungenDup.length) await tx.kundeSprengstoffErklaerung.deleteMany({ where: { id: { in: erklaerungenDup } } });
      if (erklaerungenUmhaengen.length) await tx.kundeSprengstoffErklaerung.updateMany({ where: { id: { in: erklaerungenUmhaengen } }, data: { kundeId: zielId } });

      const [quelleKampagnen, zielKampagneIds] = await Promise.all([
        tx.kampagneKunde.findMany({ where: { kundeId: quelleId } }),
        tx.kampagneKunde.findMany({ where: { kundeId: zielId }, select: { kampagneId: true } })
          .then((rows) => new Set(rows.map((r) => r.kampagneId))),
      ]);
      const kampagnenDup = quelleKampagnen.filter((k) => zielKampagneIds.has(k.kampagneId)).map((k) => k.id);
      const kampagnenUmhaengen = quelleKampagnen.filter((k) => !zielKampagneIds.has(k.kampagneId)).map((k) => k.id);
      if (kampagnenDup.length) await tx.kampagneKunde.deleteMany({ where: { id: { in: kampagnenDup } } });
      if (kampagnenUmhaengen.length) await tx.kampagneKunde.updateMany({ where: { id: { in: kampagnenUmhaengen } }, data: { kundeId: zielId } });

      // 1:1-Relation Kunden-Portal-Zugang: hat das Ziel bereits einen, wird der der Quelle verworfen
      const [zielPortal, quellePortal] = await Promise.all([
        tx.kundePortalZugang.findUnique({ where: { kundeId: zielId } }),
        tx.kundePortalZugang.findUnique({ where: { kundeId: quelleId } }),
      ]);
      if (quellePortal) {
        if (zielPortal) {
          await tx.kundePortalZugang.delete({ where: { id: quellePortal.id } });
        } else {
          await tx.kundePortalZugang.update({ where: { id: quellePortal.id }, data: { kundeId: zielId } });
        }
      }

      // ── Relationen ohne unique-Constraint: einfach umhängen ──
      await Promise.all([
        tx.kundeKontakt.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.kundeNotiz.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.kundeAktivitaet.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.kundeSchlag.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.lieferung.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.mengenrabatt.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.sammelrechnung.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.bestellposition.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.antragEmpfaenger.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.aufgabe.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.angebot.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.gutschrift.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.psmAusbringung.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.kontrakt.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.reklamation.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.sachkundenachweis.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.sortenversuch.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.vorbestellung.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.kundeTier.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.rationsberechnung.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.anlieferung.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.anbauplan.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        tx.zertifizierung.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
        // Benachrichtigung.kundeId hat keinen FK-Constraint (kein @relation), muss aber
        // trotzdem mit umgehängt werden, damit alte Alerts nicht auf den gelöschten Kunden zeigen.
        tx.benachrichtigung.updateMany({ where: { kundeId: quelleId }, data: { kundeId: zielId } }),
      ]);

      await tx.kunde.delete({ where: { id: quelleId } });

      return { zielVorher, zielNachher, quelle };
    }, { timeout: 20000 });

    void auditChanges(
      "Kunde",
      zielId,
      result.zielVorher as unknown as Record<string, unknown>,
      result.zielNachher as unknown as Record<string, unknown>,
      [...KUNDE_FELD_NAMEN]
    );
    void auditLog({
      entitaet: "Kunde",
      entitaetId: zielId,
      aktion: "geaendert",
      beschreibung: `Kunde #${quelleId} (${result.quelle.name}) wurde in diesen Kunden zusammengeführt und gelöscht.`,
    });
    void auditLog({
      entitaet: "Kunde",
      entitaetId: quelleId,
      aktion: "geloescht",
      beschreibung: `Zusammengeführt in Kunde #${zielId} (${result.zielNachher.name}) und gelöscht.`,
    });

    return NextResponse.json({ ok: true, kunde: result.zielNachher });
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : String(err);
    if (message === "NICHT_GEFUNDEN") {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }
    console.error("Kunden-Merge POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const detail = isDev && err instanceof Error ? err.message : "Kunden konnten nicht zusammengeführt werden";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
