/**
 * scripts/lade-demodaten-eierhandel.ts
 * Lädt die JSON-Fixtures aus demodaten/eierhandel/ in die Datenbank, damit sich
 * /eiersortierung, /eierkontrolle, /statistik/eier und /exporte/kat-meldung mit
 * realistischen Daten anschauen lassen. Separat von `npm run seed` (npm run seed:eierhandel),
 * da modulspezifisch und optional — siehe AGENTS.md, Abschnitt "Eierhandel-Modul → Demodaten".
 *
 * Idempotenz: Artikel.artikelnummer und Anlieferung.nummer sind @unique → echtes upsert().
 * Kunde.erzeugercode, EierSortierung und Lieferung haben KEINEN unique-Constraint im Schema
 * (siehe prisma/schema.prisma) — hier läuft die Idempotenz über findFirst()-Guard-dann-create()
 * statt echter Prisma-Upsert-Semantik: EierSortierung/Lieferung werden über einen stabilen
 * "[key]"-Tag erkannt (notiz.contains, NICHT exaktes Gleich — die Notiz ist über die UI/PUT
 * editierbar, ein exakter Vergleich würde nach einer harmlosen Notiz-Änderung erneut anlegen),
 * Kunden über erzeugercode bzw. (name+firma), Aufgaben über exaktes betreff (siehe unten,
 * für die Tierseuchenkasse-Meldung bewusst identisch zum Cron-Job berechnet).
 *
 * legedatum/datum/faelligAm stehen in den JSON-Dateien als relative Tages-Offsets
 * (legedatumOffsetTage, datumOffsetTage, faelligAmOffsetTage) — nicht als feste Daten —
 * und werden hier beim Laden in echte Daten umgerechnet, damit die MHD-Ampel-Demo nicht nach
 * wenigen Wochen veraltet.
 *
 * Sicherheitsnetz: Das Skript schreibt Kunden/Lieferungen mit echten Umsätzen — läuft es
 * versehentlich gegen eine produktive DATABASE_URL (z.B. auf einer Maschine, deren .env auf eine
 * echte Instanz zeigt), würden Demo-Datensätze mit echten Kunden/Artikeln vermischt. Bricht daher
 * hart ab, wenn die Ziel-URL nicht offensichtlich eine Dev-/Tmp-Datenbank ist — Override nur
 * explizit über ALLOW_DEMO_SEED=1 (genutzt von scripts/erzeuge-demo-backup-eierhandel.ts, das
 * selbst schon gegen eine frische Tmp-Datei arbeitet).
 */
import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { erstelleEierSortierung } from "../lib/eiersortierung";

const url = process.env.DATABASE_URL ?? "file:prisma/dev.db";

const wirktWieDevOderTmp = /dev\.db/i.test(url) || url.includes(os.tmpdir());
if (!wirktWieDevOderTmp && process.env.ALLOW_DEMO_SEED !== "1") {
  console.error(
    `Abgebrochen: DATABASE_URL ("${url}") sieht nicht nach einer Dev-/Tmp-Datenbank aus (erwartet ` +
      `z.B. "dev.db" im Pfad oder eine Datei unter ${os.tmpdir()}). Dieses Skript legt Demo-Kunden ` +
      "und -Lieferungen an — auf einer echten Instanz würden sie sich mit produktiven Daten " +
      "vermischen. Zum bewussten Überschreiben ALLOW_DEMO_SEED=1 setzen."
  );
  process.exit(1);
}

const libsqlUrl = url.startsWith("file:./") ? url.replace("file:./", "file:") : url;
const adapter = new PrismaLibSql({ url: libsqlUrl });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const DEMO_DIR = path.join(__dirname, "..", "demodaten", "eierhandel");

function ladeJson<T>(datei: string): T {
  return JSON.parse(fs.readFileSync(path.join(DEMO_DIR, datei), "utf-8")) as T;
}

function tageAb(offsetTage: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetTage);
  return d;
}

