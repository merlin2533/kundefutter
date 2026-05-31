import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GUELTIGE_TYPEN = ["festgehalt", "minijob", "stundenbasis"];

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const aktivParam = searchParams.get("aktiv");
  const typ = searchParams.get("typ");

  try {
    const where: Record<string, unknown> = {};
    if (aktivParam !== null) where.aktiv = aktivParam !== "false";
    if (typ && GUELTIGE_TYPEN.includes(typ)) where.typ = typ;

    const mitarbeiter = await prisma.mitarbeiter.findMany({
      where,
      select: {
        id: true,
        vorname: true,
        nachname: true,
        typ: true,
        aktiv: true,
        eintrittsdatum: true,
        austrittsdatum: true,
        email: true,
        telefon: true,
        grundgehalt: true,
        minijobPauschale: true,
        stundenlohn: true,
        wochenstunden: true,
        urlaubstageProJahr: true,
        kostenstelle: true,
      },
      orderBy: [{ aktiv: "desc" }, { nachname: "asc" }, { vorname: "asc" }],
      take: 500,
    });

    return NextResponse.json(mitarbeiter);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      vorname,
      nachname,
      typ,
      eintrittsdatum,
      austrittsdatum,
      aktiv,
      email,
      telefon,
      iban,
      bic,
      kontoinhaber,
      grundgehalt,
      minijobPauschale,
      stundenlohn,
      wochenstunden,
      urlaubstageProJahr,
      kostenstelle,
      notiz,
    } = body;

    if (!vorname || typeof vorname !== "string" || vorname.trim() === "") {
      return NextResponse.json({ error: "Vorname ist erforderlich" }, { status: 400 });
    }
    if (!nachname || typeof nachname !== "string" || nachname.trim() === "") {
      return NextResponse.json({ error: "Nachname ist erforderlich" }, { status: 400 });
    }
    if (!typ || !GUELTIGE_TYPEN.includes(typ)) {
      return NextResponse.json({ error: "Ungültiger Beschäftigungstyp" }, { status: 400 });
    }
    if (!eintrittsdatum) {
      return NextResponse.json({ error: "Eintrittsdatum ist erforderlich" }, { status: 400 });
    }

    const mitarbeiter = await prisma.mitarbeiter.create({
      data: {
        vorname: vorname.trim(),
        nachname: nachname.trim(),
        typ,
        eintrittsdatum: new Date(eintrittsdatum),
        austrittsdatum: austrittsdatum ? new Date(austrittsdatum) : null,
        aktiv: aktiv !== false,
        email: email || null,
        telefon: telefon || null,
        iban: iban || null,
        bic: bic || null,
        kontoinhaber: kontoinhaber || null,
        grundgehalt: grundgehalt != null ? parseFloat(grundgehalt) : null,
        minijobPauschale: minijobPauschale != null ? parseFloat(minijobPauschale) : null,
        stundenlohn: stundenlohn != null ? parseFloat(stundenlohn) : null,
        wochenstunden: wochenstunden != null ? parseFloat(wochenstunden) : null,
        urlaubstageProJahr: urlaubstageProJahr != null ? parseInt(urlaubstageProJahr, 10) : 0,
        kostenstelle: kostenstelle || null,
        notiz: notiz || null,
      },
    });

    return NextResponse.json(mitarbeiter, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
