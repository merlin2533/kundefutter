import { NextResponse } from "next/server";
import { getBackfillStatus, istVerwaist } from "@/lib/nextcloud-backfill";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getBackfillStatus();
    if (!status) return NextResponse.json({ laufend: false });
    return NextResponse.json({ ...status, verwaist: istVerwaist(status) });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Status konnte nicht geladen werden" }, { status: 500 });
  }
}
