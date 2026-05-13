import { NextRequest, NextResponse } from "next/server";
import { validiereVvvo, formatiereVvvo } from "@/lib/vvvo";
export const dynamic = "force-dynamic";

// GET /api/vvvo?nr=DE+03+12345678  oder  POST {nr: "..."}
// Liefert Format-Validierung der VVVO/HIT-Betriebsnummer.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nr = searchParams.get("nr") ?? "";
  return NextResponse.json(buildResult(nr));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json(buildResult(String(body.nr ?? "")));
  } catch {
    return NextResponse.json({ gueltig: false, fehler: "Ungültige Anfrage" }, { status: 400 });
  }
}

function buildResult(nr: string) {
  const r = validiereVvvo(nr);
  return {
    ...r,
    formatiert: r.normalisiert ? formatiereVvvo(r.normalisiert) : null,
  };
}
