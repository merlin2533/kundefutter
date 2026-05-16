import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// GET /api/bodenproben?schlagId=X&kundeId=Y
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schlagId = parseInt(searchParams.get("schlagId") ?? "", 10);
  const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);

  try {
    const where: { schlagId?: number; schlag?: { kundeId: number } } = {};
    if (!isNaN(schlagId)) where.schlagId = schlagId;
    else if (!isNaN(kundeId)) where.schlag = { kundeId };

    const proben = await prisma.bodenprobe.findMany({
      where,
      include: { schlag: { select: { id: true, name: true, kundeId: true } } },
      orderBy: { datum: "desc" },
      take: 500,
    });
    return NextResponse.json(proben);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/bodenproben
//   Einzelprobe:  body = {...probe-felder}
//   Mehrfachprobe (z.B. nach KI-Erkennung einer Sammel-PDF):
//                 body = { proben: [{...probe, schlagId}, ...], belegPfad?, belegName? }
//   → Liefert in beiden Fällen ein Array zurück.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const isBatch = Array.isArray(body?.proben);
    const liste: Record<string, unknown>[] = isBatch ? body.proben : [body];
    const sharedBeleg = {
      belegPfad: typeof body?.belegPfad === "string" ? body.belegPfad.trim() : null,
      belegName: typeof body?.belegName === "string" ? body.belegName.trim() : null,
    };

    const ergebnisse: { erstellt: number[]; fehler: { index: number; grund: string }[] } = {
      erstellt: [],
      fehler: [],
    };

    for (let i = 0; i < liste.length; i++) {
      const p = liste[i];
      const schlagId = parseInt(String(p.schlagId), 10);
      if (isNaN(schlagId)) {
        ergebnisse.fehler.push({ index: i, grund: "schlagId fehlt" });
        continue;
      }
      if (!p.datum) {
        ergebnisse.fehler.push({ index: i, grund: "Datum fehlt" });
        continue;
      }
      const schlag = await prisma.kundeSchlag.findUnique({ where: { id: schlagId } });
      if (!schlag) {
        ergebnisse.fehler.push({ index: i, grund: `Schlag ${schlagId} nicht gefunden` });
        continue;
      }

      try {
        const probe = await prisma.bodenprobe.create({
          data: {
            schlagId,
            datum: new Date(String(p.datum)),
            probenNr: strTrim(p.probenNr),
            labor: strTrim(p.labor),
            tiefe: strTrim(p.tiefe),
            nutzungsart: strTrim(p.nutzungsart),
            bodenart: strTrim(p.bodenart),
            bodenartGruppe: strTrim(p.bodenartGruppe),
            pHSoll: strTrim(p.pHSoll),
            auftragsNr: strTrim(p.auftragsNr),
            probenehmer: strTrim(p.probenehmer),
            kundeNrLabor: strTrim(p.kundeNrLabor),
            pH: numOrNull(p.pH),
            phosphor: numOrNull(p.phosphor),
            kalium: numOrNull(p.kalium),
            magnesium: numOrNull(p.magnesium),
            bor: numOrNull(p.bor),
            schwefel: numOrNull(p.schwefel),
            zink: numOrNull(p.zink),
            kupfer: numOrNull(p.kupfer),
            mangan: numOrNull(p.mangan),
            natrium: numOrNull(p.natrium),
            kak: numOrNull(p.kak),
            kalkbedarf: numOrNull(p.kalkbedarf),
            kalkbedarfDt: numOrNull(p.kalkbedarfDt),
            humus: numOrNull(p.humus),
            corg: numOrNull(p.corg),
            nGesamt: numOrNull(p.nGesamt),
            nMin: numOrNull(p.nMin),
            cn: numOrNull(p.cn),
            klasseP: klasseOrNull(p.klasseP),
            klasseK: klasseOrNull(p.klasseK),
            klasseMg: klasseOrNull(p.klasseMg),
            klasseBor: klasseOrNull(p.klasseBor),
            klasseSchwefel: klasseOrNull(p.klasseSchwefel),
            klasseZink: klasseOrNull(p.klasseZink),
            klasseKupfer: klasseOrNull(p.klasseKupfer),
            klasseMangan: klasseOrNull(p.klasseMangan),
            klasseNatrium: klasseOrNull(p.klasseNatrium),
            empfehlungenJson: p.empfehlungen != null
              ? JSON.stringify(p.empfehlungen)
              : (typeof p.empfehlungenJson === "string" ? p.empfehlungenJson : null),
            notiz: strTrim(p.notiz),
            belegPfad: strTrim(p.belegPfad) ?? sharedBeleg.belegPfad,
            belegName: strTrim(p.belegName) ?? sharedBeleg.belegName,
          },
        });
        ergebnisse.erstellt.push(probe.id);
      } catch (err) {
        const isDev = process.env.NODE_ENV === "development";
        const msg = isDev && err instanceof Error ? err.message : "DB-Fehler";
        ergebnisse.fehler.push({ index: i, grund: msg });
      }
    }

    return NextResponse.json(ergebnisse, { status: ergebnisse.erstellt.length > 0 ? 201 : 400 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function strTrim(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

// DELETE /api/bodenproben?id=X
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    await prisma.bodenprobe.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function klasseOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  return ["A", "B", "C", "D", "E", "F"].includes(s) ? s : null;
}
