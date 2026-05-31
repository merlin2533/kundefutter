import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const STATUS_WHITELIST = new Set(["OFFEN", "BESTAETIGT", "UMGEWANDELT", "STORNIERT"]);

// GET /api/vorbestellungen?kundeId=X&status=Y&saison=Z
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);
  const status = searchParams.get("status");
  const saison = searchParams.get("saison");

  try {
    const where: { kundeId?: number; status?: string; saison?: string } = {};
    if (!isNaN(kundeId)) where.kundeId = kundeId;
    if (status) where.status = status;
    if (saison) where.saison = saison;

    const liste = await prisma.vorbestellung.findMany({
      where,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: { include: { artikel: { select: { id: true, name: true, einheit: true, standardpreis: true } } } },
      },
      orderBy: [{ bestelldatum: "desc" }],
      take: 500,
    });

    // Lieferungsdaten für Vorgangskette nachladen (lieferungId ist kein Prisma-Relation)
    const lieferungIds = liste.map(v => v.lieferungId).filter(Boolean) as number[];
    const lieferungenMap = new Map<number, { id: number; status: string; rechnungNr: string | null }>();
    if (lieferungIds.length > 0) {
      const lieferungen = await prisma.lieferung.findMany({
        where: { id: { in: lieferungIds } },
        select: { id: true, status: true, rechnungNr: true },
      });
      for (const l of lieferungen) lieferungenMap.set(l.id, l);
    }

    const result = liste.map(v => ({
      ...v,
      lieferung: v.lieferungId ? (lieferungenMap.get(v.lieferungId) ?? null) : null,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/vorbestellungen
// Body: { kundeId, saison, lieferdatum?, bestellfrist?, notiz?, positionen: [{artikelId, menge, preis?, einheit?, reservieren?}] }
// Wendet automatisch Frühbezugs-Staffeln an, wenn keine rabattProzent angegeben.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const kundeId = parseInt(String(body.kundeId), 10);
    if (isNaN(kundeId)) return NextResponse.json({ error: "kundeId erforderlich" }, { status: 400 });
    if (!body.saison?.trim()) return NextResponse.json({ error: "Saison erforderlich" }, { status: 400 });
    const positionen = Array.isArray(body.positionen) ? body.positionen : [];
    if (positionen.length === 0) return NextResponse.json({ error: "Mindestens eine Position" }, { status: 400 });

    const kunde = await prisma.kunde.findUnique({ where: { id: kundeId } });
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    // Frühbezugs-Staffel auto-anwenden, falls passend
    let rabattProzent: number | null = body.rabattProzent != null ? Number(body.rabattProzent) : null;
    if (rabattProzent == null) {
      const heute = new Date();
      const staffel = await prisma.fruehbezugsStaffel.findFirst({
        where: {
          saison: body.saison,
          aktiv: true,
          bestellfrist: { gte: heute },
          AND: [{ OR: [{ artikelId: null }, { kategorie: null }] }],
        },
        orderBy: { rabattProzent: "desc" },
      });
      if (staffel) rabattProzent = staffel.rabattProzent;
    }

    // Nummer-Generierung in Transaktion
    const jahr = new Date().getFullYear();
    const result = await prisma.$transaction(async (tx) => {
      const setting = await tx.einstellung.findUnique({ where: { key: "letzte_vorbestellnummer" } });
      const last = setting ? parseInt(setting.value, 10) || 0 : 0;
      const naechste = last + 1;
      await tx.einstellung.upsert({
        where: { key: "letzte_vorbestellnummer" },
        update: { value: String(naechste) },
        create: { key: "letzte_vorbestellnummer", value: String(naechste) },
      });
      const prefixSetting = await tx.einstellung.findUnique({
        where: { key: "system.nummernkreis.vorbestellung_prefix" },
      });
      const vbPrefix = prefixSetting?.value?.trim() || "VB";
      const nummer = `${vbPrefix}-${jahr}-${String(naechste).padStart(4, "0")}`;

      const created = await tx.vorbestellung.create({
        data: {
          nummer,
          kundeId,
          saison: body.saison.trim(),
          lieferdatum: body.lieferdatum ? new Date(body.lieferdatum) : null,
          bestellfrist: body.bestellfrist ? new Date(body.bestellfrist) : null,
          rabattProzent,
          notiz: body.notiz?.trim() || null,
          positionen: {
            create: positionen
              .filter((p: { artikelId?: number; menge?: number }) => p.artikelId && p.menge)
              .map((p: Record<string, unknown>) => ({
                artikelId: parseInt(String(p.artikelId), 10),
                menge: Number(p.menge),
                preis: p.preis != null && p.preis !== "" ? Number(p.preis) : null,
                einheit: typeof p.einheit === "string" && p.einheit ? p.einheit : "kg",
                reserviert: !!p.reservieren,
                notiz: typeof p.notiz === "string" ? p.notiz : null,
              })),
          },
        },
        include: {
          positionen: { include: { artikel: true } },
          kunde: { select: { id: true, name: true } },
        },
      });
      return created;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
