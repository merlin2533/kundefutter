import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// GET: Vorlage herunterladen
export async function GET() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Name", "Vorname", "Firma", "Straße", "PLZ", "Ort", "Telefon", "Mobil", "Fax", "E-Mail", "Notizen"],
    ["Bartelheimer", "Dieter", "", "Im Paradies 36", "32312", "Lübbecke/Alswede", "", "0151-1430887", "", "", ""],
    ["Becker Biolandhof", "Heinrich-Hermann", "Biolandhof", "Hücker Dorf 3", "32139", "Spenge", "05732-3339", "", "", "", ""],
    ["BKS Ackerbau GbR", "Herr Block", "BKS Ackerbau GbR", "Unter den Eichen 23", "31632", "Husum", "", "0177-2643870", "", "", ""],
  ]);

  ws["!cols"] = [
    { wch: 22 }, { wch: 18 }, { wch: 25 }, { wch: 28 }, { wch: 8 },
    { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 32 },
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
  }[] = [];

  for (const row of rows) {
    const nachname = String(row["Name"] ?? row["name"] ?? row["NAME"] ?? "").trim();
    if (!nachname) continue;

    const vorname = String(row["Vorname"] ?? row["vorname"] ?? "").trim() || null;
    const firma = String(row["Firma"] ?? row["firma"] ?? "").trim() || null;
    // Combine first+last name for private customers; keep company name as-is when Firma is set
    const name = vorname && !firma ? `${vorname} ${nachname}` : nachname;

    eintraege.push({
      name,
      vorname,
      firma,
      kategorie: String(row["Kategorie"] ?? row["kategorie"] ?? "").trim() || "Sonstige",
      strasse: String(row["Strasse"] ?? row["Straße"] ?? row["strasse"] ?? "").trim() || null,
      plz: String(row["PLZ"] ?? row["plz"] ?? "").trim() || null,
      ort: String(row["Ort"] ?? row["ort"] ?? "").trim() || null,
      land: String(row["Land"] ?? row["land"] ?? "").trim() || "Deutschland",
      telefon: String(row["Telefon"] ?? row["telefon"] ?? "").trim() || null,
      mobil: String(row["Mobil"] ?? row["mobil"] ?? "").trim() || null,
      fax: String(row["Fax"] ?? row["fax"] ?? "").trim() || null,
      email: String(row["Email"] ?? row["email"] ?? row["E-Mail"] ?? "").trim() || null,
      notizen: String(row["Notizen"] ?? row["notizen"] ?? "").trim() || null,
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
        kontakte: kontakte.length ? { create: kontakte } : undefined,
      },
    });
    angelegt++;
  }

  return NextResponse.json({ angelegt });
}
