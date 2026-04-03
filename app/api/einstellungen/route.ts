import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_PREFIXES = ["firma.", "system."];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prefix = searchParams.get("prefix") ?? "firma.";

  try {
    const einstellungen = await prisma.einstellung.findMany({
      where: { key: { startsWith: prefix } },
    });
    const result: Record<string, string> = {};
    for (const e of einstellungen) {
      result[e.key] = e.value;
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { key, value } = body as { key: string; value: string };
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key und value erforderlich" }, { status: 400 });
  }
  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return NextResponse.json({ error: `Nur Einstellungen mit Prefix ${ALLOWED_PREFIXES.join(", ")} sind erlaubt` }, { status: 400 });
  }

  try {
    const einstellung = await prisma.einstellung.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return NextResponse.json(einstellung);
  } catch {
    return NextResponse.json({ error: "Fehler beim Speichern der Einstellung" }, { status: 500 });
  }
}
