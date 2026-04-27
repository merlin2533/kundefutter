import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// Flexible Spalten-Aliasse für häufige Varianten.
function pickCol(row: Record<string, unknown>, ...keys: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()]/g, "");
  const lookup: Record<string, unknown> = {};
  for (const k of Object.keys(row)) lookup[norm(k)] = row[k];
  for (const key of keys) {
    const v = lookup[norm(key)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parseNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "Datei konnte nicht gelesen werden (kein gültiges XLS/CSV)" }, { status: 400 });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Keine Zeilen in der Datei gefunden" }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const name = pickCol(row, "Name", "Produktname", "Artikel", "Bezeichnung");
    if (!name) {
      errors.push(`Zeile ${rowNum}: Name/Produktname fehlt — übersprungen`);
      skipped++;
      continue;
    }

    const aktivRaw = pickCol(row, "Aktiv", "Active").toLowerCase() || "ja";
    const aktiv = aktivRaw !== "nein" && aktivRaw !== "false" && aktivRaw !== "0";

    const standardpreis = parseNumber(
      pickCol(
        row,
        "Standardpreis",
        "VK (Standardpreis)",
        "Verkaufspreis",
        "VK-Preis",
        "VKP",
        "VK",
        "Listenpreis",
        "Stückpreis",
        "Stueckpreis",
        "Nettopreis",
        "Netto-Preis",
        "Netto",
        "Preis netto",
        "Bruttopreis",
        "Preis",
      ),
    );
    const aktuellerBestand = parseNumber(pickCol(row, "Lagerbestand", "Bestand", "Aktueller Bestand"));
    const mindestbestand = parseNumber(pickCol(row, "Mindestbestand", "Meldebestand", "Min-Bestand"));
    const mwstRaw = parseNumber(pickCol(row, "MwSt %", "MwSt", "MwSt-Satz", "Mehrwertsteuer", "USt"));
    const mwstSatz = [0, 7, 19].includes(mwstRaw) ? mwstRaw : 19;
    const kategorie =
      pickCol(row, "Kategorie", "Artikelkategorie", "Produktkategorie", "Produktgruppe", "Warengruppe", "Gruppe") ||
      "Futter";
    const unterkategorie =
      pickCol(row, "Unterkategorie", "Subkategorie", "Kultur", "Fruchtart") || null;
    const einheit = pickCol(row, "Einheit", "Mengeneinheit", "ME", "Einh") || "kg";
    const liefergroesse =
      pickCol(row, "Verpackungsgröße", "Verpackungsgroesse", "Verpackung", "Liefergröße", "Liefergroesse", "Gebinde") || null;
    const beschreibung = pickCol(row, "Beschreibung", "Bemerkung", "Notiz") || null;
    const lieferantName = pickCol(row, "Lieferant", "Lieferantenname", "Hersteller");
    const einkaufspreis = parseNumber(
      pickCol(row, "EK (Einkaufspreis)", "Einkaufspreis", "EK-Preis", "EK", "Einstandspreis"),
    );

    const artikelnummer = pickCol(row, "Artikelnummer", "Nummer", "ArtNr", "Art-Nr", "SKU") || undefined;

    try {
      // Auto-Artikelnummer bei Bedarf, innerhalb einer Transaktion
      // um doppelte Nummern bei parallelen Importen zu vermeiden.
      await prisma.$transaction(async (tx) => {
        let finalNummer = artikelnummer;
        if (!finalNummer) {
          const nummernkreisRaw = await tx.einstellung.findUnique({ where: { key: "artikel.nummernkreis" } });
          const nk = nummernkreisRaw?.value
            ? (() => { try { return JSON.parse(nummernkreisRaw.value); } catch { return null; } })()
            : null;
          const prefix = nk?.prefix ?? "ART-";
          const laenge = Number(nk?.laenge) || 5;
          const naechste = Number(nk?.naechste) || 1;
          finalNummer = `${prefix}${String(naechste).padStart(laenge, "0")}`;
          await tx.einstellung.upsert({
            where: { key: "artikel.nummernkreis" },
            update: { value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
            create: { key: "artikel.nummernkreis", value: JSON.stringify({ prefix, laenge, naechste: naechste + 1 }) },
          });
        }

        let lieferantId: number | null = null;
        if (lieferantName) {
          const bestehend = await tx.lieferant.findFirst({ where: { name: lieferantName } });
          lieferantId = bestehend?.id ?? (await tx.lieferant.create({ data: { name: lieferantName } })).id;
        }

        await tx.artikel.create({
          data: {
            artikelnummer: finalNummer,
            name,
            kategorie,
            unterkategorie,
            einheit,
            standardpreis,
            mwstSatz,
            aktuellerBestand,
            mindestbestand,
            liefergroesse,
            beschreibung,
            aktiv,
            ...(lieferantId && {
              lieferanten: {
                create: [{
                  lieferantId,
                  lieferantenArtNr: finalNummer,
                  einkaufspreis,
                  mindestbestellmenge: 1,
                  lieferzeitTage: 7,
                  bevorzugt: true,
                }],
              },
            }),
          },
        });
      });
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Zeile ${rowNum} (${name}): ${msg}`);
      skipped++;
    }
  }

  return NextResponse.json({ created, skipped, errors: errors.slice(0, 20) });
}
