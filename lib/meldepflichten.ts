/**
 * lib/meldepflichten.ts
 * Fristen-Tracker für Eierhandel-Meldepflichten (siehe AGENTS.md "Was braucht der Eierbetrieb"):
 * jährliche Tierseuchenkasse-Tierzahlmeldung (Stichtag 01.01., Frist 31.01.) und die
 * wöchentliche KAT-Warenstrommeldung. Legt bei Fälligkeit eine `Aufgabe` an (kein neuer
 * Melde-Typ, um die bestehende Aufgaben-Whitelist nicht anfassen zu müssen) — eingebunden über
 * den bestehenden Cron-Mechanismus (app/api/cron/route.ts), gleiches Muster wie jobNextcloudSync.
 */
import { prisma } from "@/lib/prisma";
import { getModulConfig } from "@/lib/modul-config";

const KAT_ERINNERUNG_KEY = "system.meldepflichten.letzteKatErinnerung";
const KAT_INTERVALL_MS = 7 * 24 * 60 * 60 * 1000;

export interface MeldepflichtenErgebnis {
  uebersprungen?: string;
  tierseuchenkasseAngelegt: boolean;
  katErinnerungAngelegt: boolean;
}

export async function pruefeMeldepflichten(): Promise<MeldepflichtenErgebnis> {
  const modul = await getModulConfig();
  if (!modul.eierhandel) {
    return { uebersprungen: "Modul eierhandel deaktiviert", tierseuchenkasseAngelegt: false, katErinnerungAngelegt: false };
  }

  const heute = new Date();
  let tierseuchenkasseAngelegt = false;
  let katErinnerungAngelegt = false;

  // ─── Tierseuchenkasse: jährliche Tierzahlmeldung, Frist 31.01. ──────────────
  // Zielt immer auf die NÄCHSTE noch bevorstehende Frist — nicht auf "dieses Jahr" — sonst
  // wäre der Job vom 01.02. bis 31.12. jedes Jahr komplett wirkungslos (Frist bereits
  // verstrichen, `heute <= frist` nie mehr wahr bis zum nächsten Jahreswechsel).
  const jahrDerFrist = heute > new Date(heute.getFullYear(), 0, 31, 23, 59, 59)
    ? heute.getFullYear() + 1
    : heute.getFullYear();
  const frist = new Date(jahrDerFrist, 0, 31, 23, 59, 59);
  const betreff = `Tierseuchenkasse-Meldung ${jahrDerFrist} fällig (Jahreshöchstbesatz Legehennen)`;
  const bestehend = await prisma.aufgabe.findFirst({ where: { betreff } });
  if (!bestehend) {
    await prisma.aufgabe.create({
      data: { betreff, faelligAm: frist, prioritaet: "hoch", typ: "aufgabe", erledigt: false },
    });
    tierseuchenkasseAngelegt = true;
  }

  // ─── KAT-Wochenmeldung: alle 7 Tage an die Erfassung erinnern ───────────────
  // Zusätzlich zum Zeitintervall wird geprüft, ob die vorherige Erinnerung noch offen ist —
  // sonst würde ein unbeaufsichtigter Server alle 7 Tage eine weitere Aufgabe anlegen, ohne
  // dass je eine als erledigt markiert wird (unbegrenzt wachsende Aufgabenliste).
  const offeneKatAufgabe = await prisma.aufgabe.findFirst({
    where: { erledigt: false, betreff: { startsWith: "KAT-Wochenmeldung erfassen" } },
  });
  const letzteRow = await prisma.einstellung.findUnique({ where: { key: KAT_ERINNERUNG_KEY } });
  const letzte = letzteRow ? new Date(letzteRow.value) : null;
  if (!offeneKatAufgabe && (!letzte || heute.getTime() - letzte.getTime() >= KAT_INTERVALL_MS)) {
    const faelligAm = new Date(heute);
    faelligAm.setDate(faelligAm.getDate() + 2);
    await prisma.aufgabe.create({
      data: {
        betreff: `KAT-Wochenmeldung erfassen (Woche bis ${heute.toLocaleDateString("de-DE")})`,
        faelligAm,
        prioritaet: "normal",
        typ: "aufgabe",
        erledigt: false,
      },
    });
    await prisma.einstellung.upsert({
      where: { key: KAT_ERINNERUNG_KEY },
      create: { key: KAT_ERINNERUNG_KEY, value: heute.toISOString() },
      update: { value: heute.toISOString() },
    });
    katErinnerungAngelegt = true;
  }

  return { tierseuchenkasseAngelegt, katErinnerungAngelegt };
}
