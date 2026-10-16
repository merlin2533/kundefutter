import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";

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

    // Svix-Signaturprüfung (Resend): HMAC-SHA256 über "<id>.<timestamp>.<body>" mit dem
    // base64-dekodierten Secret ("whsec_…"). Ohne konfiguriertes Secret wird abgelehnt —
    // sonst könnte jeder anonyme Aufrufer Benachrichtigungen erzeugen.
    const secret = secretSetting?.value?.trim();
    if (!secret) {
      return NextResponse.json({ error: "Webhook-Secret nicht konfiguriert" }, { status: 401 });
    }
    const rawBody = await req.text();
    const svixId = req.headers.get("svix-id") ?? "";
    const svixTs = req.headers.get("svix-timestamp") ?? "";
    const svixSig = req.headers.get("svix-signature") ?? "";
    const tsNum = Number(svixTs);
    if (!svixId || !svixSig || !Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
      return NextResponse.json({ error: "Ungültige Signatur" }, { status: 401 });
    }
    const keyBuf = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
    const expected = crypto.createHmac("sha256", keyBuf).update(`${svixId}.${svixTs}.${rawBody}`).digest("base64");
    const expBuf = Buffer.from(expected);
    const ok = svixSig.split(" ").some((part) => {
      const sig = part.split(",")[1] ?? "";
      const sigBuf = Buffer.from(sig);
      return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    });
    if (!ok) {
      return NextResponse.json({ error: "Ungültige Signatur" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as ResendInboundPayload;
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
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 },
    );
  }
}
