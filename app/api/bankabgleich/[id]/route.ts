import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markiereAlsBezahlt, macheBezahltRueckgaengig, type ZielTyp } from "@/lib/bankabgleich-zuordnung";
import { ladeZielFuerDifferenz, erfasseBankabgleichDifferenz, DifferenzValidierungsFehler, type DifferenzArt } from "@/lib/bankabgleich-differenz";
import { loescheGutschriftMitNebenwirkungen } from "@/lib/gutschrift";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const {
      lieferungId,
      sammelrechnungId,
      ausgabeId,
      eingangsRechnungId,
      alsBezahltMarkieren = true,
      zuordnungsArt,
      kiKonfidenz,
      ignoriert,
      differenzAktion,
    } = body as {
      lieferungId?: number | null;
      sammelrechnungId?: number | null;
      ausgabeId?: number | null;
      eingangsRechnungId?: number | null;
      alsBezahltMarkieren?: boolean;
      zuordnungsArt?: "manuell" | "automatisch" | "ki" | null;
      kiKonfidenz?: number | null;
      ignoriert?: boolean;
      /** Nur bei Zuordnung zu lieferungId/sammelrechnungId: erfasst die Differenz zwischen
       * Bankbetrag und Rechnungsbetrag als Gutschrift (Überzahlung) oder KundeForderung
       * (Fehlbetrag) — beides fließt automatisch in die nächste Rechnung des Kunden ein. */
      differenzAktion?: DifferenzArt | null;
    };

    const umsatz = await prisma.kontoumsatz.findUnique({ where: { id } });
    if (!umsatz) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Reines Aus-/Einblenden (keine Zuordnung zu einer Rechnung/Ausgabe) — eigener, einfacher Pfad,
    // der die Zuordnung selbst unangetastet lässt.
    const istNurAusblenden =
      ignoriert !== undefined &&
      lieferungId === undefined &&
      sammelrechnungId === undefined &&
      ausgabeId === undefined &&
      eingangsRechnungId === undefined;
    if (istNurAusblenden) {
      const aktualisiert = await prisma.kontoumsatz.update({ where: { id }, data: { ignoriert } });
      return NextResponse.json(aktualisiert);
    }

    if (differenzAktion && !lieferungId && !sammelrechnungId) {
      return NextResponse.json(
        { error: "Differenzbuchung (Gutschrift/Forderung) ist nur bei Zuordnung zu einer Kunden-Rechnung möglich" },
        { status: 400 }
      );
    }

    const updateData: {
      zugeordnet: boolean;
      lieferungId?: number | null;
      sammelrechnungId?: number | null;
      ausgabeId?: number | null;
      eingangsRechnungId?: number | null;
      zuordnungsArt?: string | null;
      kiKonfidenz?: number | null;
    } = { zugeordnet: true };
    if (lieferungId !== undefined) updateData.lieferungId = lieferungId ?? null;
    if (sammelrechnungId !== undefined) updateData.sammelrechnungId = sammelrechnungId ?? null;
    if (ausgabeId !== undefined) updateData.ausgabeId = ausgabeId ?? null;
    if (eingangsRechnungId !== undefined) updateData.eingangsRechnungId = eingangsRechnungId ?? null;
    if (zuordnungsArt !== undefined) updateData.zuordnungsArt = zuordnungsArt ?? null;
    if (kiKonfidenz !== undefined) updateData.kiKonfidenz = kiKonfidenz ?? null;

    const aktualisiert = await prisma.$transaction(async (tx) => {
      const result = await tx.kontoumsatz.update({ where: { id }, data: updateData });

      // Idempotenz: eine erneute Zuordnung desselben Umsatzes (z.B. Zielrechnung korrigiert)
      // darf keine zweite Teilzahlung anhäufen — vorherige, von diesem Umsatz erzeugte
      // Teilzahlung immer zuerst entfernen, danach je nach Fall neu anlegen oder nicht.
      await tx.teilzahlung.deleteMany({ where: { kontoumsatzId: id } });

      // "Als bezahlt markieren" ist ein eigener, expliziter Schritt (Default an) — kein
      // impliziter Nebeneffekt der reinen Zuordnung. Bei false bleibt das Zielobjekt offen
      // (z.B. Teilzahlung/Anzahlung).
      if (alsBezahltMarkieren) {
        const ziele: [ZielTyp, number | null | undefined][] = [
          ["lieferung", lieferungId],
          ["sammelrechnung", sammelrechnungId],
          ["ausgabe", ausgabeId],
          ["eingangsrechnung", eingangsRechnungId],
        ];
        for (const [zielTyp, zielId] of ziele) {
          if (zielId) await markiereAlsBezahlt(zielTyp, zielId, umsatz.buchungsdatum, tx);
        }
      } else if (lieferungId || sammelrechnungId) {
        // Kunde zahlt eine Rechnung in mehreren Teilbeträgen (z.B. zwei Überweisungen): die
        // Rechnung bleibt offen (bezahltAm bleibt null, taucht also weiter als Kandidat für die
        // nächste Teilzahlung auf), der erhaltene Betrag wird als Teilzahlung erfasst — sichtbar
        // auf der Lieferung/Sammelrechnung und mindert dort den offenen Betrag.
        await tx.teilzahlung.create({
          data: {
            lieferungId: lieferungId ?? null,
            sammelrechnungId: sammelrechnungId ?? null,
            betrag: umsatz.betrag,
            datum: umsatz.buchungsdatum,
            notiz: "Teilzahlung aus Bankabgleich",
            kontoumsatzId: id,
          },
        });
      }

      if (differenzAktion) {
        const zielTyp = lieferungId ? "lieferung" : "sammelrechnung";
        const zielId = (lieferungId ?? sammelrechnungId) as number;
        const ziel = await ladeZielFuerDifferenz(tx, zielTyp, zielId);
        if (!ziel) throw new Error("Zuordnungsziel für Differenzbuchung nicht gefunden");
        await erfasseBankabgleichDifferenz(tx, {
          zielTyp,
          zielId,
          kundeId: ziel.kundeId,
          diff: umsatz.betrag - ziel.betrag,
          zielBezeichnung: ziel.bezeichnung,
          bankDatum: umsatz.buchungsdatum,
          art: differenzAktion,
        });
      }

      return result;
    });

    return NextResponse.json(aktualisiert);
  } catch (err: unknown) {
    if (err instanceof DifferenzValidierungsFehler) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    Sentry.captureException(err);
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const bestehend = await prisma.kontoumsatz.findUnique({
      where: { id },
      include: { weitereZuordnungen: true },
    });
    if (!bestehend) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    // Bugfix: Aufheben der Zuordnung muss auch eine zuvor gesetzte Bezahlt-Markierung
    // zurücknehmen (nur wenn sie exakt durch diesen Umsatz gesetzt wurde), sonst bleibt das
    // Zielobjekt fälschlich als bezahlt stehen.
    const ziele: [ZielTyp, number | null][] = [
      ["lieferung", bestehend.lieferungId],
      ["sammelrechnung", bestehend.sammelrechnungId],
      ["ausgabe", bestehend.ausgabeId],
      ["eingangsrechnung", bestehend.eingangsRechnungId],
    ];
    for (const [zielTyp, zielId] of ziele) {
      if (zielId) await macheBezahltRueckgaengig(zielTyp, zielId, bestehend.buchungsdatum);
    }
    // Weitere Rechnungen (Kunde hat mehrere Rechnungen in dieser einen Überweisung beglichen)
    // hängen an der Haupt-Zuordnung — beim Aufheben ebenfalls zurücknehmen, sonst blieben sie
    // fälschlich als bezahlt stehen, während der Kontoumsatz selbst wieder offen ist.
    for (const w of bestehend.weitereZuordnungen) {
      const zielTyp: ZielTyp = w.lieferungId ? "lieferung" : "sammelrechnung";
      const zielId = (w.lieferungId ?? w.sammelrechnungId) as number;
      await macheBezahltRueckgaengig(zielTyp, zielId, bestehend.buchungsdatum);
    }
    await prisma.kontoumsatzWeitereZuordnung.deleteMany({ where: { kontoumsatzId: id } });
    // Eine über "Teilzahlung erfassen" (alsBezahltMarkieren:false) angelegte Teilzahlung gehört
    // ausschließlich zu dieser Zuordnung — beim vollständigen Aufheben ebenfalls entfernen, sonst
    // bliebe ein bereits erhaltener Teilbetrag fälschlich auf der Rechnung stehen.
    await prisma.teilzahlung.deleteMany({ where: { kontoumsatzId: id } });

    // Über den Doppelzahlungs-Flow angelegte Gutschrift (siehe /doppelzahlung) mit allen
    // Nebenwirkungen rückgängig machen — sonst bliebe sie als OFFEN/ERSTATTET stehen, obwohl
    // der Kontoumsatz, der sie ausgelöst hat, gleich wieder als offen geführt wird.
    if (bestehend.gutschriftId) {
      await prisma.$transaction((tx) => loescheGutschriftMitNebenwirkungen(tx, bestehend.gutschriftId!));
    }

    const aktualisiert = await prisma.kontoumsatz.update({
      where: { id },
      data: {
        zugeordnet: false,
        lieferungId: null,
        sammelrechnungId: null,
        ausgabeId: null,
        eingangsRechnungId: null,
        gutschriftId: null,
        zuordnungsArt: null,
        kiKonfidenz: null,
      },
    });
    return NextResponse.json(aktualisiert);
  } catch (err: unknown) {
    Sentry.captureException(err);
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
