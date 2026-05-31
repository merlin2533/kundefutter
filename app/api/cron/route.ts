import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCurrentMeasurement } from "@/lib/pegelonline";
import { sendEmail } from "@/lib/email";
import { digestEmail } from "@/lib/email-templates";
import { ladeFirmaDaten } from "@/lib/firma";

// GET /api/cron          — führt alle Jobs aus (Docker-Hintergrundprozess, 30 min)
// GET /api/cron?status=1 — gibt nur den letzten gespeicherten Status zurück (kein Run)
// Absicherung: CRON_SECRET env-var als Bearer-Header; ohne Secret sind alle Aufrufe erlaubt.
// /api/cron ist in middleware PUBLIC_PATHS — Middleware-Auth wird nicht erzwungen.

interface JobResult {
  job: string;
  ok: boolean;
  detail?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

async function jobDigestEmail(): Promise<JobResult> {
  const t0 = Date.now();
  try {
    const cfgKeys = ["email.digest", "cron.digest.besuchstermine", "cron.digest.aufgaben", "cron.digest.mahnwesen", "cron.digest.sachkunde"];
    const cfgRows = await prisma.einstellung.findMany({ where: { key: { in: cfgKeys } } });
    const get = (k: string) => cfgRows.find((r) => r.key === k)?.value ?? "";

    const empfaenger = get("email.digest");
    if (!empfaenger) {
      return { job: "digest", ok: false, error: "Keine Digest-Adresse konfiguriert (Einstellungen → Mail)", durationMs: Date.now() - t0 };
    }

    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    const morgen = new Date(heute); morgen.setDate(morgen.getDate() + 1);
    const in90 = new Date(heute); in90.setDate(in90.getDate() + 90);

    const [besuchRaw, aufgabeRaw, mahnRaw, sachkundeRaw] = await Promise.all([
      get("cron.digest.besuchstermine") === "1"
        ? prisma.kundeAktivitaet.findMany({
            where: { typ: "besuch", datum: { gte: heute, lt: morgen } },
            include: { kunde: { select: { id: true, name: true } } },
            take: 50,
          })
        : Promise.resolve([]),
      get("cron.digest.aufgaben") === "1"
        ? prisma.aufgabe.findMany({
            where: { erledigt: false, faelligAm: { gte: heute, lt: morgen } },
            include: { kunde: { select: { name: true } } },
            take: 50,
          })
        : Promise.resolve([]),
      get("cron.digest.mahnwesen") === "1"
        ? prisma.lieferung.findMany({
            where: { status: "geliefert", bezahltAm: null, rechnungNr: { not: null } },
            include: {
              kunde: { select: { name: true } },
              positionen: { select: { menge: true, verkaufspreis: true } },
            },
            take: 100,
          })
        : Promise.resolve([]),
      get("cron.digest.sachkunde") === "1"
        ? prisma.sachkundenachweis.findMany({
            where: { gueltigBis: { lte: in90 } },
            include: { kunde: { select: { name: true } } },
            take: 50,
          })
        : Promise.resolve([]),
    ]);

    const firma = await ladeFirmaDaten();

    // Mahnwesen aufbereiten
    const mahnwesenHeute = new Date(); mahnwesenHeute.setHours(0, 0, 0, 0);
    const mahnItems: { kundeName: string; rechnungNr: string | null; betrag: number; tageUeberfaellig: number }[] = [];
    for (const l of mahnRaw) {
      const zahlungsziel = (l as { zahlungsziel?: number | null }).zahlungsziel ?? 30;
      const rechnungDatum = (l as { rechnungDatum?: Date | null }).rechnungDatum;
      const basisDatum = rechnungDatum ?? l.datum;
      const faelligAm = new Date(new Date(basisDatum as Date).getTime() + zahlungsziel * 24 * 60 * 60 * 1000);
      faelligAm.setHours(0, 0, 0, 0);
      if (mahnwesenHeute <= faelligAm) continue;
      const tage = Math.floor((mahnwesenHeute.getTime() - faelligAm.getTime()) / (24 * 60 * 60 * 1000));
      const betrag = (l as { positionen: { menge: number; verkaufspreis: number }[] }).positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
      mahnItems.push({ kundeName: l.kunde.name, rechnungNr: (l as { rechnungNr?: string | null }).rechnungNr ?? null, betrag: Math.round(betrag * 100) / 100, tageUeberfaellig: tage });
    }

    // Sachkunde aufbereiten
    const sachkundeItems = sachkundeRaw
      .filter((s) => s.gueltigBis != null)
      .map((s) => {
        const gueltigBis = new Date(s.gueltigBis!);
        const tage = Math.floor((gueltigBis.getTime() - heute.getTime()) / (24 * 60 * 60 * 1000));
        return { kundeName: s.kunde.name, typ: s.typ, gueltigBis: gueltigBis.toISOString(), tageVerblieben: tage };
      });

    const { subject, text, html } = digestEmail({
      besuchstermine: besuchRaw.map((b) => ({ kundeId: b.kunde.id, kundeName: b.kunde.name, betreff: b.betreff, datum: b.datum.toISOString() })),
      aufgaben: aufgabeRaw.map((a) => ({ id: a.id, betreff: a.betreff, faelligAm: a.faelligAm?.toISOString() ?? "", prioritaet: a.prioritaet, kundeName: a.kunde?.name ?? null })),
      mahnwesen: mahnItems,
      sachkunde: sachkundeItems,
      firma,
    });

    await sendEmail({ to: empfaenger, subject, text, html, feature: "digest" });

    return {
      job: "digest",
      ok: true,
      detail: {
        empfaenger,
        besuchstermine: besuchRaw.length,
        aufgaben: aufgabeRaw.length,
        mahnwesen: mahnItems.length,
        sachkunde: sachkundeItems.length,
      },
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      job: "digest",
      ok: false,
      error: err instanceof Error ? err.message : "Unbekannter Fehler",
      durationMs: Date.now() - t0,
    };
  }
}

async function jobPegelstaende(): Promise<JobResult> {
  const t0 = Date.now();
  try {
    const stationen = await prisma.pegelstandCache.findMany({
      select: { stationUuid: true },
    });
    let updated = 0;
    const fehler: string[] = [];
    for (const s of stationen) {
      try {
        const messung = await fetchCurrentMeasurement(s.stationUuid);
        if (messung) {
          await prisma.pegelstandCache.update({
            where: { stationUuid: s.stationUuid },
            data: {
              wert: messung.value ?? null,
              trend: messung.trend ?? null,
              messung: messung.timestamp ? new Date(messung.timestamp) : null,
              fetchedAt: new Date(),
            },
          });
          updated++;
        }
      } catch {
        fehler.push(s.stationUuid);
      }
    }
    return {
      job: "pegelstaende",
      ok: fehler.length === 0,
      detail: { stationen: stationen.length, updated, fehler },
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      job: "pegelstaende",
      ok: false,
      error: err instanceof Error ? err.message : "Unbekannter Fehler",
      durationMs: Date.now() - t0,
    };
  }
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Kein Secret → offen (für Docker-intern; in Produktion CRON_SECRET setzen)
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

async function saveStatus(ok: boolean, startedAt: string, results: JobResult[]) {
  const payload = JSON.stringify({ ok, startedAt, jobs: results });
  await prisma.einstellung.upsert({
    where: { key: "cron.letzterLauf" },
    create: { key: "cron.letzterLauf", value: payload },
    update: { value: payload },
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Status-only — kein Run
  if (req.nextUrl.searchParams.get("status") === "1") {
    const row = await prisma.einstellung.findUnique({ where: { key: "cron.letzterLauf" } }).catch(() => null);
    if (!row) return NextResponse.json({ ok: null, startedAt: null, jobs: [] });
    try { return NextResponse.json(JSON.parse(row.value)); }
    catch { return NextResponse.json({ ok: null, startedAt: null, jobs: [] }); }
  }

  const startedAt = new Date().toISOString();
  const results: JobResult[] = [];
  results.push(await jobPegelstaende());
  results.push(await jobDigestEmail());

  const allOk = results.every((r) => r.ok);
  await saveStatus(allOk, startedAt, results);

  return NextResponse.json(
    { ok: allOk, startedAt, jobs: results },
    { status: allOk ? 200 : 207 }
  );
}
