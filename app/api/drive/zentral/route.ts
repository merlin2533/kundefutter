import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  } catch {
    return NextResponse.json([]);
  }
}
