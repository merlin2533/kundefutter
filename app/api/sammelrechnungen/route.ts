import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const status = searchParams.get("status"); // offen | bezahlt | alle

  const where: Record<string, unknown> = {};
  if (kundeId) {
    const id = parseInt(kundeId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    where.kundeId = id;
  }
  if (status === "bezahlt") where.bezahltAm = { not: null };
  if (status === "offen") where.bezahltAm = null;

  try {
    const sammelrechnungen = await prisma.sammelrechnung.findMany({
      where,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        lieferungen: {
          select: {
            id: true,
            datum: true,
            positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(sammelrechnungen);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Sammelrechnungen GET:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kundeId, lieferungIds, notiz, zahlungsziel } = body as {
      kundeId: number;
      lieferungIds: number[];
      notiz?: string;
      zahlungsziel?: number;
    };

    if (!kundeId || !Array.isArray(lieferungIds) || lieferungIds.length === 0) {
      return NextResponse.json({ error: "kundeId und lieferungIds sind Pflichtfelder" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Prüfen ob Lieferungen bereits eine Sammelrechnung haben
      const bereitsZugewiesen = await tx.lieferung.findMany({
        where: { id: { in: lieferungIds }, sammelrechnungId: { not: null } },
        select: { id: true },
      });
      if (bereitsZugewiesen.length > 0) {
        throw new Error(`Lieferungen [${bereitsZugewiesen.map((l) => l.id).join(", ")}] sind bereits einer Sammelrechnung zugewiesen`);
      }

      const [einstellung, prefixSetting] = await Promise.all([
        tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } }),
        tx.einstellung.findUnique({ where: { key: "system.nummernkreis.rechnung_prefix" } }),
      ]);
      const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null, prefixSetting?.value || "RE");

      // Doppelte Rechnungsnummern verhindern
      const [kollisionLieferung, kollisionSammel] = await Promise.all([
        tx.lieferung.findFirst({ where: { rechnungNr }, select: { id: true } }),
        tx.sammelrechnung.findFirst({ where: { rechnungNr }, select: { id: true } }),
      ]);
      if (kollisionLieferung || kollisionSammel) {
        throw new Error(`Rechnungsnummer ${rechnungNr} ist bereits vergeben – bitte den Zählerstand unter Einstellungen › Nummernkreise korrigieren`);
      }

      await tx.einstellung.upsert({
        where: { key: "letzte_rechnungsnummer" },
        update: { value: rechnungNr },
        create: { key: "letzte_rechnungsnummer", value: rechnungNr },
      });

      const sammelrechnung = await tx.sammelrechnung.create({
        data: {
          kundeId,
          rechnungNr,
          rechnungDatum: new Date(),
          zahlungsziel: zahlungsziel ?? 30,
          notiz: notiz?.trim() || null,
        },
      });

      await tx.lieferung.updateMany({
        where: { id: { in: lieferungIds } },
        data: { sammelrechnungId: sammelrechnung.id },
      });

      return tx.sammelrechnung.findUnique({
        where: { id: sammelrechnung.id },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          lieferungen: {
            select: {
              id: true,
              datum: true,
              positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Sammelrechnung POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
