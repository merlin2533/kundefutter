import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const STAMMDATEN_TEXT_FELDER = [
  "ansprechpartner",
  "email",
  "telefon",
  "strasse",
  "plz",
  "ort",
  "notizen",
  "iban",
  "bic",
  "kontoinhaber",
] as const;
const STAMMDATEN_ZAHL_FELDER = ["frachtkosten", "mindestbestellwert"] as const;

type LieferantVoll = Awaited<ReturnType<typeof ladeLieferantMitDetails>>;

async function ladeLieferantMitDetails(id: number) {
  return prisma.lieferant.findUnique({
    where: { id },
    include: {
      artikelZuordnungen: { include: { artikel: { select: { id: true, name: true, einheit: true } } } },
      _count: {
        select: {
          wareneingaenge: true,
          bestellpositionen: true,
          ausgaben: true,
          bestellungen: true,
          eingangsRechnungen: true,
          streckenLieferungen: true,
          retouren: true,
        },
      },
    },
  });
}

function isLeer(wert: unknown) {
  return wert === null || wert === undefined || wert === "";
}

/** Ermittelt, welche Stammdaten-Felder des Ziellieferanten aus welcher Quelle aufgefüllt werden können. */
function ermittleStammdatenUebernahme(ziel: NonNullable<LieferantVoll>, quellen: NonNullable<LieferantVoll>[]) {
  const uebernahme: { feld: string; wert: string | number; vonLieferantId: number; vonLieferantName: string }[] = [];

  for (const feld of STAMMDATEN_TEXT_FELDER) {
    if (!isLeer((ziel as Record<string, unknown>)[feld])) continue;
    for (const q of quellen) {
      const wert = (q as Record<string, unknown>)[feld];
      if (!isLeer(wert)) {
        uebernahme.push({ feld, wert: wert as string, vonLieferantId: q.id, vonLieferantName: q.name });
        break;
      }
    }
  }
  for (const feld of STAMMDATEN_ZAHL_FELDER) {
    if (((ziel as Record<string, unknown>)[feld] as number) !== 0) continue;
    for (const q of quellen) {
      const wert = (q as Record<string, unknown>)[feld] as number;
      if (wert !== 0) {
        uebernahme.push({ feld, wert, vonLieferantId: q.id, vonLieferantName: q.name });
        break;
      }
    }
  }
  return uebernahme;
}

async function baueVorschau(zielId: number, quellIds: number[]) {
  const ziel = await ladeLieferantMitDetails(zielId);
  if (!ziel) return { error: "Ziellieferant nicht gefunden" as const };

  const quellen: NonNullable<LieferantVoll>[] = [];
  for (const qid of quellIds) {
    const q = await ladeLieferantMitDetails(qid);
    if (!q) return { error: `Quell-Lieferant ${qid} nicht gefunden` as const };
    quellen.push(q);
  }

  const zielArtikelIds = new Set(ziel.artikelZuordnungen.map((z) => z.artikelId));

  const quellenDetail = quellen.map((q) => ({
    id: q.id,
    name: q.name,
    artikel: q.artikelZuordnungen.map((z) => ({
      artikelId: z.artikelId,
      name: z.artikel.name,
      einheit: z.artikel.einheit,
      einkaufspreis: z.einkaufspreis,
      lieferantenArtNr: z.lieferantenArtNr,
      mindestbestellmenge: z.mindestbestellmenge,
      lieferzeitTage: z.lieferzeitTage,
      bevorzugt: z.bevorzugt,
      konflikt: zielArtikelIds.has(z.artikelId),
    })),
    referenzen: {
      wareneingaenge: q._count.wareneingaenge,
      bestellpositionen: q._count.bestellpositionen,
      ausgaben: q._count.ausgaben,
      bestellungen: q._count.bestellungen,
      eingangsRechnungen: q._count.eingangsRechnungen,
      streckenLieferungen: q._count.streckenLieferungen,
      retouren: q._count.retouren,
    },
  }));

  const stammdatenUebernahme = ermittleStammdatenUebernahme(ziel, quellen);
  const gesamtArtikel = quellenDetail.reduce((s, q) => s + q.artikel.length, 0);
  const konflikte = quellenDetail.reduce((s, q) => s + q.artikel.filter((a) => a.konflikt).length, 0);

  return {
    ziel: {
      id: ziel.id,
      name: ziel.name,
      ansprechpartner: ziel.ansprechpartner,
      email: ziel.email,
      telefon: ziel.telefon,
      strasse: ziel.strasse,
      plz: ziel.plz,
      ort: ziel.ort,
      notizen: ziel.notizen,
      iban: ziel.iban,
      bic: ziel.bic,
      kontoinhaber: ziel.kontoinhaber,
      frachtkosten: ziel.frachtkosten,
      mindestbestellwert: ziel.mindestbestellwert,
      artikelAnzahl: ziel.artikelZuordnungen.length,
    },
    quellen: quellenDetail,
    stammdatenUebernahme,
    gesamtArtikel,
    konflikte,
  };
}

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

