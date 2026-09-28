// Gemeinsame Anlieferungs-Nummernvergabe, extrahiert aus POST /api/anlieferungen — nutzt
// dieselbe jahresbewusste naechsteNummer()-Logik wie Rechnungen/Gutschriften/Bestellungen/
// Angebote (lib/utils.ts), statt eines eigenen, nicht jahreswechselfähigen Zählers.
// Relative statt @/-Importe: analog lib/eiersortierung.ts client-/ts-node-sicher gehalten,
// falls dieses Modul künftig auch von einem Skript außerhalb der Next.js-Laufzeit genutzt wird.
import { naechsteAnlieferungsnummer as berechneNaechsteAnlieferungsnummer } from "./utils";
import type { Tx } from "./lieferung";

const ANLIEFERUNG_NUMMER_KEY = "letzte_anlieferungsnummer";

/** Vergibt und persistiert die nächste Anlieferungsnummer (ANL-JJJJ-NNNN) innerhalb einer
 * bereits offenen Transaktion. */
export async function naechsteAnlieferungsnummer(tx: Tx): Promise<string> {
  const setting = await tx.einstellung.findFirst({ where: { key: ANLIEFERUNG_NUMMER_KEY } });
  const nummer = berechneNaechsteAnlieferungsnummer(setting?.value ?? null);
  await tx.einstellung.upsert({
    where: { key: ANLIEFERUNG_NUMMER_KEY },
    create: { key: ANLIEFERUNG_NUMMER_KEY, value: nummer },
    update: { value: nummer },
  });
  return nummer;
}

/** Notiz-Präfix, mit dem eine im gradierten Modus (aus dem Sortierergebnis) erstellte
 * Erzeugerabrechnung-Gutschrift markiert wird — unterscheidet sie von einer im einfachen Modus
 * (Anlieferung.menge × preisProEinheit) erstellten Gutschrift, die dasselbe grund-Feld trägt.
 * Genutzt sowohl bei der Gutschrift-Erstellung (app/api/anlieferungen/[id]/gutschrift/route.ts)
 * als auch beim Löschen der letzten verknüpften EierSortierung (app/api/eiersortierung/[id]/
 * route.ts): dort wird eine dadurch leer gewordene Gutschrift nur automatisch entfernt, wenn sie
 * tatsächlich aus Sortierdaten gebaut wurde — eine unabhängig im einfachen Modus erstellte
 * Gutschrift (z.B. schon vor der ersten Sortierung angelegt) bleibt unangetastet. Die Notiz ist
 * über die generische Gutschrift-PUT-Route theoretisch überschreibbar, solange OFFEN — als
 * Heuristik für den Alltagsfall ausreichend, ohne dafür ein eigenes Schema-Feld einzuführen. */
export const GRADIERTE_ERZEUGERABRECHNUNG_MARKER = "Erzeugerabrechnung aus Sortierergebnis:";

export function istGradierteErzeugerabrechnung(notiz: string | null | undefined): boolean {
  return !!notiz && notiz.includes(GRADIERTE_ERZEUGERABRECHNUNG_MARKER);
}
