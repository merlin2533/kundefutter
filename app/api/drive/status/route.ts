import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { testVerbindung } from "@/lib/googleDrive";

export async function GET() {
  const keyEinstellung = await prisma.einstellung.findUnique({
    where: { key: "system.google.serviceAccountKey" },
  });

  if (!keyEinstellung?.value) {
    return NextResponse.json({ konfiguriert: false, verbunden: false });
  }

  const result = await testVerbindung();
  return NextResponse.json({ konfiguriert: true, verbunden: result.ok, email: result.email, fehler: result.fehler });
}
