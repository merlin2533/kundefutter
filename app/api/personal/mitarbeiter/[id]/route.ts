import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GUELTIGE_TYPEN = ["festgehalt", "minijob", "stundenbasis"];
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const mitarbeiter = await prisma.mitarbeiter.findUnique({
      where: { id: numId },
    });
    if (!mitarbeiter) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(mitarbeiter);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const {
      vorname, nachname, typ, eintrittsdatum, austrittsdatum, aktiv,
      email, telefon, iban, bic, kontoinhaber,
      grundgehalt, minijobPauschale, stundenlohn, wochenstunden,
      urlaubstageProJahr, kostenstelle, notiz,
    } = body;

    if (typ !== undefined && !GUELTIGE_TYPEN.includes(typ)) {
      return NextResponse.json({ error: "Ungültiger Beschäftigungstyp" }, { status: 400 });
    }

    const updated = await prisma.mitarbeiter.update({
      where: { id: numId },
      data: {
        ...(vorname !== undefined && { vorname: String(vorname).trim() }),
        ...(nachname !== undefined && { nachname: String(nachname).trim() }),
        ...(typ !== undefined && { typ }),
        ...(eintrittsdatum !== undefined && { eintrittsdatum: new Date(eintrittsdatum) }),
        ...(austrittsdatum !== undefined && { austrittsdatum: austrittsdatum ? new Date(austrittsdatum) : null }),
        ...(aktiv !== undefined && { aktiv: Boolean(aktiv) }),
        ...(email !== undefined && { email: email || null }),
        ...(telefon !== undefined && { telefon: telefon || null }),
        ...(iban !== undefined && { iban: iban || null }),
        ...(bic !== undefined && { bic: bic || null }),
        ...(kontoinhaber !== undefined && { kontoinhaber: kontoinhaber || null }),
        ...(grundgehalt !== undefined && { grundgehalt: grundgehalt != null ? parseFloat(grundgehalt) : null }),
        ...(minijobPauschale !== undefined && { minijobPauschale: minijobPauschale != null ? parseFloat(minijobPauschale) : null }),
        ...(stundenlohn !== undefined && { stundenlohn: stundenlohn != null ? parseFloat(stundenlohn) : null }),
        ...(wochenstunden !== undefined && { wochenstunden: wochenstunden != null ? parseFloat(wochenstunden) : null }),
        ...(urlaubstageProJahr !== undefined && { urlaubstageProJahr: parseInt(urlaubstageProJahr, 10) }),
        ...(kostenstelle !== undefined && { kostenstelle: kostenstelle || null }),
        ...(notiz !== undefined && { notiz: notiz || null }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    // Prüfe ob Abrechnungen vorhanden (onDelete: Restrict)
    const abrCount = await prisma.gehaltsabrechnung.count({ where: { mitarbeiterId: numId } });
    if (abrCount > 0) {
      return NextResponse.json(
        { error: "Mitarbeiter hat Gehaltsabrechnungen und kann nicht gelöscht werden. Bitte erst Abrechnungen löschen oder Mitarbeiter deaktivieren." },
        { status: 409 }
      );
    }

    await prisma.mitarbeiter.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}
