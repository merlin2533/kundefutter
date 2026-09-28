import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// Analog csvQ() in lib/kat-meldung.ts — hier lokal gehalten, da dieses Format nur der
// Chargen-Rückverfolgung dient und nicht mit dem KAT-Meldungs-Export geteilt wird.
function csvQ(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type CsvLieferung = { datum: Date; chargeNr: string | null; menge: number; status: string; kunde: { name: string; firma: string | null } | null; rechnungNr: string | null; lieferungId: number; artikel?: { name: string; einheit?: string } };
type CsvWareneingang = { datum: Date; chargeNr: string | null; menge: number; lieferant: { name: string } | null; wareneingangId: number; artikel: { name: string; einheit: string } };
type CsvEiersortierung = {
  datum: Date; chargeNr: string | null; menge: number; sortierungId: number;
  gueteklasse: string | null; gewichtsklasse: string | null; erzeugercode: string | null;
  anlieferung: { nummer: string; erzeuger: { name: string; firma: string | null } | null } | null;
  artikel: { name: string; einheit: string };
};

// Baut eine einheitliche Rückverfolgungs-Tabelle (Lieferung/Wareneingang/Ei-Sortierung
// gemeinsam, chronologisch) als CSV — dient dem Prüf-/Rückverfolgungs-Nachweis
// (Lebensmittelrecht: welche Charge kam woher, ging wohin). `artikelName`/`artikelEinheit`
// federn ab, dass die Lieferungen-Zeilen im Artikel-Modus kein eigenes `artikel`-Feld tragen
// (der Artikel ist dort bereits durch den Aufrufparameter fix). Status/Einheit sind Pflicht für
// einen belastbaren Rückverfolgungs-Nachweis: ohne Status wirkt eine stornierte Lieferung wie
// ein echter Warenausgang dieser Charge, ohne Einheit sind reine Zahlen bei gemischten Quellen
// (kg vs. Stück) nicht einzuordnen (siehe Opus-Review PR #472).
function buildChargenCsv(
  data: { lieferungen: CsvLieferung[]; wareneingaenge: CsvWareneingang[]; eiersortierungen: CsvEiersortierung[] },
  artikelName?: string,
  artikelEinheit?: string
): string {
  const header = ["Quelle", "Datum", "Charge", "Artikel", "Menge", "Einheit", "Status", "Kunde/Lieferant/Erzeuger", "Referenz"].join(";");
  const rows: { datum: string; csv: string }[] = [];
  for (const l of data.lieferungen) {
    const kunde = l.kunde ? (l.kunde.firma || l.kunde.name) : "";
    const datum = l.datum.toISOString().slice(0, 10);
    rows.push({
      datum,
      csv: ["Lieferung", datum, l.chargeNr ?? "", l.artikel?.name ?? artikelName ?? "", l.menge, l.artikel?.einheit ?? artikelEinheit ?? "", l.status, kunde, l.rechnungNr || `Lieferung #${l.lieferungId}`]
        .map(csvQ)
        .join(";"),
    });
  }
  for (const w of data.wareneingaenge) {
    const datum = w.datum.toISOString().slice(0, 10);
    rows.push({
      datum,
      // Wareneingang hat keinen eigenen Workflow-Status (anders als Lieferung) — die Buchung
      // ist mit dem Anlegen bereits abgeschlossen.
      csv: ["Wareneingang", datum, w.chargeNr ?? "", w.artikel.name, w.menge, w.artikel.einheit, "gebucht", w.lieferant?.name ?? "", `Wareneingang #${w.wareneingangId}`]
        .map(csvQ)
        .join(";"),
    });
  }
  for (const s of data.eiersortierungen) {
    const erzeuger = s.anlieferung?.erzeuger ? (s.anlieferung.erzeuger.firma || s.anlieferung.erzeuger.name) : "";
    const details = [s.gueteklasse, s.gewichtsklasse].filter(Boolean).join("/");
    const referenz = [`Sortierung #${s.sortierungId}`, s.anlieferung?.nummer, s.erzeugercode].filter(Boolean).join(" · ");
    const datum = s.datum.toISOString().slice(0, 10);
    rows.push({
      datum,
      csv: ["Ei-Sortierung", datum, s.chargeNr ?? "", `${s.artikel.name}${details ? ` (${details})` : ""}`, s.menge, s.artikel.einheit, "gebucht", erzeuger, referenz]
        .map(csvQ)
        .join(";"),
    });
  }
  rows.sort((a, b) => a.datum.localeCompare(b.datum));
  return "﻿" + [header, ...rows.map((r) => r.csv)].join("\n");
}

// GET /api/lager/chargen
// Rückverfolgungs-Endpoint mit zwei Modi:
//
//  1) Charge-Modus: ?charge=X
//     Sucht eine Chargennummer (LIKE) in Lieferpositionen UND Wareneingängen.
//
//  2) Artikel-Modus: ?artikelId=N&von=YYYY-MM-DD&bis=YYYY-MM-DD
//     Liefert alle Kunden, die einen Artikel erhalten haben (aggregiert + Lieferpositionen).
//     Optional: zusätzlich ?charge=X um nur Lieferungen mit dieser Charge zu erhalten.
//
// Beide Modi unterstützen zusätzlich ?format=csv für einen Rückverfolgungs-Nachweis als
// CSV-Download (Lieferung/Wareneingang/Ei-Sortierung gemeinsam, chronologisch).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const charge = searchParams.get("charge")?.trim() ?? "";
  const artikelIdRaw = searchParams.get("artikelId");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const format = searchParams.get("format");

  const artikelId = artikelIdRaw ? parseInt(artikelIdRaw, 10) : NaN;
  const hasArtikel = !isNaN(artikelId);
  const hasCharge = charge.length > 0;

  if (!hasArtikel && !hasCharge) {
    return NextResponse.json({ error: "charge oder artikelId Parameter erforderlich" }, { status: 400 });
  }
  if (hasCharge && charge.length < 2) {
    return NextResponse.json({ error: "Mindestens 2 Zeichen für die Chargensuche erforderlich" }, { status: 400 });
  }

  const datumFilter: { gte?: Date; lte?: Date } = {};
  if (von) {
    const d = new Date(von);
    if (!isNaN(d.getTime())) datumFilter.gte = d;
  }
  if (bis) {
    const d = new Date(bis);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      datumFilter.lte = d;
    }
  }
  const hasDatum = datumFilter.gte || datumFilter.lte;

  try {
    if (hasArtikel) {
      // ── Artikel-Rückverfolgung ────────────────────────────────────────────
      const artikel = await prisma.artikel.findUnique({
        where: { id: artikelId },
        select: { id: true, name: true, einheit: true, kategorie: true },
      });
      if (!artikel) {
        return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
      }

      const lieferpositionen = await prisma.lieferposition.findMany({
        where: {
          artikelId,
          ...(hasCharge ? { chargeNr: { contains: charge } } : {}),
          ...(hasDatum ? { lieferung: { datum: datumFilter } } : {}),
        },
        take: 1000,
        orderBy: { id: "desc" },
        include: {
          lieferung: {
            select: {
              id: true,
              datum: true,
              status: true,
              rechnungNr: true,
              kunde: { select: { id: true, name: true, firma: true } },
            },
          },
        },
      });

      const lieferungen = lieferpositionen
        .filter((pos) => pos.lieferung)
        .map((pos) => ({
          lieferpositionId: pos.id,
          chargeNr: pos.chargeNr,
          datum: pos.lieferung.datum,
          lieferungId: pos.lieferung.id,
          status: pos.lieferung.status,
          rechnungNr: pos.lieferung.rechnungNr,
          kunde: pos.lieferung.kunde,
          menge: pos.menge,
        }));

      // Aggregation je Kunde
      const kundenMap = new Map<
        number,
        {
          id: number;
          name: string;
          firma: string | null;
          anzahlLieferungen: number;
          summeMenge: number;
          letzteLieferung: string;
          chargen: Set<string>;
        }
      >();
      for (const l of lieferungen) {
        const k = l.kunde;
        if (!k) continue;
        const entry = kundenMap.get(k.id);
        const datum = typeof l.datum === "string" ? l.datum : l.datum.toISOString();
        if (entry) {
          entry.anzahlLieferungen += 1;
          entry.summeMenge += l.menge;
          if (datum > entry.letzteLieferung) entry.letzteLieferung = datum;
          if (l.chargeNr) entry.chargen.add(l.chargeNr);
        } else {
          kundenMap.set(k.id, {
            id: k.id,
            name: k.name,
            firma: k.firma,
            anzahlLieferungen: 1,
            summeMenge: l.menge,
            letzteLieferung: datum,
            chargen: l.chargeNr ? new Set([l.chargeNr]) : new Set(),
          });
        }
      }
      const kunden = Array.from(kundenMap.values())
        .map((k) => ({ ...k, chargen: Array.from(k.chargen) }))
        .sort((a, b) => b.summeMenge - a.summeMenge);

      // Wareneingänge dieses Artikels (optional gefiltert auf Charge / Datum)
      const wareneingangPos = await prisma.wareineingangPosition.findMany({
        where: {
          artikelId,
          ...(hasCharge ? { chargeNr: { contains: charge } } : {}),
          ...(hasDatum ? { wareneingang: { datum: datumFilter } } : {}),
        },
        take: 500,
        orderBy: { id: "desc" },
        include: {
          wareneingang: {
            select: {
              id: true,
              datum: true,
              lieferant: { select: { id: true, name: true } },
            },
          },
        },
      });

      const wareneingaenge = wareneingangPos
        .filter((p) => p.wareneingang)
        .map((p) => ({
          id: p.id,
          wareneingangId: p.wareneingang.id,
          datum: p.wareneingang.datum,
          menge: p.menge,
          chargeNr: p.chargeNr,
          mhd: p.mhd,
          lieferant: p.wareneingang.lieferant,
          artikel: { id: artikel.id, name: artikel.name, einheit: artikel.einheit },
        }));

      // Ei-Sortierungen dieses Artikels (Erzeugerherkunft, Modul eierhandel) — dieselbe
      // chargeNr-Verknüpfung wie bei Lieferposition/WareineingangPosition, aber ohne
      // Wareneingang: die Charge entsteht hier durch eigene Sortierung/Erzeugung.
      const eiersortierungPos = await prisma.eierSortierungPosition.findMany({
        where: {
          artikelId,
          ...(hasCharge ? { chargeNr: { contains: charge } } : {}),
          ...(hasDatum ? { sortierung: { datum: datumFilter } } : {}),
        },
        take: 500,
        orderBy: { id: "desc" },
        include: {
          sortierung: {
            select: {
              id: true,
              datum: true,
              anlieferung: {
                select: { id: true, nummer: true, kunde: { select: { id: true, name: true, firma: true } } },
              },
            },
          },
        },
      });

      const eiersortierungen = eiersortierungPos.map((p) => ({
        id: p.id,
        sortierungId: p.sortierung.id,
        datum: p.sortierung.datum,
        chargeNr: p.chargeNr,
        menge: p.menge,
        gueteklasse: p.gueteklasse,
        gewichtsklasse: p.gewichtsklasse,
        legedatum: p.legedatum,
        erzeugercode: p.erzeugercode,
        anlieferung: p.sortierung.anlieferung
          ? { id: p.sortierung.anlieferung.id, nummer: p.sortierung.anlieferung.nummer, erzeuger: p.sortierung.anlieferung.kunde }
          : null,
        artikel: { id: artikel.id, name: artikel.name, einheit: artikel.einheit },
      }));

      // Lagerbewegungen nach Charge (aktueller Bestand je Charge)
      const lagerbewByCharge = await prisma.lagerbewegung.findMany({
        where: {
          artikelId,
          chargeNr: { not: null },
          ...(hasCharge ? { chargeNr: { contains: charge } } : {}),
        },
        select: { chargeNr: true, menge: true, typ: true },
        take: 2000,
      });
      const chargeBestand: Record<string, number> = {};
      for (const lb of lagerbewByCharge) {
        if (!lb.chargeNr) continue;
        chargeBestand[lb.chargeNr] = (chargeBestand[lb.chargeNr] ?? 0) + lb.menge;
      }
      const bestandJeCharge = Object.entries(chargeBestand)
        .map(([chargeNr, bestand]) => ({ chargeNr, bestand: Math.round(bestand * 1000) / 1000 }))
        .filter((c) => c.bestand > 0)
        .sort((a, b) => b.bestand - a.bestand);

      if (format === "csv") {
        const csv = buildChargenCsv({ lieferungen, wareneingaenge, eiersortierungen }, artikel.name, artikel.einheit);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="chargen-${artikel.name.replace(/[^a-z0-9]+/gi, "-")}.csv"`,
          },
        });
      }

      return NextResponse.json({
        modus: "artikel",
        artikel,
        kunden,
        lieferungen,
        wareneingaenge,
        eiersortierungen,
        bestandJeCharge,
      });
    }

    // ── Charge-Modus ────────────────────────────────────────────────────────
    const [lieferpositionen, wareneingangPos, lagerbewegungen, eiersortierungPos] = await Promise.all([
      prisma.lieferposition.findMany({
        where: {
          chargeNr: { contains: charge },
          ...(hasDatum ? { lieferung: { datum: datumFilter } } : {}),
        },
        take: 500,
        orderBy: { id: "desc" },
        include: {
          lieferung: {
            select: {
              id: true,
              datum: true,
              status: true,
              rechnungNr: true,
              kunde: { select: { id: true, name: true, firma: true } },
            },
          },
          artikel: { select: { id: true, name: true, einheit: true } },
        },
      }),
      prisma.wareineingangPosition.findMany({
        where: {
          chargeNr: { contains: charge },
          ...(hasDatum ? { wareneingang: { datum: datumFilter } } : {}),
        },
        take: 500,
        orderBy: { id: "desc" },
        include: {
          wareneingang: {
            select: {
              id: true,
              datum: true,
              lieferant: { select: { id: true, name: true } },
            },
          },
          artikel: { select: { id: true, name: true, einheit: true } },
        },
      }),
      prisma.lagerbewegung.findMany({
        where: {
          chargeNr: { contains: charge },
          ...(hasDatum ? { datum: datumFilter } : {}),
        },
        take: 500,
        orderBy: { id: "desc" },
        include: {
          artikel: { select: { id: true, name: true, einheit: true } },
        },
      }),
      prisma.eierSortierungPosition.findMany({
        where: {
          chargeNr: { contains: charge },
          ...(hasDatum ? { sortierung: { datum: datumFilter } } : {}),
        },
        take: 500,
        orderBy: { id: "desc" },
        include: {
          sortierung: {
            select: {
              id: true,
              datum: true,
              anlieferung: {
                select: { id: true, nummer: true, kunde: { select: { id: true, name: true, firma: true } } },
              },
            },
          },
          artikel: { select: { id: true, name: true, einheit: true } },
        },
      }),
    ]);

    const bestandJeCharge = lagerbewegungen.reduce<Record<string, { artikelId: number; artikelName: string; einheit: string; bestand: number }>>((acc, lb) => {
      const key = `${lb.chargeNr}||${lb.artikelId}`;
      if (!acc[key]) acc[key] = { artikelId: lb.artikelId, artikelName: lb.artikel.name, einheit: lb.artikel.einheit, bestand: 0 };
      acc[key].bestand += lb.menge;
      return acc;
    }, {});

    const lieferungen = lieferpositionen
      .filter((pos) => pos.lieferung)
      .map((pos) => ({
        lieferpositionId: pos.id,
        chargeNr: pos.chargeNr,
        datum: pos.lieferung.datum,
        lieferungId: pos.lieferung.id,
        status: pos.lieferung.status,
        rechnungNr: pos.lieferung.rechnungNr,
        kunde: pos.lieferung.kunde,
        artikel: pos.artikel,
        menge: pos.menge,
      }));

    const wareneingaenge = wareneingangPos
      .filter((p) => p.wareneingang)
      .map((p) => ({
        id: p.id,
        wareneingangId: p.wareneingang.id,
        datum: p.wareneingang.datum,
        menge: p.menge,
        chargeNr: p.chargeNr,
        mhd: p.mhd,
        lieferant: p.wareneingang.lieferant,
        artikel: p.artikel,
      }));

    const eiersortierungen = eiersortierungPos.map((p) => ({
      id: p.id,
      sortierungId: p.sortierung.id,
      datum: p.sortierung.datum,
      chargeNr: p.chargeNr,
      menge: p.menge,
      gueteklasse: p.gueteklasse,
      gewichtsklasse: p.gewichtsklasse,
      legedatum: p.legedatum,
      erzeugercode: p.erzeugercode,
      anlieferung: p.sortierung.anlieferung
        ? { id: p.sortierung.anlieferung.id, nummer: p.sortierung.anlieferung.nummer, erzeuger: p.sortierung.anlieferung.kunde }
        : null,
      artikel: p.artikel,
    }));

    if (format === "csv") {
      const csv = buildChargenCsv({ lieferungen, wareneingaenge, eiersortierungen });
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="charge-${charge.replace(/[^a-z0-9]+/gi, "-")}.csv"`,
        },
      });
    }

    return NextResponse.json({
      modus: "charge",
      wareneingaenge,
      lieferungen,
      eiersortierungen,
      bestandJeCharge: Object.entries(bestandJeCharge).map(([key, v]) => ({ ...v, chargeNr: key.split("||")[0] })),
    });
  } catch (e) {
    Sentry.captureException(e);
    const isDev = process.env.NODE_ENV === "development";
    console.error("Chargen GET error:", e);
    const msg = isDev && e instanceof Error ? e.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
