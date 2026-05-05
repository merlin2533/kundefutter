import { NextResponse } from "next/server";
import { verifyEmailConfig } from "@/lib/email";

export async function POST() {
  try {
    await verifyEmailConfig();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
