import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STAMMDATEN_GRUPPEN, ALLE_STAMMDATEN_ARTIKEL } from "@/lib/artikel-stammdaten";
import { ARTIKEL_ALIAS, parseNumber, pickCol } from "@/lib/import-utils";
import * as XLSX from "xlsx";

/** GET ?action=template            → Excel-Datei mit allen Stammdaten zum Download
 *  GET ?action=sync-inhaltsstoffe  → Inhaltsstoffe aus Stammdaten auf vorhandene Artikel übertragen
 *  GET (kein action)               → JSON-Statusübersicht */
export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action");

  // ── Inhaltsstoffe synchronisieren ─────────────────────────────────────────
  if (action === "sync-inhaltsstoffe") {
    try {
      // Alle Stammdaten-Artikel MIT definierten Inhaltsstoffen
      const stammdatenMitInhaltsstoffen = ALLE_STAMMDATEN_ARTIKEL.filter(
        (a) => a.inhaltsstoffe && a.inhaltsstoffe.length > 0,
      );
      const nummern = stammdatenMitInhaltsstoffen.map((a) => a.artikelnummer);

      // Vorhandene Artikel in DB prüfen — nur die ohne Inhaltsstoffe
      const dbArtikel = await prisma.artikel.findMany({
        where: { artikelnummer: { in: nummern } },
        select: {
          id: true,
          artikelnummer: true,
          _count: { select: { inhaltsstoffe: true } },
        },
      });

      let synced = 0;
      let uebersprungen = 0;

      for (const dbA of dbArtikel) {
        if (dbA._count.inhaltsstoffe > 0) {
          uebersprungen++;
          continue;
        }
        const stammdaten = stammdatenMitInhaltsstoffen.find(
          (a) => a.artikelnummer === dbA.artikelnummer,
        );
        if (!stammdaten?.inhaltsstoffe?.length) continue;

        await prisma.artikelInhaltsstoff.createMany({
          data: stammdaten.inhaltsstoffe.map((i) => ({
            artikelId: dbA.id,
            name: i.name,
            menge: i.menge ?? null,
            einheit: i.einheit ?? null,
          })),
        });
        synced++;
      }

      return NextResponse.json({
        synced,
        uebersprungen,
        gesamt: stammdatenMitInhaltsstoffen.length,
        inDb: dbArtikel.length,
      });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Synchronisation fehlgeschlagen" }, { status: 500 });
    }
  }


  // ── Template-Download ──────────────────────────────────────────────────────
  if (action === "template") {
    const rows = ALLE_STAMMDATEN_ARTIKEL.map((a) => ({
      Artikelnummer: a.artikelnummer,
      Name: a.name,
      Kategorie: a.kategorie,
      Unterkategorie: "",
      Einheit: a.einheit,
      "VK (Standardpreis)": a.standardpreis,
      "EK (Einkaufspreis)": a.einkaufspreis,
      "MwSt %": a.mwstSatz,
      Mindestbestand: a.mindestbestand,
      "Verpackungsgröße": "",
      Beschreibung: a.beschreibung ?? "",
      Lieferant: a.lieferantName,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Spaltenbreiten
    ws["!cols"] = [
      { wch: 20 }, // Artikelnummer
      { wch: 60 }, // Name
      { wch: 18 }, // Kategorie
      { wch: 18 }, // Unterkategorie
      { wch: 10 }, // Einheit
      { wch: 16 }, // VK
      { wch: 16 }, // EK
      { wch: 8  }, // MwSt
      { wch: 14 }, // Mindestbestand
      { wch: 22 }, // Verpackungsgröße
      { wch: 40 }, // Beschreibung
      { wch: 30 }, // Lieferant
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Artikel");

    // Hinweis-Sheet mit Spalten-Erklärung
    const hinweise = [
      { Spalte: "Artikelnummer", Pflicht: "Nein", Hinweis: "Eindeutige Artikelnummer. Leer = automatisch vergeben. Bestehende Nummern werden übersprungen. Alternativen: Nummer, ArtNr, SKU" },
      { Spalte: "Name",          Pflicht: "Ja", Hinweis: "Artikelbezeichnung. Alternativen: Produktname, Artikel, Bezeichnung" },
      { Spalte: "Kategorie",     Pflicht: "Nein", Hinweis: "z.B. Futter, Duenger, Saatgut, Analysen. Standard: Sonstiges. Alternativen: Artikelkategorie, Produktkategorie, Produktgruppe, Warengruppe, Gruppe" },
      { Spalte: "Unterkategorie", Pflicht: "Nein", Hinweis: "Optionale Subkategorie, z.B. bei Saatgut: Mais, Raps, Getreide, Gräser, Zwischenfrüchte, Leguminosen, Sonnenblumen, Sorghum. Alternativen: Subkategorie, Kultur, Fruchtart" },
      { Spalte: "Einheit",       Pflicht: "Nein", Hinweis: "kg, t, dt, Sack, Stück, Liter, km, … Standard: Stück. Alternativen: Mengeneinheit, ME" },
      { Spalte: "VK (Standardpreis)", Pflicht: "Ja", Hinweis: "Verkaufspreis (Zahl). Alternativen: Standardpreis, Verkaufspreis, VK-Preis, VKP, VK, Listenpreis, Stückpreis, Nettopreis, Preis" },
      { Spalte: "EK (Einkaufspreis)", Pflicht: "Nein", Hinweis: "Einkaufspreis netto (Zahl, leer = 0). Alternativen: Einkaufspreis, EK-Preis, EK, Einstandspreis" },
      { Spalte: "MwSt %",        Pflicht: "Nein", Hinweis: "0, 7 oder 19 (Standard: 19). Alternativen: MwSt, MwSt-Satz, Mehrwertsteuer, USt" },
      { Spalte: "Mindestbestand", Pflicht: "Nein", Hinweis: "Meldebestand (Zahl, Standard: 0). Alternativen: Meldebestand, Min-Bestand" },
      { Spalte: "Verpackungsgröße", Pflicht: "Nein", Hinweis: "Freitext, z.B. \"25 kg Sack\" oder \"Big Bag 600 kg\". Alternativen: Verpackung, Liefergröße, Gebinde" },
      { Spalte: "Beschreibung",  Pflicht: "Nein", Hinweis: "Freitext. Alternativen: Bemerkung, Notiz" },
      { Spalte: "Lieferant",     Pflicht: "Nein", Hinweis: "Name des Lieferanten – wird automatisch angelegt falls nicht vorhanden. Alternativen: Lieferantenname, Hersteller" },
    ];
    const wsInfo = XLSX.utils.json_to_sheet(hinweise);
    wsInfo["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, "Hinweise");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="artikel-stammdaten.xlsx"',
      },
    });
  }

  // ── Status-Übersicht ───────────────────────────────────────────────────────
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

// ── Hilfsfunktion: Lieferant per Name anlegen/finden ─────────────────────────
async function lieferantIdFuerName(name: string): Promise<number> {
  const bestehend = await prisma.lieferant.findFirst({ where: { name } });
  if (bestehend) return bestehend.id;
  // Lieferant aus Stammdaten nachschlagen für vollständige Adresse
  const gruppe = STAMMDATEN_GRUPPEN.find((g) => g.lieferantName === name);
  const info = gruppe?.lieferantInfo;
  const neu = await prisma.lieferant.create({
    data: {
      name,
      ansprechpartner: info?.ansprechpartner || null,
      email: info?.email || null,
      telefon: info?.telefon || null,
      strasse: info?.strasse || null,
      plz: info?.plz || null,
      ort: info?.ort || null,
      notizen: info?.notizen || null,
    },
  });
  return neu.id;
}

// ── Hilfsfunktion: Artikelnummer automatisch vergeben ────────────────────────
async function naechsteArtikelnummer(): Promise<string> {
  const nummernkreisRaw = await prisma.einstellung.findUnique({
    where: { key: "artikel.nummernkreis" },
  });
  const nk = nummernkreisRaw?.value
    ? (() => { try { return JSON.parse(nummernkreisRaw.value); } catch { return null; } })()
    : null;
  const prefix = nk?.prefix ?? "ART-";
  const laenge = Number(nk?.laenge) || 5;
  const naechste = Number(nk?.naechste) || 1;
  const nummer = `${prefix}${String(naechste).padStart(laenge, "0")}`;
  await prisma.einstellung.upsert({
    where: { key: "artikel.nummernkreis" },
    update: { value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
    create: { key: "artikel.nummernkreis", value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
  });
  return nummer;
}

// ── Hilfsfunktion: Zeile importieren ─────────────────────────────────────────
async function importZeile(
  row: Record<string, unknown>,
): Promise<"importiert" | "uebersprungen" | "fehler"> {
  const name = pickCol(row, ...ARTIKEL_ALIAS.name);
  if (!name) return "fehler";

  let artikelnummer = pickCol(row, ...ARTIKEL_ALIAS.artikelnummer);
  if (artikelnummer) {
    const bestehend = await prisma.artikel.findUnique({
      where: { artikelnummer },
      select: { id: true },
    });
    if (bestehend) return "uebersprungen";
  } else {
    artikelnummer = await naechsteArtikelnummer();
  }

  const standardpreis = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.standardpreis));
  const einkaufspreis = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.einkaufspreis));
  const mwstRaw = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.mwst));
  const mwstSatz = [0, 7, 19].includes(mwstRaw) ? mwstRaw : 19;
  const mindestbestand = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.mindestbestand));
  const kategorie = pickCol(row, ...ARTIKEL_ALIAS.kategorie) || "Sonstiges";
  const einheit = pickCol(row, ...ARTIKEL_ALIAS.einheit) || "Stück";
  const liefergroesse = pickCol(row, ...ARTIKEL_ALIAS.liefergroesse) || null;
  const beschreibung = pickCol(row, ...ARTIKEL_ALIAS.beschreibung) || null;
  const lieferantName = pickCol(row, ...ARTIKEL_ALIAS.lieferant);

  const lieferantCreate = lieferantName
    ? [{
        lieferantId: await lieferantIdFuerName(lieferantName),
        lieferantenArtNr: artikelnummer,
        einkaufspreis,
        mindestbestellmenge: 1,
        lieferzeitTage: 7,
        bevorzugt: true,
      }]
    : [];

  await prisma.artikel.create({
    data: {
      artikelnummer,
      name,
      kategorie,
      einheit,
      standardpreis,
      mwstSatz,
      mindestbestand,
      aktuellerBestand: 0,
      liefergroesse,
      beschreibung,
      lieferanten: lieferantCreate.length ? { create: lieferantCreate } : undefined,
    },
  });
  return "importiert";
}

