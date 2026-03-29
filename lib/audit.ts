import { prisma } from "./prisma";

export async function auditLog(params: {
  entitaet: string;
  entitaetId: number;
  aktion: "erstellt" | "geaendert" | "geloescht";
  feld?: string;
  alterWert?: string | number | null;
  neuerWert?: string | number | null;
  beschreibung?: string;
}) {
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
}

export async function auditChanges(
  entitaet: string,
  entitaetId: number,
  alterRecord: Record<string, unknown>,
  neuerRecord: Record<string, unknown>,
  felder: string[]
) {
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
}
