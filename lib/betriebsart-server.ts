import { prisma } from "@/lib/prisma";
import { BETRIEBSART_KEY, parseBetriebsart, type BetriebsartKey } from "@/lib/betriebsart";

/** Server-seitiger Lesezugriff auf die eingestellte Betriebsart. Bewusst getrennt von
 *  lib/betriebsart.ts, damit diese Datei importfrei und client-sicher bleibt. */
export async function getBetriebsart(): Promise<BetriebsartKey> {
  const row = await prisma.einstellung.findUnique({ where: { key: BETRIEBSART_KEY } });
  return parseBetriebsart(row?.value);
}
