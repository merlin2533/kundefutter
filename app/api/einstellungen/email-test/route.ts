import { NextResponse } from "next/server";
import { verifyEmailConfig } from "@/lib/email";

export async function POST() {
  try {
    await verifyEmailConfig();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen" },
      { status: 500 },
    );
  }
}
