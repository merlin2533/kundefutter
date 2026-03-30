import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STAMMDATEN_GRUPPEN, ALLE_STAMMDATEN_ARTIKEL } from "@/lib/artikel-stammdaten";
import * as XLSX from "xlsx";

/** GET ?action=template  → Excel-Datei mit allen Stammdaten zum Download
 *  GET (kein action)     → JSON-Statusübersicht */
export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action");

  // ── Template-Download ──────────────────────────────────────────────────────
  if (action === "template") {
    const rows = ALLE_STAMMDATEN_ARTIKEL.map((a) => ({
      Artikelnummer: a.artikelnummer,
      Name: a.name,
      Kategorie: a.kategorie,
      Einheit: a.einheit,
      "VK (Standardpreis)": a.standardpreis,
      "EK (Einkaufspreis)": a.einkaufspreis,
      "MwSt %": a.mwstSatz,
      Mindestbestand: a.mindestbestand,
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
      { wch: 10 }, // Einheit
      { wch: 16 }, // VK
      { wch: 16 }, // EK
      { wch: 8  }, // MwSt
      { wch: 14 }, // Mindestbestand
      { wch: 40 }, // Beschreibung
      { wch: 30 }, // Lieferant
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Artikel");

    // Hinweis-Sheet mit Spalten-Erklärung
    const hinweise = [
      { Spalte: "Artikelnummer", Pflicht: "Ja", Hinweis: "Eindeutige Artikelnummer. Bestehende werden beim Import übersprungen." },
      { Spalte: "Name",          Pflicht: "Ja", Hinweis: "Artikelbezeichnung" },
      { Spalte: "Kategorie",     Pflicht: "Ja", Hinweis: "z.B. Pferdefutter, Stallzubehoer, Pflanzenhilfsmittel, Futter, Duenger, Saatgut" },
      { Spalte: "Einheit",       Pflicht: "Ja", Hinweis: "kg, t, Sack, Stück, Liter, …" },
      { Spalte: "VK (Standardpreis)", Pflicht: "Ja", Hinweis: "Verkaufspreis inkl. MwSt (Zahl)" },
      { Spalte: "EK (Einkaufspreis)", Pflicht: "Nein", Hinweis: "Einkaufspreis netto (Zahl, leer = 0)" },
      { Spalte: "MwSt %",        Pflicht: "Nein", Hinweis: "0, 7 oder 19 (Standard: 19)" },
      { Spalte: "Mindestbestand", Pflicht: "Nein", Hinweis: "Meldebestand (Zahl, Standard: 0)" },
      { Spalte: "Beschreibung",  Pflicht: "Nein", Hinweis: "Freitext" },
      { Spalte: "Lieferant",     Pflicht: "Nein", Hinweis: "Name des Lieferanten – wird automatisch angelegt falls nicht vorhanden" },
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

// ── Hilfsfunktion: Zeile importieren ─────────────────────────────────────────
async function importZeile(
  row: Record<string, unknown>,
): Promise<"importiert" | "uebersprungen" | "fehler"> {
  const artikelnummer = String(row["Artikelnummer"] ?? "").trim();
  const name = String(row["Name"] ?? "").trim();
  if (!artikelnummer || !name) return "fehler";

  const bestehend = await prisma.artikel.findUnique({
    where: { artikelnummer },
    select: { id: true },
  });
  if (bestehend) return "uebersprungen";

  const standardpreis = parseFloat(String(row["VK (Standardpreis)"] ?? "0")) || 0;
  const einkaufspreis = parseFloat(String(row["EK (Einkaufspreis)"] ?? "0")) || 0;
  const mwstRaw = parseFloat(String(row["MwSt %"] ?? "19"));
  const mwstSatz = [0, 7, 19].includes(mwstRaw) ? mwstRaw : 19;
  const mindestbestand = parseFloat(String(row["Mindestbestand"] ?? "0")) || 0;
  const kategorie = String(row["Kategorie"] ?? "Sonstiges").trim() || "Sonstiges";
  const einheit = String(row["Einheit"] ?? "Stück").trim() || "Stück";
  const beschreibung = String(row["Beschreibung"] ?? "").trim() || null;
  const lieferantName = String(row["Lieferant"] ?? "").trim();

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
