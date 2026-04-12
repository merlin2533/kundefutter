import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function POST() {
  try {
    const smtpKeys = await prisma.einstellung.findMany({
      where: { key: { startsWith: "smtp." } },
    });
    const smtp: Record<string, string> = {};
    for (const e of smtpKeys) smtp[e.key] = e.value;

    if (!smtp["smtp.host"]) {
      return NextResponse.json({ error: "SMTP-Host nicht konfiguriert" }, { status: 422 });
    }

    const transporter = nodemailer.createTransport({
      host: smtp["smtp.host"],
      port: Number(smtp["smtp.port"] ?? "587"),
      secure: smtp["smtp.secure"] === "true",
      auth: {
        user: smtp["smtp.user"],
        pass: smtp["smtp.password"],
      },
    });

    await transporter.verify();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen" },
      { status: 500 },
    );
  }
}
