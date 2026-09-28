import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { naechsteGutschriftsnummer } from "@/lib/utils";
import { loescheGutschriftMitNebenwirkungen } from "@/lib/gutschrift";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type GradierteMenge = {
  artikelId: number;
  artikelName: string;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  vorschlagPreis: number | null;
};

// Aggregiert die Sortier-Positionen aller mit dieser Anlieferung verknüpften EierSortierung(en)
// je Artikel (Güte-/Gewichtsklasse steckt bereits im gewählten Artikel — EI-A-M vs. EI-B-M sind
// unterschiedliche Artikel). Leeres Array = keine Sortierung verknüpft → Aufrufer nutzt den
// bisherigen einfachen Modus (Anlieferung.menge × preisProEinheit).
async function ladeGradierteMengen(anlieferungId: number) {
  const positionen = await prisma.eierSortierungPosition.findMany({
    where: { sortierung: { anlieferungId } },
    select: {
      artikelId: true,
      gueteklasse: true,
      gewichtsklasse: true,
      menge: true,
      artikel: { select: { name: true } },
    },
  });
  const map = new Map<number, GradierteMenge>();
  for (const p of positionen) {
    const existing = map.get(p.artikelId);
    if (existing) {
      existing.menge += p.menge;
    } else {
      map.set(p.artikelId, {
        artikelId: p.artikelId,
        artikelName: p.artikel.name,
        gueteklasse: p.gueteklasse,
        gewichtsklasse: p.gewichtsklasse,
        menge: p.menge,
        vorschlagPreis: null,
      });
    }
  }
  return map;
}

// Vorschlagspreis je Artikel = letzter tatsächlich gezahlter Preis (jüngste GutschriftPosition
// mit grund "Erzeugerabrechnung" für diesen Kunden+Artikel) — deckt Preisunterschiede nach
// Haltungsform (z.B. Bio vs. Boden) ab, ohne ein eigenes Preis-Stammdatenmodell einzuführen.
async function ladeVorschlagPreise(kundeId: number, artikelIds: number[]) {
  const ergebnis = new Map<number, number>();
  await Promise.all(
    artikelIds.map(async (artikelId) => {
      const letzte = await prisma.gutschriftPosition.findFirst({
        where: { artikelId, gutschrift: { grund: "Erzeugerabrechnung", kundeId } },
        orderBy: { gutschrift: { datum: "desc" } },
        select: { preis: true },
      });
      if (letzte) ergebnis.set(artikelId, letzte.preis);
    })
  );
  return ergebnis;
}

// GET: Vorschau — gradierte Mengen aus verknüpften Sortierungen inkl. Preisvorschlag, sowie die
// bereits bestehende Gutschrift (falls vorhanden) zum Vorbefüllen des "aktualisieren"-Formulars.
export async function GET(_req: NextRequest, ctx: Params) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "erzeugerabrechnung");
  if (denyModul) return denyModul;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const anlieferung = await prisma.anlieferung.findUnique({
      where: { id },
      include: {
        artikel: { select: { id: true, name: true } },
        kunde: { select: { id: true, name: true } },
        gutschrift: {
          include: { positionen: { include: { artikel: { select: { id: true, name: true } } } } },
        },
      },
    });
    if (!anlieferung) return NextResponse.json({ error: "Anlieferung nicht gefunden" }, { status: 404 });

    const gradiertMap = await ladeGradierteMengen(id);
    const artikelIds = [...gradiertMap.keys()];
    const preise = await ladeVorschlagPreise(anlieferung.kundeId, artikelIds);
    const gradiert = artikelIds.map((aid) => {
      const g = gradiertMap.get(aid)!;
      return { ...g, vorschlagPreis: preise.get(aid) ?? null };
    });

    return NextResponse.json({ anlieferung, gradiert });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

