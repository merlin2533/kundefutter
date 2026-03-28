import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// POST: Excel-Datei hochladen und Vorschau zurückgeben
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const vorschau: Record<string, unknown>[] = [];
  const duplikate: Record<string, unknown>[] = [];

  // Parse all rows first
  const eintraege: { name: string; firma: string | null; kategorie: string; strasse: string | null; plz: string | null; ort: string | null; land: string; telefon: string | null; mobil: string | null; email: string | null; notizen: string | null }[] = [];
  for (const row of rows) {
    const name = String(row["Name"] ?? row["name"] ?? row["NAME"] ?? "").trim();
    if (!name) continue;
    eintraege.push({
      name,
      firma: String(row["Firma"] ?? row["firma"] ?? "").trim() || null,
      kategorie: String(row["Kategorie"] ?? row["kategorie"] ?? "").trim() || "Sonstige",
      strasse: String(row["Strasse"] ?? row["Straße"] ?? row["strasse"] ?? "").trim() || null,
      plz: String(row["PLZ"] ?? row["plz"] ?? "").trim() || null,
      ort: String(row["Ort"] ?? row["ort"] ?? "").trim() || null,
      land: String(row["Land"] ?? row["land"] ?? "").trim() || "Deutschland",
      telefon: String(row["Telefon"] ?? row["telefon"] ?? "").trim() || null,
      mobil: String(row["Mobil"] ?? row["mobil"] ?? "").trim() || null,
      email: String(row["Email"] ?? row["email"] ?? row["E-Mail"] ?? "").trim() || null,
      notizen: String(row["Notizen"] ?? row["notizen"] ?? "").trim() || null,
    });
  }

  // Batch duplicate check: single query for all names
  const namen = eintraege.map((e) => e.name);
  const existierende = await prisma.kunde.findMany({
    where: { name: { in: namen } },
    select: { id: true, name: true },
  });
  const existierendeMap = new Map(existierende.map((k) => [k.name, k.id]));

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
      firma?: string;
      kategorie?: string;
      strasse?: string;
      plz?: string;
      ort?: string;
      land?: string;
      telefon?: string;
      mobil?: string;
      email?: string;
      notizen?: string;
    }[];
  };

  let angelegt = 0;

  for (const k of kunden) {
    const kontakte: { typ: string; wert: string }[] = [];
    if (k.telefon) kontakte.push({ typ: "telefon", wert: k.telefon });
    if (k.mobil) kontakte.push({ typ: "mobil", wert: k.mobil });
    if (k.email) kontakte.push({ typ: "email", wert: k.email });

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
