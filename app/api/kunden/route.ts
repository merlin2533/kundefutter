import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const aktiv = searchParams.get("aktiv");
  const search = searchParams.get("search");
  const karte = searchParams.get("karte"); // nur Kunden mit Koordinaten
  const tag = searchParams.get("tag");

  const where: Record<string, unknown> = {};
  if (aktiv !== null) where.aktiv = aktiv === "true";
  if (karte === "true") {
    where.lat = { not: null };
    where.lng = { not: null };
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { firma: { contains: search } },
      { ort: { contains: search } },
      { plz: { contains: search } },
    ];
  }
  if (tag) {
    where.tags = { contains: `"${tag}"` }; // JSON contains check
  }

  const kunden = await prisma.kunde.findMany({
    where,
    include: { kontakte: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(kunden);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { kontakte, name, firma, kategorie, verantwortlicher, strasse, plz, ort, land, lat, lng, notizen } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  const kunde = await prisma.kunde.create({
    data: {
      name: name.trim(),
      firma: firma || null,
      kategorie: kategorie || "Sonstige",
      verantwortlicher: verantwortlicher || null,
      strasse: strasse || null,
      plz: plz || null,
      ort: ort || null,
      land: land || "Deutschland",
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      notizen: notizen || null,
      kontakte: Array.isArray(kontakte) && kontakte.length
        ? { create: kontakte.map((k: { typ: string; wert: string; label?: string }) => ({
            typ: k.typ,
            wert: k.wert,
            label: k.label || null,
          })) }
        : undefined,
    },
    include: { kontakte: true },
  });
  return NextResponse.json(kunde, { status: 201 });
}
