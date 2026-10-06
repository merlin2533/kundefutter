// Frühwarnung gegen versehentliche Doppelbestellungen: prüft, ob ein Kunde denselben Artikel
// bereits innerhalb des konfigurierten Zeitraums (Einstellung "firma.doppelbestellungWarnungWochen")
// bestellt hat. Bewusst nur eine Warnung, kein Block — eine Erfassungsperson soll regelmäßige
// Wiederholungsbestellungen weiterhin ohne Reibung anlegen können.

import { prisma } from "@/lib/prisma";

const DEFAULT_WOCHEN = 10;

export interface DoppelbestellungTreffer {
  lieferungId: number;
  datum: string; // ISO YYYY-MM-DD
  menge: number;
  status: string;
  wochenHer: number;
}

export async function ladeDoppelbestellungWarnzeitraumWochen(): Promise<number> {
  const e = await prisma.einstellung.findUnique({ where: { key: "firma.doppelbestellungWarnungWochen" } });
  const n = e?.value ? parseInt(e.value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WOCHEN;
}

/** Jüngste Lieferposition desselben Kunden+Artikels innerhalb des Warnzeitraums — "geplant" UND
 *  "geliefert" zählen (genau der Fall "schon besprochen, aber noch nicht ausgeliefert" ist der
 *  häufigste Auslöser einer Doppelbestellung), storniert bewusst nicht. `ausgenommenLieferungId`
 *  blendet die aktuell bearbeitete Lieferung selbst aus (z.B. beim nachträglichen Hinzufügen einer
 *  Position zu einer bestehenden Lieferung). */
export async function pruefeDoppelbestellung(
  kundeId: number,
  artikelId: number,
  ausgenommenLieferungId?: number
): Promise<DoppelbestellungTreffer | null> {
  const wochen = await ladeDoppelbestellungWarnzeitraumWochen();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - wochen * 7);

  const treffer = await prisma.lieferposition.findFirst({
    where: {
      artikelId,
      lieferung: {
        kundeId,
        status: { in: ["geliefert", "geplant"] },
        datum: { gte: cutoff },
        ...(ausgenommenLieferungId ? { id: { not: ausgenommenLieferungId } } : {}),
      },
    },
    select: { menge: true, lieferung: { select: { id: true, datum: true, status: true } } },
    orderBy: { lieferung: { datum: "desc" } },
  });

  if (!treffer) return null;

  const tageHer = Math.floor((Date.now() - treffer.lieferung.datum.getTime()) / 86_400_000);
  return {
    lieferungId: treffer.lieferung.id,
    datum: treffer.lieferung.datum.toISOString().slice(0, 10),
    menge: treffer.menge,
    status: treffer.lieferung.status,
    wochenHer: Math.max(0, Math.round(tageHer / 7)),
  };
}
