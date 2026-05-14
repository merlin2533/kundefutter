import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FUTTERWERTE, findeFutterwert, type Futterwert } from "@/lib/futterwerte";
import { NUTZUNGSARTEN, TIERARTEN, type TierartKey } from "@/lib/tierbedarf";
import {
  berechneRation,
  type RationsEingabe,
  type RationsPosition,
  type NaehrstoffWerte,
} from "@/lib/rationsberechnung";
export const dynamic = "force-dynamic";

const TIERART_KEYS: TierartKey[] = ["Rind", "Schwein", "Geflugel", "Pferd", "Schaf", "Ziege"];

// ─── ArtikelInhaltsstoff → NaehrstoffWerte (tolerante Namens-Zuordnung) ───────
const NAEHRSTOFF_ALIAS: { keys: (keyof NaehrstoffWerte)[]; alias: string[] }[] = [
  { keys: ["nel"], alias: ["nel", "nettoenergie"] },
  { keys: ["me"], alias: ["me", "umsetzbare energie", "umsetzbareenergie", "energie", "de"] },
  { keys: ["rohprotein"], alias: ["rohprotein", "xp", "protein", "rp"] },
  { keys: ["nxp"], alias: ["nxp", "nutzbares rohprotein", "nutzbaresrohprotein"] },
  { keys: ["dp"], alias: ["dp", "verdauliches rohprotein", "verd. rohprotein", "vrp", "dxp"] },
  { keys: ["rohfaser"], alias: ["rohfaser", "xf", "rf"] },
  { keys: ["andfom"], alias: ["andfom", "andf", "ndf"] },
  { keys: ["lysin"], alias: ["lysin", "lys"] },
  { keys: ["methionin"], alias: ["methionin", "met", "methionin+cystin", "ms"] },
  { keys: ["ca"], alias: ["calcium", "ca"] },
  { keys: ["p"], alias: ["phosphor", "p"] },
  { keys: ["mg"], alias: ["magnesium", "mg"] },
  { keys: ["na"], alias: ["natrium", "na"] },
];

function normalisiereMenge(menge: number, einheit: string | null | undefined, energie: boolean): number {
  const e = (einheit ?? "").toLowerCase().trim();
  if (energie) return menge; // MJ → unverändert
  if (e === "%" || e === "% tm" || e === "%tm") return menge * 10; // % der TM → g/kg TM
  if (e === "mg/kg" || e === "mg") return menge / 1000;            // mg/kg → g/kg
  if (e === "g/kg" || e === "g" || e === "" || e === "g/kg tm") return menge; // g/kg TM
  return menge; // Fallback
}

function artikelZuNaehrwerte(
  inhaltsstoffe: { name: string; menge: number | null; einheit: string | null }[],
): { werte: NaehrstoffWerte; unbekannt: string[] } {
  const werte: NaehrstoffWerte = {};
  const unbekannt: string[] = [];
  for (const stoff of inhaltsstoffe) {
    if (stoff.menge == null) continue;
    const nameLc = stoff.name.toLowerCase().trim();
    const treffer = NAEHRSTOFF_ALIAS.find((a) =>
      a.alias.some((al) => nameLc === al || nameLc.startsWith(al + " ") || nameLc.includes(al)),
    );
    if (!treffer) {
      unbekannt.push(stoff.name);
      continue;
    }
    const key = treffer.keys[0];
    const energie = key === "me" || key === "nel";
    werte[key] = normalisiereMenge(stoff.menge, stoff.einheit, energie);
  }
  return { werte, unbekannt };
}

