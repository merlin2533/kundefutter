import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditChanges, auditLog } from "@/lib/audit";
import { istChargenpflichtKategorie } from "@/lib/auswahllisten";
import { getChargenpflichtKategorien } from "@/lib/chargenpflicht";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// Scalar-Felder, die beim Zusammenführen wahlweise vom Ziel- oder Quell-Artikel
// übernommen werden können (deckt sich mit app/api/artikel/[id]/route.ts PUT).
// aktuellerBestand ist bewusst NICHT dabei — Lagerbestand wird immer summiert (siehe POST).
const ARTIKEL_FELD_NAMEN = [
  "artikelnummer", "name", "kategorie", "unterkategorie", "einheit", "beschreibung", "notiz",
  "standardpreis", "preisStand", "mwstSatz", "mindestbestand", "lagerort", "liefergroesse",
  "chargePflicht", "sprengstoffvorlaeufer", "lagerTracking",
  "ghsKlassen", "hSaetze", "pSaetze", "signalwort",
] as const;

function parseId(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Anzahl verknüpfter Datensätze je Relation für einen Artikel — Basis für die Merge-Vorschau. */
async function zaehleRelationen(artikelId: number) {
  const [
    inhaltsstoffe, dokumente, lieferanten, preisHistorie, jahrespreise,
    kundePreise, bedarfe, lieferpositionen, wareineingangPos, lagerbewegungen,
    retourePositionen, mengenrabatte, inventurPositionen, angebotPositionen,
    gutschriftPositionen, bestellpositionen, bestellungPositionen, kontraktPositionen,
    kampagneArtikel, angebotVorlagePositionen, chargenZertifikate,
    vorbestellungPositionen, fruehbezugStaffeln, anlieferungen,
    benachrichtigungen, einkaufStatus,
  ] = await Promise.all([
    prisma.artikelInhaltsstoff.count({ where: { artikelId } }),
    prisma.artikelDokument.count({ where: { artikelId } }),
    prisma.artikelLieferant.count({ where: { artikelId } }),
    prisma.artikelPreisHistorie.count({ where: { artikelId } }),
    prisma.artikelJahrespreis.count({ where: { artikelId } }),
    prisma.kundeArtikelPreis.count({ where: { artikelId } }),
    prisma.kundeBedarf.count({ where: { artikelId } }),
    prisma.lieferposition.count({ where: { artikelId } }),
    prisma.wareineingangPosition.count({ where: { artikelId } }),
    prisma.lagerbewegung.count({ where: { artikelId } }),
    prisma.retourePosition.count({ where: { artikelId } }),
    prisma.mengenrabatt.count({ where: { artikelId } }),
    prisma.inventurPosition.count({ where: { artikelId } }),
    prisma.angebotPosition.count({ where: { artikelId } }),
    prisma.gutschriftPosition.count({ where: { artikelId } }),
    prisma.bestellposition.count({ where: { artikelId } }),
    prisma.bestellungPosition.count({ where: { artikelId } }),
    prisma.kontraktPosition.count({ where: { artikelId } }),
    prisma.kampagneArtikel.count({ where: { artikelId } }),
    prisma.angebotVorlagePosition.count({ where: { artikelId } }),
    prisma.chargenZertifikat.count({ where: { artikelId } }),
    prisma.vorbestellungPosition.count({ where: { artikelId } }),
    prisma.fruehbezugsStaffel.count({ where: { artikelId } }),
    prisma.anlieferung.count({ where: { artikelId } }),
    prisma.benachrichtigung.count({ where: { artikelId } }),
    prisma.einkaufStatus.count({ where: { artikelId } }),
  ]);
  return {
    inhaltsstoffe, dokumente, lieferanten, preisHistorie, jahrespreise,
    kundePreise, bedarfe, lieferpositionen, wareineingangPos, lagerbewegungen,
    retourePositionen, mengenrabatte, inventurPositionen, angebotPositionen,
    gutschriftPositionen, bestellpositionen, bestellungPositionen, kontraktPositionen,
    kampagneArtikel, angebotVorlagePositionen, chargenZertifikate,
    vorbestellungPositionen, fruehbezugStaffeln, anlieferungen,
    benachrichtigungen, einkaufStatus,
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
    return NextResponse.json({ error: "Ziel- und Quell-Artikel müssen unterschiedlich sein" }, { status: 400 });
  }

  try {
    const [ziel, quelle] = await Promise.all([
      prisma.artikel.findUnique({ where: { id: zielId } }),
      prisma.artikel.findUnique({ where: { id: quelleId } }),
    ]);
    if (!ziel || !quelle) {
      return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
    }

    const [anzahlQuelle, anzahlZiel] = await Promise.all([
      zaehleRelationen(quelleId),
      zaehleRelationen(zielId),
    ]);

    // Konflikte: Datensätze der Quelle, die wegen eines unique-Constraints beim
    // Zusammenführen NICHT einfach umgehängt werden können (Duplikat beim Ziel
    // existiert bereits) und daher verworfen würden (Ziel-Wert bleibt erhalten).
    const [
      quelleLieferanten, zielLieferantIds,
      quelleJahrespreise, zielJahre,
      quelleKundePreise, zielKundePreisPaare,
      quelleBedarfe, zielBedarfPaare,
      quelleKampagnen, zielKampagneIds,
    ] = await Promise.all([
      prisma.artikelLieferant.findMany({ where: { artikelId: quelleId }, select: { lieferantId: true } }),
      prisma.artikelLieferant.findMany({ where: { artikelId: zielId }, select: { lieferantId: true } })
        .then((rows) => new Set(rows.map((r) => r.lieferantId))),
      prisma.artikelJahrespreis.findMany({ where: { artikelId: quelleId }, select: { jahr: true } }),
      prisma.artikelJahrespreis.findMany({ where: { artikelId: zielId }, select: { jahr: true } })
        .then((rows) => new Set(rows.map((r) => r.jahr))),
      prisma.kundeArtikelPreis.findMany({ where: { artikelId: quelleId }, select: { kundeId: true } }),
      prisma.kundeArtikelPreis.findMany({ where: { artikelId: zielId }, select: { kundeId: true } })
        .then((rows) => new Set(rows.map((r) => r.kundeId))),
      prisma.kundeBedarf.findMany({ where: { artikelId: quelleId }, select: { kundeId: true } }),
      prisma.kundeBedarf.findMany({ where: { artikelId: zielId }, select: { kundeId: true } })
        .then((rows) => new Set(rows.map((r) => r.kundeId))),
      prisma.kampagneArtikel.findMany({ where: { artikelId: quelleId }, select: { kampagneId: true } }),
      prisma.kampagneArtikel.findMany({ where: { artikelId: zielId }, select: { kampagneId: true } })
        .then((rows) => new Set(rows.map((r) => r.kampagneId))),
    ]);

    const konflikte = {
      lieferanten: quelleLieferanten.filter((l) => zielLieferantIds.has(l.lieferantId)).length,
      jahrespreise: quelleJahrespreise.filter((j) => zielJahre.has(j.jahr)).length,
      kundePreise: quelleKundePreise.filter((p) => zielKundePreisPaare.has(p.kundeId)).length,
      bedarfe: quelleBedarfe.filter((b) => zielBedarfPaare.has(b.kundeId)).length,
      kampagnen: quelleKampagnen.filter((k) => zielKampagneIds.has(k.kampagneId)).length,
    };

    return NextResponse.json({
      ziel, quelle,
      anzahl: { ziel: anzahlZiel, quelle: anzahlQuelle },
      konflikte,
      lagerbestandSumme: ziel.aktuellerBestand + quelle.aktuellerBestand,
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Artikel-Merge GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler bei der Merge-Vorschau" }, { status: 500 });
  }
}

/** POST { zielId, quelleId, felder } — führt Quell- in Ziel-Artikel zusammen und löscht die Quelle danach. */
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
    return NextResponse.json({ error: "Ziel- und Quell-Artikel müssen unterschiedlich sein" }, { status: 400 });
  }

  // Whitelist + Sanitisierung analog PUT /api/artikel/[id]
  const updateData: Record<string, unknown> = {};
  for (const feld of ARTIKEL_FELD_NAMEN) {
    if (felder[feld] === undefined) continue;
    const wert = felder[feld];
    switch (feld) {
      case "standardpreis":
      case "mwstSatz":
      case "mindestbestand":
        updateData[feld] = Number(wert);
        break;
      case "preisStand":
        updateData.preisStand = wert ? new Date(String(wert)) : null;
        break;
      case "chargePflicht":
      case "sprengstoffvorlaeufer":
      case "lagerTracking":
        updateData[feld] = Boolean(wert);
        break;
      case "unterkategorie":
      case "beschreibung":
      case "notiz":
      case "lagerort":
      case "liefergroesse":
      case "ghsKlassen":
      case "hSaetze":
      case "pSaetze":
      case "signalwort":
        updateData[feld] = wert ? String(wert) : null;
        break;
      case "name":
      case "artikelnummer":
      case "kategorie":
      case "einheit":
        updateData[feld] = String(wert);
        break;
    }
  }

  if (updateData.name !== undefined && !updateData.name) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }
  if (updateData.artikelnummer !== undefined && !updateData.artikelnummer) {
    return NextResponse.json({ error: "Artikelnummer ist erforderlich" }, { status: 400 });
  }

  try {
    const chargenpflichtKats = await getChargenpflichtKategorien();

    const result = await prisma.$transaction(async (tx) => {
      const [zielVorher, quelle] = await Promise.all([
        tx.artikel.findUnique({ where: { id: zielId } }),
        tx.artikel.findUnique({ where: { id: quelleId } }),
      ]);
      if (!zielVorher || !quelle) {
        throw new Error("NICHT_GEFUNDEN");
      }

      // Lagerbestand wird immer summiert — beide Artikel bilden real vorhandene Ware ab,
      // eine Auswahl "entweder/oder" würde physisch vorhandenen Bestand verschwinden lassen.
      updateData.aktuellerBestand = zielVorher.aktuellerBestand + quelle.aktuellerBestand;

      // Chargenpflichtige Kategorien (konfigurierbar) → Flag immer erzwingen, wie beim
      // normalen PUT /api/artikel/[id] — unabhängig davon, welcher Wert oben gewählt wurde.
      const effektiveKategorie = (updateData.kategorie as string | undefined) ?? zielVorher.kategorie;
      if (istChargenpflichtKategorie(effektiveKategorie, chargenpflichtKats)) updateData.chargePflicht = true;

      const zielNachher = await tx.artikel.update({ where: { id: zielId }, data: updateData });

      // ── Relationen mit unique-Constraint: Duplikate der Quelle verwerfen, Rest umhängen ──
      const [quelleLieferanten, zielLieferantIds] = await Promise.all([
        tx.artikelLieferant.findMany({ where: { artikelId: quelleId } }),
        tx.artikelLieferant.findMany({ where: { artikelId: zielId }, select: { lieferantId: true } })
          .then((rows) => new Set(rows.map((r) => r.lieferantId))),
      ]);
      const lieferantenDup = quelleLieferanten.filter((l) => zielLieferantIds.has(l.lieferantId)).map((l) => l.id);
      const lieferantenUmhaengen = quelleLieferanten.filter((l) => !zielLieferantIds.has(l.lieferantId)).map((l) => l.id);
      // Cascade löscht dabei auch Jahrespreise/Preisverlauf dieses (verworfenen) Lieferanten-Links.
      if (lieferantenDup.length) await tx.artikelLieferant.deleteMany({ where: { id: { in: lieferantenDup } } });
      if (lieferantenUmhaengen.length) await tx.artikelLieferant.updateMany({ where: { id: { in: lieferantenUmhaengen } }, data: { artikelId: zielId } });

      const [quelleJahrespreise, zielJahre] = await Promise.all([
        tx.artikelJahrespreis.findMany({ where: { artikelId: quelleId } }),
        tx.artikelJahrespreis.findMany({ where: { artikelId: zielId }, select: { jahr: true } })
          .then((rows) => new Set(rows.map((r) => r.jahr))),
      ]);
      const jahrespreiseDup = quelleJahrespreise.filter((j) => zielJahre.has(j.jahr)).map((j) => j.id);
      const jahrespreiseUmhaengen = quelleJahrespreise.filter((j) => !zielJahre.has(j.jahr)).map((j) => j.id);
      if (jahrespreiseDup.length) await tx.artikelJahrespreis.deleteMany({ where: { id: { in: jahrespreiseDup } } });
      if (jahrespreiseUmhaengen.length) await tx.artikelJahrespreis.updateMany({ where: { id: { in: jahrespreiseUmhaengen } }, data: { artikelId: zielId } });

      const [quelleKundePreise, zielKundePreisPaare] = await Promise.all([
        tx.kundeArtikelPreis.findMany({ where: { artikelId: quelleId } }),
        tx.kundeArtikelPreis.findMany({ where: { artikelId: zielId }, select: { kundeId: true } })
          .then((rows) => new Set(rows.map((r) => r.kundeId))),
      ]);
      const kundePreiseDup = quelleKundePreise.filter((p) => zielKundePreisPaare.has(p.kundeId)).map((p) => p.id);
      const kundePreiseUmhaengen = quelleKundePreise.filter((p) => !zielKundePreisPaare.has(p.kundeId)).map((p) => p.id);
      if (kundePreiseDup.length) await tx.kundeArtikelPreis.deleteMany({ where: { id: { in: kundePreiseDup } } });
      if (kundePreiseUmhaengen.length) await tx.kundeArtikelPreis.updateMany({ where: { id: { in: kundePreiseUmhaengen } }, data: { artikelId: zielId } });

      const [quelleBedarfe, zielBedarfPaare] = await Promise.all([
        tx.kundeBedarf.findMany({ where: { artikelId: quelleId } }),
        tx.kundeBedarf.findMany({ where: { artikelId: zielId }, select: { kundeId: true } })
          .then((rows) => new Set(rows.map((r) => r.kundeId))),
      ]);
      const bedarfeDup = quelleBedarfe.filter((b) => zielBedarfPaare.has(b.kundeId)).map((b) => b.id);
      const bedarfeUmhaengen = quelleBedarfe.filter((b) => !zielBedarfPaare.has(b.kundeId)).map((b) => b.id);
      if (bedarfeDup.length) await tx.kundeBedarf.deleteMany({ where: { id: { in: bedarfeDup } } });
      if (bedarfeUmhaengen.length) await tx.kundeBedarf.updateMany({ where: { id: { in: bedarfeUmhaengen } }, data: { artikelId: zielId } });

      const [quelleKampagnen, zielKampagneIds] = await Promise.all([
        tx.kampagneArtikel.findMany({ where: { artikelId: quelleId } }),
        tx.kampagneArtikel.findMany({ where: { artikelId: zielId }, select: { kampagneId: true } })
          .then((rows) => new Set(rows.map((r) => r.kampagneId))),
      ]);
      const kampagnenDup = quelleKampagnen.filter((k) => zielKampagneIds.has(k.kampagneId)).map((k) => k.id);
      const kampagnenUmhaengen = quelleKampagnen.filter((k) => !zielKampagneIds.has(k.kampagneId)).map((k) => k.id);
      if (kampagnenDup.length) await tx.kampagneArtikel.deleteMany({ where: { id: { in: kampagnenDup } } });
      if (kampagnenUmhaengen.length) await tx.kampagneArtikel.updateMany({ where: { id: { in: kampagnenUmhaengen } }, data: { artikelId: zielId } });

      // ── Relationen ohne unique-Constraint: einfach umhängen ──
      await Promise.all([
        tx.artikelInhaltsstoff.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.artikelDokument.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.artikelPreisHistorie.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.lieferposition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.wareineingangPosition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.lagerbewegung.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.retourePosition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.mengenrabatt.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.inventurPosition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.angebotPosition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.gutschriftPosition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.bestellposition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.bestellungPosition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.kontraktPosition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.angebotVorlagePosition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.chargenZertifikat.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.vorbestellungPosition.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.fruehbezugsStaffel.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.anlieferung.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        // Benachrichtigung.artikelId und EinkaufStatus.artikelId haben keinen FK-Constraint
        // (kein @relation), müssen aber trotzdem mit umgehängt werden, damit alte Alerts/
        // Beschaffungsstatus nicht auf den gleich gelöschten Quell-Artikel zeigen.
        tx.benachrichtigung.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
        tx.einkaufStatus.updateMany({ where: { artikelId: quelleId }, data: { artikelId: zielId } }),
      ]);

      await tx.artikel.delete({ where: { id: quelleId } });

      return { zielVorher, zielNachher, quelle };
    }, { timeout: 20000 });

    void auditChanges(
      "Artikel",
      zielId,
      result.zielVorher as unknown as Record<string, unknown>,
      result.zielNachher as unknown as Record<string, unknown>,
      [...ARTIKEL_FELD_NAMEN, "aktuellerBestand"]
    );
    void auditLog({
      entitaet: "Artikel",
      entitaetId: zielId,
      aktion: "geaendert",
      beschreibung: `Artikel #${quelleId} (${result.quelle.name}) wurde in diesen Artikel zusammengeführt und gelöscht.`,
    });
    void auditLog({
      entitaet: "Artikel",
      entitaetId: quelleId,
      aktion: "geloescht",
      beschreibung: `Zusammengeführt in Artikel #${zielId} (${result.zielNachher.name}) und gelöscht.`,
    });

    return NextResponse.json({ ok: true, artikel: result.zielNachher });
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : String(err);
    if (message === "NICHT_GEFUNDEN") {
      return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
    }
    console.error("Artikel-Merge POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const detail = isDev && err instanceof Error ? err.message : "Artikel konnten nicht zusammengeführt werden";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