interface KundeRow {
  _key: string; _rolle: "erzeuger" | "abnehmer";
  name: string; firma?: string; kategorie?: string;
  strasse?: string; plz?: string; ort?: string;
  erzeugercode?: string; haltungsform?: number;
}
interface ArtikelRow {
  _key: string; artikelnummer: string; name: string; kategorie: string; einheit: string;
  standardpreis: number; mwstSatz: number; aktuellerBestand: number; lagerTracking: boolean;
  verpackungsart?: string;
}
interface AnlieferungRow {
  _key: string; nummer: string; datumOffsetTage: number; _kundeKey: string; _artikelKey: string;
  menge: number; einheit: string; preisProEinheit?: number; gesamtBetrag?: number; notiz?: string;
}
interface EierSortierungPositionRow {
  _artikelKey: string; gueteklasse: string; gewichtsklasse: string; menge: number;
  chargeNr?: string; legedatumOffsetTage?: number; _erzeugerKundeKey?: string;
}
interface EierSortierungRow {
  _key: string; datumOffsetTage: number; _anlieferungKey: string | null;
  notiz: string; erstelltVon?: string; positionen: EierSortierungPositionRow[];
}
interface LieferpositionRow {
  _artikelKey: string; menge: number; verkaufspreis: number; mwstSatz: number;
  gueteklasse: string; gewichtsklasse: string; legedatumOffsetTage?: number; _erzeugerKundeKey?: string;
}
interface LieferungRow {
  _key: string; _kundeKey: string; datumOffsetTage: number; status: string;
  notiz: string; positionen: LieferpositionRow[];
}
interface AufgabeRow {
  _key: string; betreff: string; faelligAmOffsetTage: number; erledigt: boolean;
  prioritaet: string; typ: string;
}

