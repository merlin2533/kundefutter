import { NextRequest, NextResponse } from "next/server";
import { verifyEmailConfig, sendEmail } from "@/lib/email";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { to?: string };
    if (body.to) {
      await sendEmail({
        to: body.to,
        subject: "Test-Mail von AGRI-Office",
        text: "Diese E-Mail bestätigt, dass die E-Mail-Konfiguration korrekt funktioniert.",
        html: "<p>Diese E-Mail bestätigt, dass die <b>E-Mail-Konfiguration</b> in AGRI-Office korrekt funktioniert.</p>",
      });
      return NextResponse.json({ ok: true });
    }
    await verifyEmailConfig();
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Email settings is an admin-only page — expose the real error to help diagnose config issues
    const msg = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