// POST: Erstelle bzw. aktualisiere die Gutschrift aus der Anlieferung. Hat die Anlieferung
// verknüpfte EierSortierung(en), werden die Positionen aus deren gradierten Mengen gebildet
// (Preis je Artikel aus body.preise, Pflichtangabe für JEDEN betroffenen Artikel — alles oder
// nichts, siehe unten); ohne verknüpfte Sortierung bleibt der bisherige einfache Modus
// (Anlieferung.menge × preisProEinheit) unverändert erhalten.
export async function POST(req: NextRequest, ctx: Params) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "erzeugerabrechnung");
  if (denyModul) return denyModul;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body: { preise?: Record<string, number> } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  try {
    const anlieferung = await prisma.anlieferung.findUnique({
      where: { id },
      include: {
        artikel: { select: { id: true, name: true } },
        kunde: { select: { id: true, name: true } },
      },
    });
    if (!anlieferung) return NextResponse.json({ error: "Anlieferung nicht gefunden" }, { status: 404 });

    const gradiertMap = await ladeGradierteMengen(id);
    const gradierteEintraege = [...gradiertMap.values()];
    const gradiertModus = gradierteEintraege.length > 0;

    // Positionen bestimmen
    let positionenNeu: { artikelId: number; menge: number; preis: number }[];
    let notiz: string;
    if (gradiertModus) {
      const preise = body.preise ?? {};
      const fehlend: string[] = [];
      positionenNeu = [];
      for (const eintrag of gradierteEintraege) {
        const preisRoh = preise[String(eintrag.artikelId)];
        const preis = typeof preisRoh === "number" ? preisRoh : Number(preisRoh);
        if (!Number.isFinite(preis) || preis <= 0) {
          fehlend.push(`${eintrag.artikelName} (Güte ${eintrag.gueteklasse}/${eintrag.gewichtsklasse})`);
          continue;
        }
        positionenNeu.push({ artikelId: eintrag.artikelId, menge: eintrag.menge, preis });
      }
      if (fehlend.length > 0) {
        return NextResponse.json(
          { error: `Kein gültiger Preis hinterlegt für: ${fehlend.join(", ")}` },
          { status: 400 }
        );
      }
      const zeilen = gradierteEintraege
        .map((e) => `${e.menge} ${anlieferung.einheit} ${e.artikelName} (${e.gueteklasse}/${e.gewichtsklasse})`)
        .join(", ");
      notiz = `Anlieferung ${anlieferung.nummer} — Erzeugerabrechnung aus Sortierergebnis: ${zeilen}`;
    } else {
      if (!anlieferung.preisProEinheit) {
        return NextResponse.json({ error: "Kein Preis hinterlegt — bitte zuerst Preis erfassen" }, { status: 400 });
      }
      positionenNeu = [{ artikelId: anlieferung.artikelId, menge: anlieferung.menge, preis: anlieferung.preisProEinheit }];
      notiz = `Anlieferung ${anlieferung.nummer}: ${anlieferung.menge} ${anlieferung.einheit} ${anlieferung.artikel.name}${anlieferung.qualitaet ? ` (${anlieferung.qualitaet})` : ""}`;
    }

    const betrag = Math.round(positionenNeu.reduce((sum, p) => sum + p.menge * p.preis, 0) * 100) / 100;

    // Update-Modus: bereits verknüpfte Gutschrift vorhanden
    if (anlieferung.gutschriftId) {
      const bestehende = await prisma.gutschrift.findUnique({ where: { id: anlieferung.gutschriftId } });
      if (!bestehende) {
        return NextResponse.json({ error: "Verknüpfte Gutschrift nicht gefunden" }, { status: 404 });
      }
      if (bestehende.status !== "OFFEN") {
        return NextResponse.json(
          { error: "Diese Gutschrift ist nicht mehr offen (bereits verbucht/storniert) — manuelle Prüfung nötig" },
          { status: 409 }
        );
      }

      const gutschrift = await prisma.$transaction(async (tx) => {
        await tx.gutschriftPosition.deleteMany({ where: { gutschriftId: bestehende.id } });
        const gs = await tx.gutschrift.update({
          where: { id: bestehende.id },
          data: {
            notiz,
            positionen: { create: positionenNeu },
          },
        });
        await tx.anlieferung.update({ where: { id }, data: { gesamtBetrag: betrag } });
        return gs;
      });

      return NextResponse.json({ gutschrift }, { status: 200 });
    }

    // Create-Modus — Nummernvergabe über den zentralen Zähler (system.letzteGutschriftNr) wie
    // jede andere Gutschrift, inkl. Selbstheilung gegen Altbestand mit veraltetem lokalen Zähler.
    const gutschrift = await prisma.$transaction(async (tx) => {
      const einstellung = await tx.einstellung.findUnique({ where: { key: "system.letzteGutschriftNr" } });
      let nummer = naechsteGutschriftsnummer(einstellung?.value ?? null);
      while (await tx.gutschrift.findUnique({ where: { nummer }, select: { id: true } })) {
        nummer = naechsteGutschriftsnummer(nummer);
      }
      await tx.einstellung.upsert({
        where: { key: "system.letzteGutschriftNr" },
        update: { value: nummer },
        create: { key: "system.letzteGutschriftNr", value: nummer },
      });

      const gs = await tx.gutschrift.create({
        data: {
          nummer,
          kundeId: anlieferung.kundeId,
          datum: new Date(),
          grund: "Erzeugerabrechnung",
          notiz,
          status: "OFFEN",
          positionen: { create: positionenNeu },
        },
      });

      await tx.anlieferung.update({
        where: { id },
        data: { gutschriftId: gs.id, gesamtBetrag: betrag },
      });

      return gs;
    });

    return NextResponse.json({ gutschrift }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

// DELETE: Erzeuger-Gutschrift von der Anlieferung lösen und (falls noch OFFEN) vollständig
// entfernen — genutzt, wenn die letzte verknüpfte EierSortierung gelöscht wurde und die
// Gutschrift dadurch leer würde (kein leerer Beleg soll stehen bleiben). Eine bereits VERBUCHTE/
// STORNIERTE/ERSTATTETE Gutschrift wird NICHT automatisch entfernt (409) — dort ist manuelle
// Prüfung nötig, analog zum Update-Pfad oben.
export async function DELETE(_req: NextRequest, ctx: Params) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "erzeugerabrechnung");
  if (denyModul) return denyModul;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const anlieferung = await prisma.anlieferung.findUnique({ where: { id }, select: { gutschriftId: true } });
    if (!anlieferung) return NextResponse.json({ error: "Anlieferung nicht gefunden" }, { status: 404 });
    if (!anlieferung.gutschriftId) {
      return NextResponse.json({ error: "Keine Gutschrift verknüpft" }, { status: 404 });
    }

    const bestehende = await prisma.gutschrift.findUnique({ where: { id: anlieferung.gutschriftId } });
    if (bestehende && bestehende.status !== "OFFEN") {
      return NextResponse.json(
        { error: "Diese Gutschrift ist nicht mehr offen (bereits verbucht/storniert) — manuelle Prüfung nötig" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (bestehende) await loescheGutschriftMitNebenwirkungen(tx, bestehende.id);
      await tx.anlieferung.update({ where: { id }, data: { gutschriftId: null, gesamtBetrag: null } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
