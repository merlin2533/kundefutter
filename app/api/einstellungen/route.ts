import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_PREFIXES = ["firma.", "system.", "ki."];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prefix = searchParams.get("prefix") ?? "firma.";
  if (!ALLOWED_PREFIXES.some((p) => prefix.startsWith(p) || p.startsWith(prefix))) {
    return NextResponse.json({ error: "Prefix nicht erlaubt" }, { status: 400 });
  }
  try {
    const einstellungen = await prisma.einstellung.findMany({
      where: { key: { startsWith: prefix } },
      take: 100,
    });
    const result: Record<string, string> = {};
    for (const e of einstellungen) {
      // API-Keys maskieren
      if (e.key.endsWith("_key") && e.value) {
        result[e.key] = e.value.length > 8
          ? e.value.slice(0, 7) + "..." + e.value.slice(-4)
          : "***";
      } else {
        result[e.key] = e.value;
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body as { key: string; value: string };
    if (!key || value === undefined) {
      return NextResponse.json({ error: "key und value erforderlich" }, { status: 400 });
    }
    if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
      return NextResponse.json({ error: `Nur Einstellungen mit Prefix ${ALLOWED_PREFIXES.join(", ")} sind erlaubt` }, { status: 400 });
    }
    // Leere Key-Werte nicht überschreiben (verhindert versehentliches Löschen)
    if (key.endsWith("_key") && !value) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const einstellung = await prisma.einstellung.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return NextResponse.json(einstellung);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
