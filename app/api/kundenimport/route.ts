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

  for (const row of rows) {
    const name = String(
      row["Name"] ?? row["name"] ?? row["NAME"] ?? ""
    ).trim();

    if (!name) continue;

    const firma = String(row["Firma"] ?? row["firma"] ?? "").trim() || null;
    const kategorie = String(row["Kategorie"] ?? row["kategorie"] ?? "").trim() || "Sonstige";
    const strasse = String(row["Strasse"] ?? row["Straße"] ?? row["strasse"] ?? "").trim() || null;
    const plz = String(row["PLZ"] ?? row["plz"] ?? "").trim() || null;
    const ort = String(row["Ort"] ?? row["ort"] ?? "").trim() || null;
    const land = String(row["Land"] ?? row["land"] ?? "").trim() || "Deutschland";
    const telefon = String(row["Telefon"] ?? row["telefon"] ?? "").trim() || null;
    const mobil = String(row["Mobil"] ?? row["mobil"] ?? "").trim() || null;
    const email = String(row["Email"] ?? row["email"] ?? row["E-Mail"] ?? "").trim() || null;
    const notizen = String(row["Notizen"] ?? row["notizen"] ?? "").trim() || null;

    const eintrag = { name, firma, kategorie, strasse, plz, ort, land, telefon, mobil, email, notizen };

    // Duplikat-Prüfung: gleicher Name bereits in DB
    const existing = await prisma.kunde.findFirst({ where: { name } });
    if (existing) {
      duplikate.push({ ...eintrag, existierendeId: existing.id });
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
