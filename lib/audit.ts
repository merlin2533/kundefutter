import { prisma } from "./prisma";
import { log } from "./logger";

/**
 * Beide Funktionen werden an über einem Dutzend Stellen als
 * `void auditLog(...)` fire-and-forget aufgerufen. Ohne eigenes try/catch wäre
 * ein DB-Fehler hier nur eine kontextlose Unhandled Rejection — ohne Bezug zu
 * Entität, ID oder Aktion. Bewusst NICHT weiterwerfen: die Aufrufer erwarten
 * kein Ergebnis, und ein Rethrow erzeugte wieder eine Unhandled Rejection.
 */
export async function auditLog(params: {
  entitaet: string;
  entitaetId: number;
  aktion: "erstellt" | "geaendert" | "geloescht";
  feld?: string;
  alterWert?: string | number | null;
  neuerWert?: string | number | null;
  beschreibung?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        entitaet: params.entitaet,
        entitaetId: params.entitaetId,
        aktion: params.aktion,
        feld: params.feld ?? null,
        alterWert: params.alterWert != null ? String(params.alterWert) : null,
        neuerWert: params.neuerWert != null ? String(params.neuerWert) : null,
        beschreibung: params.beschreibung ?? null,
      },
    });
  } catch (err) {
    log.error("Audit-Log konnte nicht geschrieben werden", err, {
      entitaet: params.entitaet,
      entitaetId: params.entitaetId,
      aktion: params.aktion,
      feld: params.feld,
    });
  }
}

export async function auditChanges(
  entitaet: string,
  entitaetId: number,
  alterRecord: Record<string, unknown>,
  neuerRecord: Record<string, unknown>,
  felder: string[]
) {
  try {
    const rows = felder
      .filter((feld) => String(alterRecord[feld] ?? "") !== String(neuerRecord[feld] ?? ""))
      .map((feld) => ({
        entitaet,
        entitaetId,
        aktion: "geaendert",
        feld,
        alterWert: alterRecord[feld] != null ? String(alterRecord[feld]) : null,
        neuerWert: neuerRecord[feld] != null ? String(neuerRecord[feld]) : null,
        beschreibung: null,
      }));
    if (rows.length > 0) {
      await prisma.auditLog.createMany({ data: rows });
    }
  } catch (err) {
    log.error("Audit-Änderungen konnten nicht geschrieben werden", err, {
      entitaet,
      entitaetId,
      felder,
    });
  }
}
