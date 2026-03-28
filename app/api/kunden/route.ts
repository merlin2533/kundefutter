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

  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const usePagination = pageParam !== null;
  const limit = limitParam !== null ? Math.max(1, parseInt(limitParam, 10) || 100) : 100;
  const page = pageParam !== null ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

  const select = {
    id: true,
    name: true,
    firma: true,
    kategorie: true,
    plz: true,
    ort: true,
    land: true,
    lat: true,
    lng: true,
    aktiv: true,
    tags: true,
    kontakte: {
      select: {
        id: true,
        typ: true,
        wert: true,
        label: true,
      },
    },
  };

  if (usePagination) {
    const [kunden, total] = await Promise.all([
      prisma.kunde.findMany({
        where,
        select,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.kunde.count({ where }),
    ]);
    return NextResponse.json({ data: kunden, total, page, limit });
  }

  const kunden = await prisma.kunde.findMany({
    where,
    select,
    orderBy: { name: "asc" },
    take: limit,
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