async function main() {
  console.log("Lade Eierhandel-Demodaten…");

  // ── Kunden (Erzeuger + Abnehmer) ────────────────────────────────────────────
  const kundenJson = ladeJson<KundeRow[]>("kunden.json");
  const kundeIdByKey = new Map<string, number>();
  const kundeByKey = new Map<string, KundeRow>();
  for (const k of kundenJson) {
    kundeByKey.set(k._key, k);
    const bestehend = k.erzeugercode
      ? await prisma.kunde.findFirst({ where: { erzeugercode: k.erzeugercode } })
      : await prisma.kunde.findFirst({ where: { name: k.name, firma: k.firma ?? null } });
    if (bestehend) {
      kundeIdByKey.set(k._key, bestehend.id);
      continue;
    }
    const neu = await prisma.kunde.create({
      data: {
        name: k.name,
        firma: k.firma ?? null,
        kategorie: k.kategorie ?? "Sonstige",
        strasse: k.strasse ?? null,
        plz: k.plz ?? null,
        ort: k.ort ?? null,
        erzeugercode: k.erzeugercode ?? null,
        haltungsform: k.haltungsform ?? null,
      },
    });
    kundeIdByKey.set(k._key, neu.id);
  }
  console.log(`  Kunden: ${kundeIdByKey.size} (Erzeuger + Abnehmer)`);

  // ── Artikel (echtes upsert, artikelnummer ist @unique) ──────────────────────
  const artikelJson = ladeJson<ArtikelRow[]>("artikel.json");
  const artikelIdByKey = new Map<string, number>();
  const artikelByKey = new Map<string, ArtikelRow>();
  for (const a of artikelJson) {
    artikelByKey.set(a._key, a);
    const row = await prisma.artikel.upsert({
      where: { artikelnummer: a.artikelnummer },
      update: {},
      create: {
        artikelnummer: a.artikelnummer,
        name: a.name,
        kategorie: a.kategorie,
        einheit: a.einheit,
        standardpreis: a.standardpreis,
        mwstSatz: a.mwstSatz,
        aktuellerBestand: a.aktuellerBestand,
        lagerTracking: a.lagerTracking,
        verpackungsart: a.verpackungsart ?? null,
      },
    });
    artikelIdByKey.set(a._key, row.id);
  }
  console.log(`  Artikel: ${artikelIdByKey.size}`);

  // ── Anlieferungen (echtes upsert, nummer ist @unique) ───────────────────────
  const anlieferungenJson = ladeJson<AnlieferungRow[]>("anlieferungen.json");
  const anlieferungIdByKey = new Map<string, number>();
  for (const a of anlieferungenJson) {
    const kundeId = kundeIdByKey.get(a._kundeKey);
    const artikelId = artikelIdByKey.get(a._artikelKey);
    if (!kundeId || !artikelId) throw new Error(`Anlieferung ${a._key}: Kunde/Artikel-Key nicht gefunden`);
    const row = await prisma.anlieferung.upsert({
      where: { nummer: a.nummer },
      update: {},
      create: {
        nummer: a.nummer,
        datum: tageAb(a.datumOffsetTage),
        kundeId,
        artikelId,
        menge: a.menge,
        einheit: a.einheit,
        preisProEinheit: a.preisProEinheit ?? null,
        gesamtBetrag: a.gesamtBetrag ?? null,
        notiz: a.notiz ?? null,
      },
    });
    anlieferungIdByKey.set(a._key, row.id);
  }
  console.log(`  Anlieferungen: ${anlieferungIdByKey.size}`);

  // ── EierSortierungen (findFirst-Guard über [key]-Tag im notiz, kein unique-Constraint) ──
  // Nutzt dieselbe erstelleEierSortierung()-Funktion wie POST /api/eiersortierung (Lagerbewegung
  // "eingang" + Artikel.aktuellerBestand-Update) — sonst bleiben die Demo-Artikel bei Bestand 0
  // und ein späteres Löschen einer Demo-Sortierung über die UI (bucht eine Rückbuchung) treibt
  // den Bestand ins Negative. Eine künftige Erzeugerabrechnungs-Kopplung o.ä. greift dadurch
  // automatisch auch bei geseedeten Demo-Sortierungen.
  const sortierungenJson = ladeJson<EierSortierungRow[]>("eiersortierungen.json");
  let sortierungenNeu = 0;
  for (const s of sortierungenJson) {
    const keyTag = `[${s._key}]`;
    const vorhanden = await prisma.eierSortierung.findFirst({ where: { notiz: { contains: keyTag } } });
    if (vorhanden) continue;
    const anlieferungId = s._anlieferungKey ? anlieferungIdByKey.get(s._anlieferungKey) ?? null : null;

    const positionen = s.positionen.map((p) => {
      const artikelId = artikelIdByKey.get(p._artikelKey);
      if (!artikelId) throw new Error(`Sortierung ${s._key}: Artikel-Key ${p._artikelKey} nicht gefunden`);
      const erzeugercode = p._erzeugerKundeKey ? kundeByKey.get(p._erzeugerKundeKey)?.erzeugercode ?? null : null;
      return {
        artikelId,
        gueteklasse: p.gueteklasse,
        gewichtsklasse: p.gewichtsklasse,
        menge: p.menge,
        chargeNr: p.chargeNr ?? null,
        legedatum: p.legedatumOffsetTage !== undefined ? tageAb(p.legedatumOffsetTage) : null,
        erzeugercode,
      };
    });

    await prisma.$transaction(async (tx) => {
      await erstelleEierSortierung(tx, {
        datum: tageAb(s.datumOffsetTage),
        anlieferungId,
        notiz: s.notiz,
        erstelltVon: s.erstelltVon ?? null,
        positionen,
      });
    });
    sortierungenNeu++;
  }
  console.log(`  Ei-Sortierungen: ${sortierungenNeu} neu (von ${sortierungenJson.length})`);

  // ── Lieferungen (findFirst-Guard über [key]-Tag im notiz, kein unique-Constraint) ──
  const lieferungenJson = ladeJson<LieferungRow[]>("lieferungen.json");
  let lieferungenNeu = 0;
  for (const l of lieferungenJson) {
    const keyTag = `[${l._key}]`;
    const vorhanden = await prisma.lieferung.findFirst({ where: { notiz: { contains: keyTag } } });
    if (vorhanden) continue;
    const kundeId = kundeIdByKey.get(l._kundeKey);
    if (!kundeId) throw new Error(`Lieferung ${l._key}: Kunde-Key nicht gefunden`);
    await prisma.lieferung.create({
      data: {
        kundeId,
        datum: tageAb(l.datumOffsetTage),
        status: l.status,
        notiz: l.notiz,
        positionen: {
          create: l.positionen.map((p) => {
            const artikelId = artikelIdByKey.get(p._artikelKey);
            if (!artikelId) throw new Error(`Lieferung ${l._key}: Artikel-Key ${p._artikelKey} nicht gefunden`);
            const erzeugercode = p._erzeugerKundeKey ? kundeByKey.get(p._erzeugerKundeKey)?.erzeugercode ?? null : null;
            return {
              artikelId,
              menge: p.menge,
              verkaufspreis: p.verkaufspreis,
              mwstSatz: p.mwstSatz,
              gueteklasse: p.gueteklasse,
              gewichtsklasse: p.gewichtsklasse,
              legedatum: p.legedatumOffsetTage !== undefined ? tageAb(p.legedatumOffsetTage) : null,
              erzeugercode,
              // Snapshot aus Artikel.verpackungsart, analog zur echten Lieferungserfassung
              // (lib/lieferung.ts erstelleLieferungTransaktion()) — dieses Skript legt
              // Lieferpositionen direkt per prisma.lieferung.create() an, dupliziert die
              // Übernahme hier deshalb bewusst.
              verpackungsart: artikelByKey.get(p._artikelKey)?.verpackungsart ?? null,
            };
          }),
        },
      },
    });
    lieferungenNeu++;
  }
  console.log(`  Lieferungen: ${lieferungenNeu} neu (von ${lieferungenJson.length})`);

  // ── Aufgaben (findFirst-Guard über exaktes betreff, kein unique-Constraint) ──
  // Die Tierseuchenkasse-Zeile bekommt betreff/faelligAm NICHT aus der JSON-Datei, sondern wird
  // hier exakt wie in pruefeMeldepflichten() (lib/meldepflichten.ts) berechnet — der dortige Cron
  // legt bei abweichendem Text sonst eine ZWEITE, echte Tierseuchenkasse-Aufgabe an (exakter
  // betreff-Vergleich dort, keine Präfix-Prüfung wie bei KAT). Bewusst dupliziert statt
  // importiert, analog zur MUSTER_EINSTELLUNGEN-Duplikation in
  // scripts/erzeuge-demo-backup-eierhandel.ts — bei Änderung an pruefeMeldepflichten() beide
  // Stellen nachziehen.
  function tierseuchenkasseDemoAufgabe(): { betreff: string; faelligAm: Date } {
    const heute = new Date();
    const jahrDerFrist = heute > new Date(heute.getFullYear(), 0, 31, 23, 59, 59)
      ? heute.getFullYear() + 1
      : heute.getFullYear();
    return {
      betreff: `Tierseuchenkasse-Meldung ${jahrDerFrist} fällig (Jahreshöchstbesatz Legehennen)`,
      faelligAm: new Date(jahrDerFrist, 0, 31, 23, 59, 59),
    };
  }

  const aufgabenJson = ladeJson<AufgabeRow[]>("aufgaben.json");
  let aufgabenNeu = 0;
  for (const a of aufgabenJson) {
    const override = a._key === "aufgabe-tierseuchenkasse" ? tierseuchenkasseDemoAufgabe() : null;
    const betreff = override?.betreff ?? a.betreff;
    const faelligAm = override?.faelligAm ?? tageAb(a.faelligAmOffsetTage);
    const vorhanden = await prisma.aufgabe.findFirst({ where: { betreff } });
    if (vorhanden) continue;
    await prisma.aufgabe.create({
      data: { betreff, faelligAm, erledigt: a.erledigt, prioritaet: a.prioritaet, typ: a.typ },
    });
    aufgabenNeu++;
  }
  console.log(`  Aufgaben (Meldepflichten): ${aufgabenNeu} neu (von ${aufgabenJson.length})`);

  console.log("Eierhandel-Demodaten geladen. Hinweis: modul.eierhandel muss unter /einstellungen/module eingeschaltet sein, damit die Seiten sichtbar sind.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
