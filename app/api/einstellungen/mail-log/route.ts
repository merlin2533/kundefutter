import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// GET /api/einstellungen/mail-log — Liste der letzten 200 Mails
export async function GET() {
  try {
    const logs = await prisma.mailLog.findMany({
      orderBy: { zeitpunkt: "desc" },
      take: 200,
      select: {
        id: true,
        zeitpunkt: true,
        empfaenger: true,
        betreff: true,
        status: true,
        fehler: true,
        feature: true,
        anhangNamen: true,
      },
    });
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/einstellungen/mail-log?id=X
export async function DELETE(req: NextRequest) {
  const id = parseInt(req.nextUrl.searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  try {
    await prisma.mailLog.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
