import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


export async function GET() {
  const einstellung = await prisma.einstellung.findUnique({
    where: { key: "system.nextcloud.zentralOrdner" },
  });

  if (!einstellung?.value) {
    return NextResponse.json([]);
  }

  try {
    const serverUrl = await prisma.einstellung.findUnique({ where: { key: "system.nextcloud.serverUrl" } });
    const ordner = JSON.parse(einstellung.value) as { name: string; pfad: string }[];
    return NextResponse.json(
      ordner.map((o) => ({
        name: o.name,
        pfad: o.pfad,
        url: serverUrl?.value
          ? `${serverUrl.value.replace(/\/+$/, "")}/apps/files/?dir=${encodeURIComponent(o.pfad)}`
          : null,
      }))
    );
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json([]);
  }
}
