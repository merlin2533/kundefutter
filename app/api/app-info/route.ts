import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_APP_NAME } from "@/lib/appinfo";

export const dynamic = "force-dynamic";

/**
 * Öffentliche Branding-Infos (App-Name, Firmenname, Logo) – wird u. a. von der
 * Login-Seite genutzt, die ohne Session aufgerufen wird. Enthält bewusst keine
 * sensiblen Daten.
 */
export async function GET() {
  try {
    const settings = await prisma.einstellung.findMany({
      where: { key: { in: ["system.appname", "system.firmenname", "system.logo"] } },
    });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return NextResponse.json({
      appName: map["system.appname"]?.trim() || DEFAULT_APP_NAME,
      firmenname: map["system.firmenname"]?.trim() || "",
      logo: map["system.logo"] || null,
    });
  } catch {
    return NextResponse.json({ appName: DEFAULT_APP_NAME, firmenname: "", logo: null });
  }
}
