import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const einstellungen = await prisma.einstellung.findMany({
    where: { key: { startsWith: "firma." } },
  });
  const result: Record<string, string> = {};
  for (const e of einstellungen) {
    result[e.key] = e.value;
  }
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { key, value } = body as { key: string; value: string };
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key und value erforderlich" }, { status: 400 });
  }
  const einstellung = await prisma.einstellung.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  return NextResponse.json(einstellung);
}
