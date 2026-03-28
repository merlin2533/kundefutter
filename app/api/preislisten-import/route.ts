import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// POST: Excel-Datei hochladen und Einkaufspreise vorschlagen
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const lieferantId = Number(formData.get("lieferantId"));

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
  if (!lieferantId) return NextResponse.json({ error: "lieferantId fehlt" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const vorschlaege = [];

  for (const row of rows) {
    const artNr = String(row["Artikelnummer"] ?? row["artikelnummer"] ?? row["ArtNr"] ?? "").trim();
    const neuerPreis = parseFloat(String(row["Einkaufspreis"] ?? row["Preis"] ?? row["preis"] ?? "0").replace(",", "."));

    if (!artNr || isNaN(neuerPreis)) continue;

    const zuordnung = await prisma.artikelLieferant.findFirst({
      where: {
        lieferantId,
        OR: [
          { lieferantenArtNr: artNr },
          { artikel: { artikelnummer: artNr } },
        ],
      },
      include: { artikel: true },
    });

    if (!zuordnung) continue;

    vorschlaege.push({
      artikelLieferantId: zuordnung.id,
      artikelId: zuordnung.artikelId,
      artikelnummer: zuordnung.artikel.artikelnummer,
      artikelName: zuordnung.artikel.name,
      alterPreis: zuordnung.einkaufspreis,
      neuerPreis,
      differenz: Math.round((neuerPreis - zuordnung.einkaufspreis) * 100) / 100,
    });
  }

  return NextResponse.json(vorschlaege);
}

// PUT: Bestätigte Preise übernehmen
export async function PUT(req: NextRequest) {
  const { updates } = await req.json();
  // updates: Array von { artikelLieferantId, neuerPreis }

  let aktualisiert = 0;
  for (const u of updates) {
    await prisma.artikelLieferant.update({
      where: { id: u.artikelLieferantId },
      data: { einkaufspreis: u.neuerPreis },
    });
    aktualisiert++;
  }
  return NextResponse.json({ aktualisiert });
}