/** GET – Vorschau des Verschmelzungsergebnisses, keine Änderungen. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zielId = parseInt(searchParams.get("zielId") ?? "", 10);
  const quellIds = parseIds(searchParams.get("quellIds"));

  if (!Number.isFinite(zielId) || quellIds.length === 0) {
    return NextResponse.json({ error: "zielId und quellIds erforderlich" }, { status: 400 });
  }
  if (quellIds.includes(zielId)) {
    return NextResponse.json({ error: "Ziellieferant darf nicht in den Quell-Lieferanten enthalten sein" }, { status: 400 });
  }

  try {
    const vorschau = await baueVorschau(zielId, [...new Set(quellIds)]);
    if ("error" in vorschau) return NextResponse.json({ error: vorschau.error }, { status: 404 });
    return NextResponse.json(vorschau);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Vorschau konnte nicht geladen werden" }, { status: 500 });
  }
}

interface MergeBody {
  zielLieferantId?: number;
  quellLieferantIds?: number[];
  zielName?: string;
  confirm?: boolean;
}

/** POST – Führt die Verschmelzung aus. Body: { zielLieferantId, quellLieferantIds, zielName?, confirm: true } */
export async function POST(req: NextRequest) {
  let body: MergeBody = {};
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const zielId = Number(body.zielLieferantId);
  const quellIds = [...new Set((body.quellLieferantIds ?? []).map((n) => Number(n)))].filter((n) => Number.isFinite(n));

  if (!Number.isFinite(zielId) || quellIds.length === 0) {
    return NextResponse.json({ error: "zielLieferantId und quellLieferantIds erforderlich" }, { status: 400 });
  }
  if (quellIds.includes(zielId)) {
    return NextResponse.json({ error: "Ziellieferant darf nicht in den Quell-Lieferanten enthalten sein" }, { status: 400 });
  }
  if (!body.confirm) {
    return NextResponse.json({ error: "confirm: true erforderlich" }, { status: 400 });
  }

  try {
    const vorschau = await baueVorschau(zielId, quellIds);
    if ("error" in vorschau) return NextResponse.json({ error: vorschau.error }, { status: 404 });

    const zielNameNeu = body.zielName?.trim() || vorschau.ziel.name;

    let artikelUebernommen = 0;
    let artikelZusammengefuehrt = 0;

    await prisma.$transaction(async (tx) => {
      for (const quelleId of quellIds) {
        const zuordnungen = await tx.artikelLieferant.findMany({ where: { lieferantId: quelleId } });

        for (const z of zuordnungen) {
          const zielZuordnung = await tx.artikelLieferant.findUnique({
            where: { artikelId_lieferantId: { artikelId: z.artikelId, lieferantId: zielId } },
          });

          if (zielZuordnung) {
            // Konflikt: Ziel-Zuordnung hat Vorrang, nur fehlende Werte auffüllen.
            await tx.artikelLieferant.update({
              where: { id: zielZuordnung.id },
              data: {
                lieferantenArtNr: isLeer(zielZuordnung.lieferantenArtNr) ? z.lieferantenArtNr : undefined,
                einkaufspreis: zielZuordnung.einkaufspreis === 0 && z.einkaufspreis !== 0 ? z.einkaufspreis : undefined,
                mindestbestellmenge:
                  zielZuordnung.mindestbestellmenge === 0 && z.mindestbestellmenge !== 0 ? z.mindestbestellmenge : undefined,
                bevorzugt: zielZuordnung.bevorzugt || z.bevorzugt,
              },
            });
            await tx.artikelLieferant.delete({ where: { id: z.id } });
            artikelZusammengefuehrt++;
          } else {
            // Kein Konflikt: Zuordnung wird direkt auf den Ziellieferanten umgehängt.
            await tx.artikelLieferant.update({ where: { id: z.id }, data: { lieferantId: zielId } });
            artikelUebernommen++;
          }
        }

        await tx.wareneingang.updateMany({ where: { lieferantId: quelleId }, data: { lieferantId: zielId } });
        await tx.bestellposition.updateMany({ where: { lieferantId: quelleId }, data: { lieferantId: zielId } });
        await tx.ausgabe.updateMany({ where: { lieferantId: quelleId }, data: { lieferantId: zielId } });
        await tx.bestellung.updateMany({ where: { lieferantId: quelleId }, data: { lieferantId: zielId } });
        await tx.eingangsRechnung.updateMany({ where: { lieferantId: quelleId }, data: { lieferantId: zielId } });
        await tx.lieferung.updateMany({ where: { streckenLieferantId: quelleId }, data: { streckenLieferantId: zielId } });
        await tx.retoure.updateMany({ where: { lieferantId: quelleId }, data: { lieferantId: zielId } });
        await tx.einkaufStatus.updateMany({ where: { lieferantId: quelleId }, data: { lieferantId: zielId } });

        await tx.auditLog.create({
          data: {
            entitaet: "Lieferant",
            entitaetId: zielId,
            aktion: "geaendert",
            feld: null,
            alterWert: null,
            neuerWert: null,
            beschreibung: `Lieferant "${vorschau.quellen.find((q) => q.id === quelleId)?.name ?? quelleId}" (#${quelleId}) wurde in "${zielNameNeu}" (#${zielId}) verschmolzen und gelöscht.`,
          },
        });

        await tx.lieferant.delete({ where: { id: quelleId } });
      }

      const stammdatenPatch: Record<string, string | number> = {};
      for (const eintrag of vorschau.stammdatenUebernahme) {
        stammdatenPatch[eintrag.feld] = eintrag.wert;
      }

      await tx.lieferant.update({
        where: { id: zielId },
        data: { ...stammdatenPatch, name: zielNameNeu },
      });
    }, { timeout: 15000 });

    const zielFertig = await ladeLieferantMitDetails(zielId);
    return NextResponse.json({
      ziel: zielFertig,
      quellenGeloescht: vorschau.quellen.map((q) => ({ id: q.id, name: q.name })),
      artikelUebernommen,
      artikelZusammengefuehrt,
    });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Verschmelzung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
