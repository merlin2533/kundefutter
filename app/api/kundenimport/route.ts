import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { pickCol, parseNumber, KUNDEN_ALIAS } from "@/lib/import-utils";
export const dynamic = "force-dynamic";


// GET: Vorlage herunterladen
export async function GET() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Name", "Vorname", "Firma", "Kundennr.", "Straße", "PLZ", "Ort", "Telefon", "Mobil", "Fax", "E-Mail", "Notizen", "USt-IdNr.", "Zahlungsziel"],
    ["Bartelheimer", "Dieter", "", "", "Im Paradies 36", "32312", "Lübbecke/Alswede", "", "0151-1430887", "", "", "", "", ""],
    ["Becker Biolandhof", "Heinrich-Hermann", "Biolandhof", "", "Hücker Dorf 3", "32139", "Spenge", "05732-3339", "", "", "", "", "", "30"],
    ["BKS Ackerbau GbR", "Herr Block", "BKS Ackerbau GbR", "K-001", "Unter den Eichen 23", "31632", "Husum", "", "0177-2643870", "", "", "", "DE123456789", "14"],
  ]);

  ws["!cols"] = [
    { wch: 22 }, { wch: 18 }, { wch: 25 }, { wch: 12 }, { wch: 28 }, { wch: 8 },
    { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 32 },
    { wch: 16 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kunden");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="kunden-import-vorlage.xlsx"',
    },
  });
}

// POST: Excel-Datei hochladen und Vorschau zurückgeben
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const eintraege: {
    name: string;
    vorname: string | null;
    firma: string | null;
    kundennummer: string | null;
    kategorie: string;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    land: string;
    telefon: string | null;
    mobil: string | null;
    fax: string | null;
    email: string | null;
    notizen: string | null;
    ustIdNr: string | null;
    zahlungsziel: number | null;
    betriebsnummer: string | null;
  }[] = [];

  for (const row of rows) {
    const nachname = pickCol(row, ...KUNDEN_ALIAS.name);
    if (!nachname) continue;

    const vorname = pickCol(row, ...KUNDEN_ALIAS.vorname) || null;
    const firma = pickCol(row, ...KUNDEN_ALIAS.firma) || null;
    // Combine first+last name for private customers; keep company name as-is when Firma is set
    const name = vorname && !firma ? `${vorname} ${nachname}` : nachname;

    const kundennummerRaw = pickCol(row, ...KUNDEN_ALIAS.kundennummer);
    const kategorie = pickCol(row, ...KUNDEN_ALIAS.kategorie) || "Sonstige";
    const strasse = pickCol(row, ...KUNDEN_ALIAS.strasse) || null;
    const plz = pickCol(row, ...KUNDEN_ALIAS.plz) || null;
    const ort = pickCol(row, ...KUNDEN_ALIAS.ort) || null;
    const land = pickCol(row, ...KUNDEN_ALIAS.land) || "Deutschland";
    const telefon = pickCol(row, ...KUNDEN_ALIAS.telefon) || null;
    const mobil = pickCol(row, ...KUNDEN_ALIAS.mobil) || null;
    const fax = pickCol(row, ...KUNDEN_ALIAS.fax) || null;
    const email = pickCol(row, ...KUNDEN_ALIAS.email) || null;
    const notizen = pickCol(row, ...KUNDEN_ALIAS.notizen) || null;
    const ustIdNr = pickCol(row, ...KUNDEN_ALIAS.ustIdNr) || null;
    const zahlungszielRaw = pickCol(row, ...KUNDEN_ALIAS.zahlungsziel);
    const zahlungsziel = zahlungszielRaw ? parseNumber(zahlungszielRaw) || null : null;
    const betriebsnummer = pickCol(row, ...KUNDEN_ALIAS.betriebsnummer) || null;

    eintraege.push({
      name,
      vorname,
      firma,
      kundennummer: kundennummerRaw || null,
      kategorie,
      strasse,
      plz,
      ort,
      land,
      telefon,
      mobil,
      fax,
      email,
      notizen,
      ustIdNr,
      zahlungsziel,
      betriebsnummer,
    });
  }

  // Batch duplicate check
  const namen = eintraege.map((e) => e.name);
  const existierende = await prisma.kunde.findMany({
    where: { name: { in: namen } },
    select: { id: true, name: true },
    take: 5000,
  });
  const existierendeMap = new Map(existierende.map((k) => [k.name, k.id]));

  const vorschau: typeof eintraege = [];
  const duplikate: (typeof eintraege[number] & { existierendeId: number })[] = [];

  for (const eintrag of eintraege) {
    const existierendeId = existierendeMap.get(eintrag.name);
    if (existierendeId !== undefined) {
      duplikate.push({ ...eintrag, existierendeId });
    } else {
      vorschau.push(eintrag);
    }
  }

  return NextResponse.json({ vorschau, duplikate });
}

// PUT: Bestätigte Kunden anlegen
export async function PUT(req: NextRequest) {
  const { kunden } = await req.json() as {
    kunden: {
      name: string;
      vorname?: string | null;
      firma?: string | null;
      kundennummer?: string | null;
      kategorie?: string;
      strasse?: string | null;
      plz?: string | null;
      ort?: string | null;
      land?: string;
      telefon?: string | null;
      mobil?: string | null;
      fax?: string | null;
      email?: string | null;
      notizen?: string | null;
      ustIdNr?: string | null;
      zahlungsziel?: number | null;
      betriebsnummer?: string | null;
    }[];
  };

  let angelegt = 0;

  for (const k of kunden) {
    const kontakte: { typ: string; wert: string; vorname?: string; nachname?: string }[] = [];
    let nameGesetzt = false;

    if (k.telefon) {
      kontakte.push({ typ: "telefon", wert: k.telefon, vorname: k.vorname ?? undefined, nachname: k.name });
      nameGesetzt = true;
    }
    if (k.mobil) {
      kontakte.push({
        typ: "mobil",
        wert: k.mobil,
        vorname: !nameGesetzt ? (k.vorname ?? undefined) : undefined,
        nachname: !nameGesetzt ? k.name : undefined,
      });
      nameGesetzt = true;
    }
    if (k.fax) {
      kontakte.push({ typ: "fax", wert: k.fax });
    }
    if (k.email) {
      kontakte.push({
        typ: "email",
        wert: k.email,
        vorname: !nameGesetzt ? (k.vorname ?? undefined) : undefined,
        nachname: !nameGesetzt ? k.name : undefined,
      });
    }

    await prisma.kunde.create({
      data: {
        name: k.name,
        firma: k.firma ?? null,
        kategorie: k.kategorie ?? "Sonstige",
        strasse: k.strasse ?? null,
        plz: k.plz ?? null,
        ort: k.ort ?? null,
        land: k.land ?? "Deutschland",
        notizen: k.notizen ?? null,
        ustIdNr: k.ustIdNr ?? null,
        betriebsnummer: k.betriebsnummer ?? null,
        kontakte: kontakte.length ? { create: kontakte } : undefined,
      },
    });
    angelegt++;
  }

  return NextResponse.json({ angelegt });
}
