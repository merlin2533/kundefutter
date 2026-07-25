import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { zentralOrdnerLink } from "@/lib/nextcloud";
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
    const ordner = JSON.parse(einstellung.value) as { name: string; pfad: string }[];
    const result = await Promise.all(
      ordner.map(async (o) => ({
        name: o.name,
        pfad: o.pfad,
        url: await zentralOrdnerLink(o.pfad),
      }))
    );
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json([]);
  }
}