/** POST (JSON)      – interner Stammdaten-Import (nach Gruppe)
 *  POST (multipart) – Excel-Upload */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  // ── Excel-Upload ───────────────────────────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
      }

      const buffer = Buffer.from(await (file as Blob).arrayBuffer());
      const wb = XLSX.read(buffer, { type: "buffer" });
      // Erstes Sheet verwenden (normalerweise "Artikel")
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (rows.length === 0) {
        return NextResponse.json({ error: "Keine Zeilen im Excel gefunden" }, { status: 400 });
      }

      let importiert = 0;
      let uebersprungen = 0;
      let fehler = 0;

      for (const row of rows) {
        const result = await importZeile(row);
        if (result === "importiert") importiert++;
        else if (result === "uebersprungen") uebersprungen++;
        else fehler++;
      }

      return NextResponse.json({ importiert, uebersprungen, fehler });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Excel konnte nicht verarbeitet werden" }, { status: 500 });
    }
  }

  // ── Stammdaten-Import (JSON) ───────────────────────────────────────────────
  try {
    const body = await req.json().catch(() => ({}));
    const gruppenTitel: string | undefined = body.gruppenTitel;

    const zuImportieren = gruppenTitel
      ? ALLE_STAMMDATEN_ARTIKEL.filter((a) => {
          const gruppe = STAMMDATEN_GRUPPEN.find((g) => g.titel === gruppenTitel);
          return gruppe?.artikel.some((ga) => ga.artikelnummer === a.artikelnummer);
        })
      : ALLE_STAMMDATEN_ARTIKEL;

    // Lieferanten sicherstellen
    const lieferantNamen = [...new Set(zuImportieren.map((a) => a.lieferantName))];
    const lieferantMap = new Map<string, number>();
    for (const name of lieferantNamen) {
      lieferantMap.set(name, await lieferantIdFuerName(name));
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
          ...(a.inhaltsstoffe?.length && {
            inhaltsstoffe: {
              create: a.inhaltsstoffe.map((i: { name: string; menge?: number | null; einheit?: string | null }) => ({
                name: i.name,
                menge: i.menge ?? null,
                einheit: i.einheit ?? null,
              })),
            },
          }),
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
