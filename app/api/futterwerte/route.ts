import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FUTTERWERTE, FUTTERGRUPPEN, type Futterwert } from "@/lib/futterwerte";
export const dynamic = "force-dynamic";

const CUSTOM_KEY = "futterwerte.custom";

// GET /api/futterwerte — Standard-Tabelle + benutzerdefinierte Einträge
export async function GET() {
  try {
    const setting = await prisma.einstellung.findUnique({ where: { key: CUSTOM_KEY } });
    let custom: Futterwert[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) custom = parsed;
      } catch {
        // ungültiges JSON ignorieren
      }
    }
    return NextResponse.json({
      standard: FUTTERWERTE,
      custom,
      gruppen: FUTTERGRUPPEN,
    });
  } catch {
    return NextResponse.json({ standard: FUTTERWERTE, custom: [], gruppen: FUTTERGRUPPEN });
  }
}

// PUT /api/futterwerte — benutzerdefinierte Einträge speichern (komplette Liste)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const eintraege = Array.isArray(body.custom) ? body.custom : [];

    // Validierung: Pflichtfelder, plausible Werte
    const sauber: Futterwert[] = [];
    for (const e of eintraege) {
      if (!e?.name?.trim()) continue;
      const tmGehalt = Number(e.tmGehalt);
      if (isNaN(tmGehalt) || tmGehalt <= 0 || tmGehalt > 1000) continue;
      const eintrag: Futterwert = {
        name: String(e.name).trim(),
        gruppe: FUTTERGRUPPEN.includes(e.gruppe) ? e.gruppe : "Sonstiges",
        tmGehalt,
      };
      for (const k of ["me", "nel", "rohprotein", "nxp", "dp", "rohfaser", "andfom", "lysin", "methionin", "threonin", "tryptophan", "ca", "p", "mg", "na"] as const) {
        const v = e[k];
        if (v != null && v !== "" && !isNaN(Number(v))) {
          (eintrag as unknown as Record<string, number>)[k] = Number(v);
        }
      }
      sauber.push(eintrag);
    }

    await prisma.einstellung.upsert({
      where: { key: CUSTOM_KEY },
      update: { value: JSON.stringify(sauber) },
      create: { key: CUSTOM_KEY, value: JSON.stringify(sauber) },
    });
    return NextResponse.json({ ok: true, anzahl: sauber.length });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
