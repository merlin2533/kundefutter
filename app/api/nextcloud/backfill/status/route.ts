import { NextResponse } from "next/server";
import { getBackfillStatus } from "@/lib/nextcloud-backfill";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getBackfillStatus();
    return NextResponse.json(status ?? { laufend: false });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Status konnte nicht geladen werden" }, { status: 500 });
  }
}
