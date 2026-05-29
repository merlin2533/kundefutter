import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface ResendInboundPayload {
  from?: string;
  to?: string[];
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

export async function POST(req: Request) {
  try {
    const [aktivSetting, sourceSetting, secretSetting, aktionSetting] = await Promise.all([
      prisma.einstellung.findUnique({ where: { key: "email.import.aktiv" } }),
      prisma.einstellung.findUnique({ where: { key: "email.import.source" } }),
      prisma.einstellung.findUnique({ where: { key: "email.import.webhook_secret" } }),
      prisma.einstellung.findUnique({ where: { key: "email.import.aktion" } }),
    ]);

    if (aktivSetting?.value !== "true") {
      return NextResponse.json({ error: "E-Mail Import deaktiviert" }, { status: 403 });
    }

    const secret = secretSetting?.value?.trim();
    if (secret) {
      const signature = req.headers.get("svix-signature") ?? req.headers.get("x-resend-signature");
      if (!signature || !signature.includes(secret.slice(0, 8))) {
        return NextResponse.json({ error: "Ungültige Signatur" }, { status: 401 });
      }
    }

    const body = (await req.json()) as ResendInboundPayload;
    const source = sourceSetting?.value?.trim() ?? "";
    const aktion = aktionSetting?.value ?? "benachrichtigung";

    const from = body.from ?? "";
    const to = Array.isArray(body.to) ? body.to.join(", ") : (body.to ?? "");
    const subject = body.subject ?? "(kein Betreff)";
    const text = body.text ?? body.html ?? "";

    await prisma.benachrichtigung.create({
      data: {
        typ: "email_import",
        titel: `E-Mail Import: ${subject}`,
        text: [
          `Von: ${from}`,
          `An: ${to}`,
          source ? `Source: ${source}` : "",
          `Aktion: ${aktion}`,
          "",
          text.slice(0, 500),
        ]
          .filter(Boolean)
          .join("\n"),
        prioritaet: "info",
      },
    });

    return NextResponse.json({ ok: true, aktion, source });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 },
    );
  }
}
