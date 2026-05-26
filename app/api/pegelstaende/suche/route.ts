import { NextRequest, NextResponse } from "next/server";
import { searchStations } from "@/lib/pegelonline";

// GET /api/pegelstaende/suche?q=Freiburg
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json([]);
  try {
    const stationen = await searchStations(q);
    return NextResponse.json(stationen);
  } catch {
    return NextResponse.json([]);
  }
}
