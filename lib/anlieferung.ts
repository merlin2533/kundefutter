// Gemeinsame Anlieferungs-Nummernvergabe, extrahiert aus POST /api/anlieferungen — nutzt
// dieselbe jahresbewusste naechsteNummer()-Logik wie Rechnungen/Gutschriften/Bestellungen/
// Angebote (lib/utils.ts), statt eines eigenen, nicht jahreswechselfähigen Zählers.
import { naechsteAnlieferungsnummer as berechneNaechsteAnlieferungsnummer } from "@/lib/utils";
import type { Tx } from "@/lib/lieferung";

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
