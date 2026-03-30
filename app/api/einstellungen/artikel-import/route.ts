import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STAMMDATEN_GRUPPEN, ALLE_STAMMDATEN_ARTIKEL } from "@/lib/artikel-stammdaten";

/** GET – liefert Vorschau aller Gruppen mit Anzahl und bereits vorhandenen Artikelnummern */
export async function GET() {
  try {
    const vorhandeneNummern = await prisma.artikel.findMany({
      select: { artikelnummer: true },
      take: 5000,
    });
    const vorhandenSet = new Set(vorhandeneNummern.map((a) => a.artikelnummer));

    const gruppen = STAMMDATEN_GRUPPEN.map((g) => ({
      titel: g.titel,
      lieferantName: g.lieferantName,
      gesamt: g.artikel.length,
      neu: g.artikel.filter((a) => !vorhandenSet.has(a.artikelnummer)).length,
      vorhanden: g.artikel.filter((a) => vorhandenSet.has(a.artikelnummer)).length,
    }));

    return NextResponse.json({
      gruppen,
      gesamt: ALLE_STAMMDATEN_ARTIKEL.length,
      neu: ALLE_STAMMDATEN_ARTIKEL.filter((a) => !vorhandenSet.has(a.artikelnummer)).length,
      vorhanden: ALLE_STAMMDATEN_ARTIKEL.filter((a) => vorhandenSet.has(a.artikelnummer)).length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

/** POST – importiert alle (oder eine gefilterte Gruppe) Artikel als upsert */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const gruppenTitel: string | undefined = body.gruppenTitel;

    const zuImportieren = gruppenTitel
      ? ALLE_STAMMDATEN_ARTIKEL.filter((a) => {
          const gruppe = STAMMDATEN_GRUPPEN.find((g) => g.titel === gruppenTitel);
          return gruppe?.artikel.some((ga) => ga.artikelnummer === a.artikelnummer);
        })
      : ALLE_STAMMDATEN_ARTIKEL;

    // Lieferanten sicherstellen (upsert by name)
    const lieferantNamen = [...new Set(zuImportieren.map((a) => a.lieferantName))];
    const lieferantMap = new Map<string, number>();

    for (const name of lieferantNamen) {
      const gruppe = STAMMDATEN_GRUPPEN.find((g) => g.lieferantName === name);
      if (!gruppe) continue;
      const info = gruppe.lieferantInfo;

      const bestehend = await prisma.lieferant.findFirst({ where: { name } });
      if (bestehend) {
        lieferantMap.set(name, bestehend.id);
      } else {
        const neu = await prisma.lieferant.create({
          data: {
            name,
            ansprechpartner: info.ansprechpartner || null,
            email: info.email || null,
            telefon: info.telefon || null,
            strasse: info.strasse || null,
            plz: info.plz || null,
            ort: info.ort || null,
            notizen: info.notizen || null,
          },
        });
        lieferantMap.set(name, neu.id);
      }
    }

    let importiert = 0;
    let uebersprungen = 0;

    for (const a of zuImportieren) {
      const lieferantId = lieferantMap.get(a.lieferantName);
      if (!lieferantId) continue;

      const bestehend = await prisma.artikel.findUnique({
        where: { artikelnummer: a.artikelnummer },
        select: { id: true },
      });

      if (bestehend) {
        uebersprungen++;
        continue;
      }

      await prisma.artikel.create({
        data: {
          artikelnummer: a.artikelnummer,
          name: a.name,
          kategorie: a.kategorie,
          einheit: a.einheit,
          standardpreis: a.standardpreis,
          mwstSatz: a.mwstSatz,
          mindestbestand: a.mindestbestand,
          aktuellerBestand: 0,
          beschreibung: a.beschreibung ?? null,
          lieferanten: {
            create: [{
              lieferantId,
              lieferantenArtNr: a.artikelnummer,
              einkaufspreis: a.einkaufspreis,
              mindestbestellmenge: 1,
              lieferzeitTage: 7,
              bevorzugt: true,
            }],
          },
        },
      });
      importiert++;
    }

    return NextResponse.json({ importiert, uebersprungen });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Import fehlgeschlagen" }, { status: 500 });
  }
}