// ─── Positionen auflösen: standard | artikel | manuell ───────────────────────
async function loesePositionen(
  rohPositionen: unknown[],
): Promise<{ positionen: RationsPosition[]; hinweise: string[] }> {
  const positionen: RationsPosition[] = [];
  const hinweise: string[] = [];

  // Artikel-IDs vorab sammeln und bulk laden (N+1 vermeiden)
  const artikelIds = rohPositionen
    .map((p) => (p as { artikelId?: number }).artikelId)
    .filter((id): id is number => typeof id === "number" && !isNaN(id));
  const artikelMap = new Map<number, { id: number; name: string; inhaltsstoffe: { name: string; menge: number | null; einheit: string | null }[] }>();
  if (artikelIds.length > 0) {
    const artikel = await prisma.artikel.findMany({
      where: { id: { in: artikelIds } },
      select: { id: true, name: true, inhaltsstoffe: { select: { name: true, menge: true, einheit: true } } },
    });
    for (const a of artikel) artikelMap.set(a.id, a);
  }

  for (const roh of rohPositionen) {
    const p = roh as Record<string, unknown>;
    const fmKg = Number(p.fmKg) || 0;
    if (fmKg <= 0) continue;
    const quelle = (p.quelle as string) || "manuell";

    if (quelle === "standard") {
      const fw: Futterwert | undefined = p.futterId
        ? FUTTERWERTE.find((f) => f.name === p.futterId)
        : findeFutterwert(String(p.futter ?? ""));
      if (!fw) {
        hinweise.push(`Standard-Futter "${p.futter}" nicht gefunden — Position übersprungen.`);
        continue;
      }
      positionen.push({
        futter: fw.name,
        quelle: "standard",
        futterId: fw.name,
        fmKg,
        tmGehalt: fw.tmGehalt,
        werte: futterwertZuNaehrwerte(fw),
        stufe: p.stufe as RationsPosition["stufe"],
      });
    } else if (quelle === "artikel") {
      const artId = Number(p.artikelId);
      const art = artikelMap.get(artId);
      if (!art) {
        hinweise.push(`Artikel #${artId} nicht gefunden — Position übersprungen.`);
        continue;
      }
      const { werte, unbekannt } = artikelZuNaehrwerte(art.inhaltsstoffe);
      if (unbekannt.length > 0) {
        hinweise.push(`Artikel "${art.name}": Inhaltsstoffe ohne Zuordnung: ${unbekannt.join(", ")}.`);
      }
      // TM-Gehalt: explizit übergeben oder Default 880 g/kg (Kraftfutter)
      const tmGehalt = Number(p.tmGehalt) || 880;
      positionen.push({
        futter: art.name,
        quelle: "artikel",
        artikelId: artId,
        fmKg,
        tmGehalt,
        werte,
        stufe: p.stufe as RationsPosition["stufe"],
      });
    } else {
      // manuell — Werte direkt übernehmen
      const werte: NaehrstoffWerte = {};
      const rohWerte = (p.werte as Record<string, unknown>) ?? {};
      for (const [k, v] of Object.entries(rohWerte)) {
        if (v != null && v !== "" && !isNaN(Number(v))) {
          (werte as Record<string, number>)[k] = Number(v);
        }
      }
      positionen.push({
        futter: String(p.futter ?? "Manuelle Position"),
        quelle: "manuell",
        fmKg,
        tmGehalt: Number(p.tmGehalt) || 880,
        werte,
        stufe: p.stufe as RationsPosition["stufe"],
      });
    }
  }
  return { positionen, hinweise };
}

function futterwertZuNaehrwerte(fw: Futterwert): NaehrstoffWerte {
  return {
    me: fw.me, nel: fw.nel, rohprotein: fw.rohprotein, nxp: fw.nxp, dp: fw.dp,
    rohfaser: fw.rohfaser, andfom: fw.andfom, lysin: fw.lysin, methionin: fw.methionin,
    ca: fw.ca, p: fw.p, mg: fw.mg, na: fw.na,
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────
// ?meta=1 → Stammdaten für die UI (Tierarten, Nutzungsarten, Futterwerte)
// ?kundeId=X | ?kundeTierId=Y → gespeicherte Berechnungen
// (kein Parameter) → letzte 50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("meta")) {
    return NextResponse.json({
      tierarten: TIERARTEN,
      nutzungsarten: NUTZUNGSARTEN,
      futterwerte: FUTTERWERTE,
    });
  }

  const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);
  const kundeTierId = parseInt(searchParams.get("kundeTierId") ?? "", 10);

  try {
    const where: { kundeId?: number; kundeTierId?: number } = {};
    if (!isNaN(kundeTierId)) where.kundeTierId = kundeTierId;
    else if (!isNaN(kundeId)) where.kundeId = kundeId;

    const liste = await prisma.rationsberechnung.findMany({
      where,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        kundeTier: { select: { id: true, name: true, tierart: true } },
      },
      orderBy: { erstellt: "desc" },
      take: 50,
    });
    return NextResponse.json(liste);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────
