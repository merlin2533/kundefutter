import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { naechsteAnlieferungsnummer } from "@/lib/anlieferung";
import {
  parseAnlieferungZeile,
  resolveAnlieferungKunde,
  resolveArtikelRef,
  AnlieferungImportZeilenFehler,
} from "@/lib/anlieferung-import";

export const dynamic = "force-dynamic";

/** Erkennt einen P2002 (Unique-Constraint-Verletzung) speziell auf (kundeId, externeNr) —
 * NICHT jeden P2002. Die betroffenen Spalten stecken je nach Treiber-Adapter unterschiedlich
 * im Fehlerobjekt: bei anderen Prisma-Providern üblicherweise unter `meta.target`, beim hier
 * verwendeten @prisma/adapter-libsql (SQLite) stattdessen unter
 * `meta.driverAdapterError.cause.constraint.fields` (empirisch verifiziert) — beide Formen
 * werden geprüft, damit die Erkennung auch bei einem künftigen Adapter-Wechsel nicht lautlos
 * ausfällt. */
function istExterneNrKollision(err: unknown): boolean {
  if (!err || typeof err !== "object" || (err as { code?: string }).code !== "P2002") return false;
  const meta = (err as { meta?: Record<string, unknown> }).meta;
  const driverFields = (meta?.driverAdapterError as { cause?: { constraint?: { fields?: unknown } } } | undefined)
    ?.cause?.constraint?.fields;
  const fields = Array.isArray(driverFields) ? driverFields : Array.isArray(meta?.target) ? meta?.target : [];
  return Array.isArray(fields) && fields.includes("externeNr");
}

// POST /api/anlieferungen/import — Commit-Schritt nach der Vorschau (.../import/vorschau).
// Jede Zeile läuft in einer EIGENEN kurzen Transaktion (Nummernvergabe + Create) statt einer
// einzigen Transaktion über die gesamte Datei — bei vielen Zeilen würde eine einzelne
// interaktive Prisma-Transaktion sonst das Standard-Timeout überschreiten.
export async function POST(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "erzeugerabrechnung");
    if (denyModul) return denyModul;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    // raw:true — sonst wandelt SheetJS beim CSV-Parsen zahlenartigen Text VOR jeder
    // eigenen Verarbeitung in JS-Numbers um (deutsches Dezimalkomma "1,5" -> 15, führende
    // Nullen einer Belegnummer "007" -> 7) und unterläuft damit parseNumber()/pickCol().
    // Bei echten .xlsx-Dateien bleiben Zahl-/Datumszellen davon unberührt (Zelltyp steht
    // bereits in der Datei, nicht aus Text erraten) — parseImportDatum() erkennt einen
    // echten Excel-Datums-Seriencode weiterhin korrekt.
    const wb = XLSX.read(buffer, { type: "buffer", raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "Keine Zeilen in der Datei gefunden" }, { status: 400 });
    }

    const ergebnisse: { ok: number; uebersprungen: number; fehler: { zeile: number; grund: string }[]; created: number[] } = {
      ok: 0,
      uebersprungen: 0,
      fehler: [],
      created: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const zeileNr = i + 2;
      const geparst = parseAnlieferungZeile(rows[i], zeileNr);
      if (!geparst.ok) {
        ergebnisse.fehler.push(geparst.fehler);
        continue;
      }
      const z = geparst.zeile;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const kunde = await resolveAnlieferungKunde(tx, z.kundeName);
          if ("error" in kunde) throw new AnlieferungImportZeilenFehler(kunde.error);
          const artikel = await resolveArtikelRef(tx, z.artikelRef);
          if ("error" in artikel) throw new AnlieferungImportZeilenFehler(artikel.error);

          if (z.externeNr) {
            const vorhanden = await tx.anlieferung.findFirst({
              where: { kundeId: kunde.id, externeNr: z.externeNr },
              select: { id: true },
            });
            if (vorhanden) return { skipped: true as const, id: null };
          }

          const nummer = await naechsteAnlieferungsnummer(tx);
          const gesamtBetrag = z.preisProEinheit != null
            ? Math.round(z.preisProEinheit * z.menge * 100) / 100
            : null;

          const angelegt = await tx.anlieferung.create({
            data: {
              nummer,
              datum: z.datum,
              kundeId: kunde.id,
              artikelId: artikel.id,
              menge: z.menge,
              einheit: z.einheit,
              feuchte: z.feuchte,
              qualitaet: z.qualitaet,
              preisProEinheit: z.preisProEinheit,
              gesamtBetrag,
              notiz: z.notiz,
              externeNr: z.externeNr,
            },
          });
          return { skipped: false as const, id: angelegt.id };
        });

        if (result.skipped) {
          ergebnisse.uebersprungen++;
        } else if (result.id !== null) {
          ergebnisse.ok++;
          ergebnisse.created.push(result.id);
        }
      } catch (err) {
        if (err instanceof AnlieferungImportZeilenFehler) {
          ergebnisse.fehler.push({ zeile: zeileNr, grund: err.message });
          continue;
        }
        // Zwei zeitgleiche Import-Läufe (z.B. derselben Datei doppelt hochgeladen) können
        // zwischen dem findFirst-Vorabcheck und dem create() derselben Zeile eine echte
        // Race entstehen lassen — der DB-Unique-Index (kundeId, externeNr) verhindert dann
        // zwar zuverlässig ein Duplikat, aber als P2002-Fehler statt als "übersprungen".
        // NUR die externeNr-Kollision so behandeln (Prüfung auf die betroffenen Spalten) —
        // ein P2002 auf einen anderen Unique-Index (z.B. Anlieferung.nummer, etwa weil der
        // Zähler nach einer Backup-Wiederherstellung hinter bereits vorhandenen Nummern
        // zurückliegt) ist ein echter Fehler und darf nicht stillschweigend als "übersprungen"
        // verschwinden.
        if (istExterneNrKollision(err)) {
          ergebnisse.uebersprungen++;
          continue;
        }
        Sentry.captureException(err);
        const isDev = process.env.NODE_ENV === "development";
        const msg = isDev && err instanceof Error ? err.message : "DB-Fehler";
        ergebnisse.fehler.push({ zeile: zeileNr, grund: msg });
      }
    }

    return NextResponse.json(ergebnisse);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Import fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
