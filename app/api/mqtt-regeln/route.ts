import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MODI = ["ki", "direkt"] as const;
const AKTIONEN = ["lieferung", "wareneingang", "benachrichtigung"] as const;

export async function GET() {
  try {
    const regeln = await prisma.mqttRegel.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(regeln);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      source?: string;
      topicPattern?: string;
      modus?: string;
      aktion?: string;
      aktiv?: boolean;
    };

    if (!body.name?.trim()) return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
    if (!body.topicPattern?.trim()) return NextResponse.json({ error: "Topic Pattern fehlt" }, { status: 400 });
    if (!body.aktion || !AKTIONEN.includes(body.aktion as (typeof AKTIONEN)[number]))
      return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
    if (body.modus && !MODI.includes(body.modus as (typeof MODI)[number]))
      return NextResponse.json({ error: "Ungültiger Modus" }, { status: 400 });

    const regel = await prisma.mqttRegel.create({
      data: {
        name: body.name.trim(),
        source: body.source?.trim() ?? "",
        topicPattern: body.topicPattern.trim(),
        modus: (body.modus as (typeof MODI)[number]) ?? "ki",
        aktion: body.aktion as (typeof AKTIONEN)[number],
        aktiv: body.aktiv ?? true,
      },
    });
    return NextResponse.json(regel, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
