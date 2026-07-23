import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


export async function GET() {
  const einstellung = await prisma.einstellung.findUnique({
    where: { key: "system.google.zentralOrdnerIds" },
  });

  if (!einstellung?.value) {
    return NextResponse.json([]);
  }

  try {
    const ordner = JSON.parse(einstellung.value) as { name: string; id: string }[];
    return NextResponse.json(
      ordner.map((o) => ({
        name: o.name,
        id: o.id,
        url: `https://drive.google.com/drive/folders/${o.id}`,
      }))
    );
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json([]);
  }
}
