import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liefposArtikelSelect, artikelSafeSelect } from "@/lib/artikel-select";
import * as XLSX from "xlsx";
import { berechneMarge, formatDatum } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typ = searchParams.get("typ"); // kunden | artikel | lieferanten | lieferhistorie | lager | bewegungen | margen
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const kundeId = searchParams.get("kundeId");

  let rows: Record<string, unknown>[] = [];
  let sheetName = "Export";

  if (typ === "kunden") {
    sheetName = "Kunden";
    const kunden = await prisma.kunde.findMany({
      include: { kontakte: true },
      orderBy: { name: "asc" },
    });
    rows = kunden.map((k) => ({
      ID: k.id,
      Name: k.name,
      Firma: k.firma ?? "",
      Kategorie: k.kategorie,
      Straße: k.strasse ?? "",
      PLZ: k.plz ?? "",
      Ort: k.ort ?? "",
      Land: k.land,
      Telefon: k.kontakte.filter((c) => c.typ === "telefon").map((c) => c.wert).join("; "),
      Mobil: k.kontakte.filter((c) => c.typ === "mobil").map((c) => c.wert).join("; "),
      Email: k.kontakte.filter((c) => c.typ === "email").map((c) => c.wert).join("; "),
      Notizen: k.notizen ?? "",
      Aktiv: k.aktiv ? "Ja" : "Nein",
    }));
  }

  if (typ === "artikel") {
    sheetName = "Artikel";
    const artikel = await prisma.artikel.findMany({
      include: { lieferanten: { include: { lieferant: true }, where: { bevorzugt: true } } },
      orderBy: { name: "asc" },
    });
    rows = artikel.map((a) => {
      const l = a.lieferanten[0];
      const { margeProzent } = berechneMarge(a.standardpreis, l?.einkaufspreis ?? 0);
      return {
        Artikelnummer: a.artikelnummer,
        Name: a.name,
        Kategorie: a.kategorie,
        Einheit: a.einheit,
        Standardpreis: a.standardpreis,
        Einkaufspreis: l?.einkaufspreis ?? "",
        "Marge %": l ? margeProzent : "",
        Lagerbestand: a.aktuellerBestand,
        Mindestbestand: a.mindestbestand,
        "Bevorzugter Lieferant": l?.lieferant.name ?? "",
        Aktiv: a.aktiv ? "Ja" : "Nein",
      };
    });
  }

  if (typ === "lieferanten") {
    sheetName = "Lieferanten";
    const ls = await prisma.lieferant.findMany({ orderBy: { name: "asc" } });
    rows = ls.map((l) => ({
      ID: l.id,
      Name: l.name,
      Ansprechpartner: l.ansprechpartner ?? "",
      Email: l.email ?? "",
      Telefon: l.telefon ?? "",
      Straße: l.strasse ?? "",
      PLZ: l.plz ?? "",
      Ort: l.ort ?? "",
      Notizen: l.notizen ?? "",
    }));
  }

  if (typ === "lieferhistorie") {
    sheetName = "Lieferhistorie";
    const where: Record<string, unknown> = { status: "geliefert" };
    if (kundeId) where.kundeId = Number(kundeId);
    if (von || bis) where.datum = { ...(von && { gte: new Date(von) }), ...(bis && { lte: new Date(bis) }) };

    const lieferungen = await prisma.lieferung.findMany({
      where,
      include: { kunde: true, positionen: { include: { artikel: { select: liefposArtikelSelect } } } },
      orderBy: { datum: "desc" },
    });

    for (const l of lieferungen) {
      for (const p of l.positionen) {
        const { margeEuro, margeProzent } = berechneMarge(p.verkaufspreis, p.einkaufspreis);
        rows.push({
          Datum: formatDatum(l.datum),
          Kunde: l.kunde.name,
          Artikel: p.artikel.name,
          Artikelnummer: p.artikel.artikelnummer,
          Menge: p.menge,
          Einheit: p.artikel.einheit,
          Verkaufspreis: p.verkaufspreis,
          Einkaufspreis: p.einkaufspreis,
          "Marge €": margeEuro,
          "Marge %": margeProzent,
          Umsatz: Math.round(p.menge * p.verkaufspreis * 100) / 100,
          Rechnungsnummer: l.rechnungNr ?? "",
        });
      }
    }
  }

  if (typ === "lager") {
    sheetName = "Lagerübersicht";
    const artikel = await prisma.artikel.findMany({
      where: { aktiv: true },
      orderBy: { name: "asc" },
    });
    rows = artikel.map((a) => ({
      Artikelnummer: a.artikelnummer,
      Name: a.name,
      Kategorie: a.kategorie,
      Einheit: a.einheit,
      Bestand: a.aktuellerBestand,
      Mindestbestand: a.mindestbestand,
      Status:
        a.aktuellerBestand <= 0
          ? "ROT - leer"
          : a.aktuellerBestand <= a.mindestbestand
          ? "GELB - unter Mindestbestand"
          : "GRUEN - ok",
    }));
  }

  if (typ === "bewegungen") {
    sheetName = "Lagerbewegungen";
    const where: Record<string, unknown> = {};
    if (von || bis) where.datum = { ...(von && { gte: new Date(von) }), ...(bis && { lte: new Date(bis) }) };

    const bewegungen = await prisma.lagerbewegung.findMany({
      where,
      include: { artikel: { select: liefposArtikelSelect } },
      orderBy: { datum: "desc" },
    });
    rows = bewegungen.map((b) => ({
      Datum: formatDatum(b.datum),
      Artikel: b.artikel.name,
      Artikelnummer: b.artikel.artikelnummer,
      Typ: b.typ,
      Menge: b.menge,
      "Bestand danach": b.bestandNach,
      Notiz: b.notiz ?? "",
    }));
  }

  if (typ === "margen") {
    sheetName = "Margen";
    const where: Record<string, unknown> = { status: "geliefert" };
    if (von || bis) where.datum = { ...(von && { gte: new Date(von) }), ...(bis && { lte: new Date(bis) }) };

    const lieferungen = await prisma.lieferung.findMany({
      where,
      include: { kunde: true, positionen: { include: { artikel: { select: liefposArtikelSelect } } } },
    });

    const kundenMargen: Record<string, { name: string; umsatz: number; einkauf: number; marge: number }> = {};

    for (const l of lieferungen) {
      if (!kundenMargen[l.kundeId]) {
        kundenMargen[l.kundeId] = { name: l.kunde.name, umsatz: 0, einkauf: 0, marge: 0 };
      }
      for (const p of l.positionen) {
        const umsatz = p.menge * p.verkaufspreis;
        const einkauf = p.menge * p.einkaufspreis;
        kundenMargen[l.kundeId].umsatz += umsatz;
        kundenMargen[l.kundeId].einkauf += einkauf;
        kundenMargen[l.kundeId].marge += umsatz - einkauf;
      }
    }

    rows = Object.values(kundenMargen).map((k) => ({
      Kunde: k.name,
      Umsatz: Math.round(k.umsatz * 100) / 100,
      Einkauf: Math.round(k.einkauf * 100) / 100,
      "Deckungsbeitrag €": Math.round(k.marge * 100) / 100,
      "Deckungsbeitrag %": k.umsatz > 0 ? Math.round((k.marge / k.umsatz) * 1000) / 10 : 0,
    }));
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${typ}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
