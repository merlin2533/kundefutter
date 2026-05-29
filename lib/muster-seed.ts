import { prisma } from "@/lib/prisma";

/**
 * Muster-Vorgabewerte für eine Neuinstallation.
 *
 * Diese Werte werden ausschließlich angelegt, wenn der jeweilige
 * Einstellungs-Schlüssel noch NICHT existiert. Bestehende Installationen
 * (mit bereits gepflegten Firmendaten) bleiben dadurch vollständig unberührt –
 * es wird nichts überschrieben.
 */
export const MUSTER_EINSTELLUNGEN: Record<string, string> = {
  // White-Label App-Name (in Navigation, Login, PWA-Titel)
  "system.appname": "AGRI-Office",

  // Firmenstammdaten – Musterbetrieb, bei Inbetriebnahme anzupassen
  "system.firmenname": "Muster Agrarhandel GmbH",
  "firma.name": "Muster Agrarhandel GmbH",
  "firma.zusatz": "Landhandel & Agrarservice",
  "firma.strasse": "Musterstraße 1",
  "firma.plz": "12345",
  "firma.ort": "Musterstadt",
  "firma.telefon": "+49 1234 56789-0",
  "firma.email": "info@muster-agrarhandel.de",
  "firma.steuernummer": "12/345/67890",
  "firma.ustIdNr": "DE123456789",
  "firma.iban": "DE12 3456 7890 1234 5678 90",
  "firma.bic": "MUSTDE12XXX",
  "firma.bank": "Musterbank Musterstadt",
  "firma.mwstSatz": "19",
  "firma.zahlungszielStandard": "30",
};

let ensured = false;

/**
 * Legt fehlende Muster-Einstellungen an. Idempotent und für mehrfache Aufrufe
 * (z. B. mehrere Serverinstanzen) durch `skipDuplicates` abgesichert.
 */
export async function ensureMusterDefaults(): Promise<void> {
  if (ensured) return;
  ensured = true;

  try {
    const vorhandene = await prisma.einstellung.findMany({
      where: { key: { in: Object.keys(MUSTER_EINSTELLUNGEN) } },
      select: { key: true },
    });
    const vorhandenKeys = new Set(vorhandene.map((e) => e.key));

    const fehlende = Object.entries(MUSTER_EINSTELLUNGEN)
      .filter(([key]) => !vorhandenKeys.has(key))
      .map(([key, value]) => ({ key, value }));

    if (fehlende.length === 0) return;

    await prisma.einstellung.createMany({ data: fehlende });
    console.log(`[muster-seed] ${fehlende.length} Muster-Einstellungen für Neuinstallation angelegt.`);
  } catch (err) {
    console.error("[muster-seed] Konnte Muster-Einstellungen nicht anlegen:", err);
  }
}
