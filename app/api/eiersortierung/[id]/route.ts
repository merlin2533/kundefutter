import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { istLagerrelevant } from "@/lib/utils";
import { loescheGutschriftMitNebenwirkungen } from "@/lib/gutschrift";
import { istGradierteErzeugerabrechnung } from "@/lib/anlieferung";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
import {
  EierSortierungValidierungsFehler,
  validiereEierSortierungPositionen,
  aktualisiereEierSortierung,
  parsePositionenInput,
} from "@/lib/eiersortierung";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/eiersortierung/[id]
export async function GET(_req: NextRequest, ctx: Params) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { id } = await ctx.params;
    const sortierungId = parseInt(id, 10);
    if (isNaN(sortierungId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    const sortierung = await prisma.eierSortierung.findUnique({
      where: { id: sortierungId },
      include: {
        anlieferung: { select: { id: true, nummer: true, kunde: { select: { id: true, name: true, firma: true, erzeugercode: true, haltungsform: true } } } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });
    if (!sortierung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(sortierung);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// PUT /api/eiersortierung/[id] — ersetzt Datum, Notiz und Positionen; der Lagerbestand wird per
// Differenzbuchung abgeglichen (siehe aktualisiereEierSortierung()). Die Anlieferung bleibt gleich.
export async function PUT(req: NextRequest, ctx: Params) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;
    const permUser = await getCurrentUser();
    const denyPerm = requirePermission(permUser, P.EIER_SORTIERUNG_ERSTELLEN);
    if (denyPerm) return denyPerm;

    const { id } = await ctx.params;
    const sortierungId = parseInt(id, 10);
    if (isNaN(sortierungId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    let body;
    try {
      body = await req.json();
    } catch (err) {
      Sentry.captureException(err);
      return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
    }
    if (!Array.isArray(body.positionen) || body.positionen.length === 0) {
      return NextResponse.json({ error: "positionen erforderlich" }, { status: 400 });
    }
    let datum = new Date();
    if (body.datum) {
      datum = new Date(body.datum);
      if (isNaN(datum.getTime())) return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
    }

    const positionen = parsePositionenInput(body.positionen);
    validiereEierSortierungPositionen(positionen);

    const ergebnis = await prisma.$transaction((tx) =>
      aktualisiereEierSortierung(tx, sortierungId, {
        datum,
        notiz: typeof body.notiz === "string" && body.notiz.trim() ? body.notiz.trim() : null,
        positionen,
      }),
    );
    return NextResponse.json(ergebnis);
  } catch (err) {
    if (err instanceof EierSortierungValidierungsFehler) {
      return NextResponse.json({ error: err.message }, { status: err.message === "Sortierung nicht gefunden" ? 404 : 400 });
    }
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Speichern der Ei-Sortierung" }, { status: 500 });
  }
}

// DELETE /api/eiersortierung/[id] — bucht den Lagerzugang je Position zurück (Lagerbewegung
// "ausgang"), bevor der Datensatz (inkl. Positionen, onDelete: Cascade) gelöscht wird.
export async function DELETE(_req: NextRequest, ctx: Params) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;
    const permUser = await getCurrentUser();
    const denyPerm = requirePermission(permUser, P.EIER_SORTIERUNG_LOESCHEN);
    if (denyPerm) return denyPerm;

    const { id } = await ctx.params;
    const sortierungId = parseInt(id, 10);
    if (isNaN(sortierungId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    const gefunden = await prisma.$transaction(async (tx) => {
      const sortierung = await tx.eierSortierung.findUnique({
        where: { id: sortierungId },
        include: { positionen: true },
      });
      if (!sortierung) return false;

      const artikelIds = [...new Set(sortierung.positionen.map((p) => p.artikelId))];
      const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
      const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

      for (const pos of sortierung.positionen) {
        const artikel = artikelMap.get(pos.artikelId);
        if (!artikel || !istLagerrelevant(artikel.kategorie, artikel.lagerTracking)) continue;
        const neuerBestand = artikel.aktuellerBestand - pos.menge;
        artikel.aktuellerBestand = neuerBestand;
        await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
        await tx.lagerbewegung.create({
          data: {
            artikelId: pos.artikelId,
            typ: "ausgang",
            menge: -pos.menge,
            bestandNach: neuerBestand,
            chargeNr: pos.chargeNr,
            notiz: `Ei-Sortierung #${sortierung.id} gelöscht — Lagerzugang zurückgebucht`,
          },
        });
      }

      const anlieferungId = sortierung.anlieferungId;
      await tx.eierSortierung.delete({ where: { id: sortierungId } });

      // Wurde damit die letzte Sortierung dieser Anlieferung gelöscht, wird eine daraus (im
      // gradierten Modus) erstellte, noch OFFENE Erzeuger-Gutschrift leer und hätte keine
      // Grundlage mehr — statt als leerer Beleg stehen zu bleiben, wird sie mit entfernt (analog
      // dem Lösch-Endpunkt auf .../gutschrift). Eine bereits VERBUCHTE/STORNIERTE/ERSTATTETE
      // Gutschrift bleibt unangetastet (manuelle Prüfung nötig) — GENAUSO eine im EINFACHEN Modus
      // (Anlieferung.menge × preisProEinheit) erstellte Gutschrift: die kann unabhängig von jeder
      // Sortierung existieren (z.B. schon vor der ersten Sortierung angelegt) und würde sonst
      // durch reinen Zufall — weil ihre Anlieferung zufällig gerade keine Sortierungen mehr hat —
      // mitgelöscht, obwohl sie mit dieser Sortierung inhaltlich gar nichts zu tun hat.
      // istGradierteErzeugerabrechnung() erkennt das am Notiz-Marker, den nur der gradierte Modus
      // setzt (siehe lib/anlieferung.ts).
      if (anlieferungId) {
        const verbleibend = await tx.eierSortierungPosition.count({
          where: { sortierung: { anlieferungId } },
        });
        if (verbleibend === 0) {
          const anlieferung = await tx.anlieferung.findUnique({
            where: { id: anlieferungId },
            select: { gutschriftId: true },
          });
          if (anlieferung?.gutschriftId) {
            const gs = await tx.gutschrift.findUnique({ where: { id: anlieferung.gutschriftId } });
            if (gs && gs.status === "OFFEN" && istGradierteErzeugerabrechnung(gs.notiz)) {
              await loescheGutschriftMitNebenwirkungen(tx, gs.id);
              await tx.anlieferung.update({
                where: { id: anlieferungId },
                data: { gutschriftId: null, gesamtBetrag: null },
              });
            }
          }
        }
      }

      return true;
    });

    if (!gefunden) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
