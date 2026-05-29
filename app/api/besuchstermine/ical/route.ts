import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppName } from "@/lib/appinfo";

export const dynamic = "force-dynamic";

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(_req: NextRequest) {
  const now = new Date();

  try {
    const appName = await getAppName();
    const slug = appName.toLowerCase().replace(/\s+/g, "") || "agri-office";

    const termine = await prisma.kundeAktivitaet.findMany({
      where: {
        typ: "besuch",
        datum: { gte: now },
      },
      include: {
        kunde: { select: { id: true, name: true, firma: true, strasse: true, ort: true, plz: true } },
      },
      orderBy: { datum: "asc" },
      take: 500,
    });

    const events = termine.map((t) => {
      const start = t.datum;
      const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 Stunde
      const kundeName = t.kunde.firma
        ? `${t.kunde.name} (${t.kunde.firma})`
        : t.kunde.name;
      const summary = `${t.betreff} – ${kundeName}`;
      const description = t.inhalt ? escapeIcalText(t.inhalt) : "";
      const location = [t.kunde.strasse, t.kunde.plz, t.kunde.ort]
        .filter(Boolean)
        .join(", ");

      return [
        "BEGIN:VEVENT",
        `UID:besuch-${t.id}@${slug}`,
        `DTSTAMP:${formatIcalDate(new Date())}`,
        `DTSTART:${formatIcalDate(start)}`,
        `DTEND:${formatIcalDate(end)}`,
        `SUMMARY:${escapeIcalText(summary)}`,
        description ? `DESCRIPTION:${description}` : null,
        location ? `LOCATION:${escapeIcalText(location)}` : null,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    });

    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//${appName}//Besuchstermine//DE`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${appName} Besuchstermine`,
      "X-WR-TIMEZONE:Europe/Berlin",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(ical, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="besuchstermine.ics"',
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("iCal GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