// Body: { tierart, nutzungsart, modus, gewicht?, leistung?, fettProzent?,
//         eiweissProzent?, positionen[], manuellerBedarf?, kundeId?, kundeTierId?,
//         speichern?, bezeichnung?, notiz? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tierart = body.tierart as TierartKey;
    if (!TIERART_KEYS.includes(tierart)) {
      return NextResponse.json({ error: "Ungültige Tierart" }, { status: 400 });
    }
    const validNutzung = NUTZUNGSARTEN[tierart] ?? [];
    if (!body.nutzungsart || !validNutzung.includes(body.nutzungsart)) {
      return NextResponse.json({ error: "Ungültige Nutzungsart" }, { status: 400 });
    }
    const modus = body.modus === "detail" ? "detail" : "simple";
    const rohPositionen = Array.isArray(body.positionen) ? body.positionen : [];
    if (rohPositionen.length === 0) {
      return NextResponse.json({ error: "Mindestens eine Futterposition erforderlich" }, { status: 400 });
    }

    const { positionen, hinweise: loeseHinweise } = await loesePositionen(rohPositionen);
    if (positionen.length === 0) {
      return NextResponse.json({ error: "Keine gültige Futterposition aufgelöst" }, { status: 400 });
    }

    const eingabe: RationsEingabe = {
      tierart,
      nutzungsart: body.nutzungsart,
      modus,
      gewicht: body.gewicht != null && body.gewicht !== "" ? Number(body.gewicht) : null,
      leistung: body.leistung != null && body.leistung !== "" ? Number(body.leistung) : null,
      fettProzent: body.fettProzent != null && body.fettProzent !== "" ? Number(body.fettProzent) : null,
      eiweissProzent: body.eiweissProzent != null && body.eiweissProzent !== "" ? Number(body.eiweissProzent) : null,
      positionen,
      manuellerBedarf: body.manuellerBedarf ?? null,
    };

    const ergebnis = berechneRation(eingabe);
    ergebnis.hinweise = [...loeseHinweise, ...ergebnis.hinweise];

    // optional speichern
    if (body.speichern) {
      const kundeId = body.kundeId ? parseInt(String(body.kundeId), 10) : null;
      const kundeTierId = body.kundeTierId ? parseInt(String(body.kundeTierId), 10) : null;
      const bezeichnung = body.bezeichnung?.trim()
        || `${tierart} ${body.nutzungsart} — ${new Date().toLocaleDateString("de-DE")}`;

      const gespeichert = await prisma.rationsberechnung.create({
        data: {
          bezeichnung,
          tierart,
          nutzungsart: body.nutzungsart,
          modus,
          kundeId: kundeId && !isNaN(kundeId) ? kundeId : null,
          kundeTierId: kundeTierId && !isNaN(kundeTierId) ? kundeTierId : null,
          gewicht: eingabe.gewicht ?? null,
          leistung: eingabe.leistung ?? null,
          parameter: JSON.stringify({ eingabe, ergebnis }),
          notiz: body.notiz?.trim() || null,
        },
      });
      return NextResponse.json({ ...ergebnis, gespeichert });
    }

    return NextResponse.json(ergebnis);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE ?id=X ────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (isNaN(id)) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  try {
    await prisma.rationsberechnung.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
