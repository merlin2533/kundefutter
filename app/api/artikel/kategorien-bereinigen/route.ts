import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveKategorie } from "@/lib/auswahllisten";
import { loadKategorieTaxonomie } from "@/lib/artikel-kategorie";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

interface Korrektur {
  id: number;
  name: string;
  artikelnummer: string;
  alt: { kategorie: string; unterkategorie: string | null };
  neu: { kategorie: string; unterkategorie: string | null };
}

/** Findet Artikel, deren `kategorie` nicht (mehr) in der konfigurierten Taxonomie steht — z.B.
 *  aus einem Import vor Einführung von resolveKategorie() (lib/auswahllisten.ts), der die
 *  Kategorie-Spalte ungeprüft übernahm. Solche Artikel zeigen in den Kategorie-/
 *  Unterkategorie-<select>-Feldern der Artikel-Detailseite mangels passender <option>
 *  stillschweigend den jeweils ersten Listeneintrag an und würden diesen beim nächsten
 *  Speichern der Seite überschreiben. */
async function findeKorrekturen(): Promise<Korrektur[]> {
  const { kategorien, unterkategorienByKat } = await loadKategorieTaxonomie();
  const alle = await prisma.artikel.findMany({
    select: { id: true, name: true, artikelnummer: true, kategorie: true, unterkategorie: true },
    take: 20000,
  });

  const korrekturen: Korrektur[] = [];
  for (const a of alle) {
    if (kategorien.includes(a.kategorie)) continue;
    const resolved = resolveKategorie(a.kategorie, a.unterkategorie, kategorien, unterkategorienByKat);
    if (resolved.kategorie === a.kategorie && resolved.unterkategorie === a.unterkategorie) continue;
    korrekturen.push({
      id: a.id,
      name: a.name,
      artikelnummer: a.artikelnummer,
      alt: { kategorie: a.kategorie, unterkategorie: a.unterkategorie },
      neu: { kategorie: resolved.kategorie, unterkategorie: resolved.unterkategorie },
    });
  }
  return korrekturen;
}

/** GET – Vorschau: welche Artikel würden korrigiert, und wie? */
export async function GET() {
  try {
    const korrekturen = await findeKorrekturen();
    return NextResponse.json({ korrekturen: korrekturen.slice(0, 200), anzahl: korrekturen.length });
  } catch (e) {
    Sentry.captureException(e);
    console.error("Kategorien-Bereinigen GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

/** POST – Korrektur ausführen. Body: { confirm: true }
 *  Ändert bewusst NUR kategorie/unterkategorie — chargePflicht bleibt unangetastet, da es auch
 *  manuell je Artikel umgeschaltet werden kann und ein Kategorie-Fix das nicht überschreiben soll. */
export async function POST(req: NextRequest) {
  let body: { confirm?: boolean } = {};
  try { body = await req.json(); } catch (err) {
    Sentry.captureException(err); /* ignore */ }
  if (!body.confirm) {
    return NextResponse.json({ error: "confirm: true erforderlich" }, { status: 400 });
  }

  try {
    const korrekturen = await findeKorrekturen();
    for (const k of korrekturen) {
      await prisma.artikel.update({
        where: { id: k.id },
        data: { kategorie: k.neu.kategorie, unterkategorie: k.neu.unterkategorie },
      });
    }
    return NextResponse.json({ korrigiert: korrekturen.length });
  } catch (e) {
    Sentry.captureException(e);
    console.error("Kategorien-Bereinigen POST error:", e);
    return NextResponse.json({ error: "Bereinigung fehlgeschlagen" }, { status: 500 });
  }
}
