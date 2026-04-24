import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s) return null;
  // Deutsch "1.234,56" → 1234.56 ; Punkt als Tausender nur, wenn Komma vorhanden
  const cleaned = s.includes(",")
    ? s.replace(/[^0-9.,\-]/g, "").replace(/\./g, "").replace(",", ".")
    : s.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pickCol(row: Record<string, unknown>, ...keys: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-().:€]/g, "");
  const lookup: Record<string, unknown> = {};
  for (const k of Object.keys(row)) lookup[norm(k)] = row[k];
  for (const key of keys) {
    const v = lookup[norm(key)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[\s\-_/,.]+/g, " ").trim();
}

type MatchKandidat = {
  id: number;
  artikelnummer: string;
  name: string;
  liefergroesse: string | null;
  einheit: string;
  aktuellerEk: number | null;
};

type ZeileErgebnis = {
  quelle: string;           // Originaltext aus Excel
  ekNeu: number;            // neuer EK-Preis
  match: MatchKandidat | null;
  matchArt: "exakt" | "mitGebinde" | "enthaelt" | "keiner";
  alternativen: MatchKandidat[]; // Top 3 falls match unsicher/keiner
};

// ─── GET: Vorlage oder Lieferantenliste ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action");

  if (action === "template") {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Artikel", "EK-Preis"],
      ["Weizen 25 kg Sack", 18.50],
      ["Gerste Big Bag 600 kg", 315.00],
      ["Mineralfutter Pferd 25 kg", 42.90],
    ]);
    ws["!cols"] = [{ wch: 50 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Preisliste");

    const hinweise = XLSX.utils.json_to_sheet([
      { Spalte: "Artikel", Pflicht: "Ja", Hinweis: "Artikelname, optional mit Gebindegröße (z.B. \"Weizen 25 kg Sack\"). Alternativ: Artikelname, Bezeichnung, Name, Produkt." },
      { Spalte: "EK-Preis", Pflicht: "Ja", Hinweis: "Einkaufspreis netto in €. Deutsches Format (1.234,56) oder international (1234.56). Alternativ: EK, Einkaufspreis, Preis." },
      { Spalte: "",        Pflicht: "",    Hinweis: "Der Import ordnet die Zeilen einem Lieferanten zu. Auswahl erfolgt auf der Import-Seite." },
      { Spalte: "",        Pflicht: "",    Hinweis: "Vorhandene EK-Preise werden aktualisiert, Artikel-Lieferant-Zuordnungen ggf. neu angelegt." },
    ]);
    hinweise["!cols"] = [{ wch: 14 }, { wch: 8 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(wb, hinweise, "Hinweise");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="preisliste-vorlage.xlsx"',
      },
    });
  }

  if (action === "lieferanten") {
    try {
      const lieferanten = await prisma.lieferant.findMany({
        where: { aktiv: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 500,
      });
      return NextResponse.json({ lieferanten });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Lieferanten konnten nicht geladen werden" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
}

// ─── POST multipart: Analyse (Vorschau) ──────────────────────────────────────
// ─── POST JSON: Import anwenden ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  // Analyse / Vorschau
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      const lieferantIdRaw = formData.get("lieferantId");
      const lieferantId = lieferantIdRaw ? parseInt(String(lieferantIdRaw), 10) : NaN;

      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
      }
      if (!Number.isFinite(lieferantId)) {
        return NextResponse.json({ error: "Lieferant fehlt" }, { status: 400 });
      }

      const lieferant = await prisma.lieferant.findUnique({
        where: { id: lieferantId },
        select: { id: true, name: true },
      });
      if (!lieferant) {
        return NextResponse.json({ error: "Lieferant nicht gefunden" }, { status: 404 });
      }

      const buffer = Buffer.from(await (file as Blob).arrayBuffer());
      const wb = XLSX.read(buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (rows.length === 0) {
        return NextResponse.json({ error: "Keine Zeilen in der Datei gefunden" }, { status: 400 });
      }

      // Alle aktiven Artikel laden für Matching
      const artikel = await prisma.artikel.findMany({
        where: { aktiv: true },
        select: {
          id: true,
          artikelnummer: true,
          name: true,
          liefergroesse: true,
          einheit: true,
          lieferanten: {
            where: { lieferantId },
            select: { einkaufspreis: true },
            take: 1,
          },
        },
        take: 5000,
      });

      const kandidaten: MatchKandidat[] = artikel.map((a) => ({
        id: a.id,
        artikelnummer: a.artikelnummer,
        name: a.name,
        liefergroesse: a.liefergroesse,
        einheit: a.einheit,
        aktuellerEk: a.lieferanten[0]?.einkaufspreis ?? null,
      }));

      const normMap = new Map<string, MatchKandidat>();       // Name exakt normalisiert
      const normMitGebinde = new Map<string, MatchKandidat>(); // Name + Gebinde normalisiert
      for (const k of kandidaten) {
        normMap.set(normalizeName(k.name), k);
        if (k.liefergroesse) {
          normMitGebinde.set(normalizeName(`${k.name} ${k.liefergroesse}`), k);
        }
      }

      const zeilen: ZeileErgebnis[] = [];
      for (const row of rows) {
        const quelle = pickCol(row, "Artikel", "Artikelname", "Bezeichnung", "Name", "Produkt", "Produktname");
        const ekRaw = pickCol(row, "EK-Preis", "EK", "Einkaufspreis", "Preis", "Netto", "EK Preis");
        const ekNeu = parseNumber(ekRaw);
        if (!quelle || ekNeu === null) continue;

        const norm = normalizeName(quelle);
        let match: MatchKandidat | null = null;
        let matchArt: ZeileErgebnis["matchArt"] = "keiner";

        if (normMap.has(norm)) {
          match = normMap.get(norm)!;
          matchArt = "exakt";
        } else if (normMitGebinde.has(norm)) {
          match = normMitGebinde.get(norm)!;
          matchArt = "mitGebinde";
        } else {
          // Fallback: Kandidaten, deren Name in der Zeile enthalten ist (längster zuerst)
          const treffer = kandidaten
            .filter((k) => norm.includes(normalizeName(k.name)) && normalizeName(k.name).length >= 4)
            .sort((a, b) => b.name.length - a.name.length);
          if (treffer.length === 1) {
            match = treffer[0];
            matchArt = "enthaelt";
          } else if (treffer.length > 1) {
            zeilen.push({
              quelle,
              ekNeu,
              match: null,
              matchArt: "keiner",
              alternativen: treffer.slice(0, 3),
            });
            continue;
          }
        }

        zeilen.push({ quelle, ekNeu, match, matchArt, alternativen: [] });
      }

      const treffer = zeilen.filter((z) => z.match);
      const offen = zeilen.filter((z) => !z.match);

      return NextResponse.json({
        lieferant,
        zeilen,
        statistik: {
          gesamt: zeilen.length,
          gefunden: treffer.length,
          offen: offen.length,
        },
      });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Datei konnte nicht verarbeitet werden" }, { status: 500 });
    }
  }

  // Import anwenden
  try {
    const body = await req.json().catch(() => null) as {
      lieferantId?: number;
      updates?: { artikelId: number; ekNeu: number }[];
      neueArtikel?: { name: string; ekNeu: number; liefergroesse?: string | null }[];
    } | null;

    if (!body || !Number.isFinite(body.lieferantId)) {
      return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    const lieferantId = body.lieferantId!;
    const lieferant = await prisma.lieferant.findUnique({ where: { id: lieferantId } });
    if (!lieferant) {
      return NextResponse.json({ error: "Lieferant nicht gefunden" }, { status: 404 });
    }

    let aktualisiert = 0;
    let neuZuordnung = 0;
    let neueArtikelAngelegt = 0;
    let uebersprungen = 0;

    // 1) Bestehende Artikel aktualisieren
    for (const u of body.updates ?? []) {
      const artikelId = Number(u.artikelId);
      const ekNeu = Number(u.ekNeu);
      if (!Number.isFinite(artikelId) || !Number.isFinite(ekNeu) || ekNeu < 0) {
        uebersprungen++;
        continue;
      }

      const vorhanden = await prisma.artikelLieferant.findUnique({
        where: { artikelId_lieferantId: { artikelId, lieferantId } },
        select: { id: true, einkaufspreis: true },
      });

      if (vorhanden) {
        if (vorhanden.einkaufspreis === ekNeu) {
          uebersprungen++;
          continue;
        }
        await prisma.artikelLieferant.update({
          where: { id: vorhanden.id },
          data: { einkaufspreis: ekNeu },
        });
        aktualisiert++;
      } else {
        await prisma.artikelLieferant.create({
          data: {
            artikelId,
            lieferantId,
            einkaufspreis: ekNeu,
            mindestbestellmenge: 1,
            lieferzeitTage: 7,
            bevorzugt: false,
          },
        });
        neuZuordnung++;
      }
    }

    // 2) Neue Artikel anlegen (mit Auto-Artikelnummer)
    for (const a of body.neueArtikel ?? []) {
      const name = String(a.name ?? "").trim();
      const ekNeu = Number(a.ekNeu);
      if (!name || !Number.isFinite(ekNeu) || ekNeu < 0) {
        uebersprungen++;
        continue;
      }
      const artikelnummer = await naechsteArtikelnummer();
      await prisma.artikel.create({
        data: {
          artikelnummer,
          name,
          kategorie: "Sonstiges",
          einheit: "Stück",
          standardpreis: 0,
          mwstSatz: 19,
          mindestbestand: 0,
          aktuellerBestand: 0,
          liefergroesse: a.liefergroesse?.trim() || null,
          lieferanten: {
            create: [{
              lieferantId,
              einkaufspreis: ekNeu,
              mindestbestellmenge: 1,
              lieferzeitTage: 7,
              bevorzugt: true,
            }],
          },
        },
      });
      neueArtikelAngelegt++;
    }

    return NextResponse.json({
      aktualisiert,
      neuZuordnung,
      neueArtikel: neueArtikelAngelegt,
      uebersprungen,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Import fehlgeschlagen" }, { status: 500 });
  }
}

// ─── Helpers: Artikelnummer auto-vergeben ────────────────────────────────────

async function naechsteArtikelnummer(): Promise<string> {
  const nummernkreisRaw = await prisma.einstellung.findUnique({
    where: { key: "artikel.nummernkreis" },
  });
  const nk = nummernkreisRaw?.value
    ? (() => { try { return JSON.parse(nummernkreisRaw.value); } catch { return null; } })()
    : null;
  const prefix = nk?.prefix ?? "ART-";
  const laenge = Number(nk?.laenge) || 5;
  const naechste = Number(nk?.naechste) || 1;
  const nummer = `${prefix}${String(naechste).padStart(laenge, "0")}`;
  await prisma.einstellung.upsert({
    where: { key: "artikel.nummernkreis" },
    update: { value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
    create: { key: "artikel.nummernkreis", value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
  });
  return nummer;
}
