import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/einstellungen/mail-log/[id]/resend — E-Mail erneut versenden
export async function POST(_req: NextRequest, ctx: Params) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const log = await prisma.mailLog.findUnique({ where: { id } });
    if (!log) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    await sendEmail({
      to: log.empfaenger,
      subject: log.betreff,
      text: log.textBody ?? "",
      html: log.htmlBody ?? log.textBody ?? "",
      feature: log.feature ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Versand fehlgeschlagen" }, { status: 500 });
  }
}
