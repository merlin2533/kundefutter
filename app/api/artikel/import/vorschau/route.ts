import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { ARTIKEL_ALIAS, artikelBaseName, firmenBaseName, hatGemeinsamesErstwort, istAehnlicherName, normalizeArtikelName, parseNumber, pickCol } from "@/lib/import-utils";
import { resolveKategorie } from "@/lib/auswahllisten";
import { loadKategorieTaxonomie } from "@/lib/artikel-kategorie";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export interface VorschauZeile {
  zeile: number;
  name: string;
  aktion: "neu" | "aktualisieren" | "überspringen";
  details: string[];
  moeglichesDuplikat?: string[];
  moeglicherLieferant?: string;
}

export interface VorschauResult {
  plan: VorschauZeile[];
  summary: {
    neu: number;
    aktualisieren: number;
    ueberspringen: number;
    neueLieferanten: number;
  };
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    Sentry.captureException(err);
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
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datei konnte nicht gelesen werden" }, { status: 400 });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Keine Zeilen in der Datei gefunden" }, { status: 400 });
  }

  // Lade alle Artikelnamen und Lieferantennamen für schnellen Abgleich
  const [alleArtikel, alleLieferanten] = await Promise.all([
    prisma.artikel.findMany({ select: { name: true }, take: 20000 }),
    prisma.lieferant.findMany({ select: { name: true }, take: 2000 }),
  ]);

  // Exakter Abgleich normalisiert (®/™/©, Bindestrich-Varianten, Mehrfach-
  // Leerzeichen) — sonst matcht z.B. "Sulfomix® plus" nicht gegen den in der
  // DB ohne ® gepflegten "Sulfomix plus". Zusätzlich ein Index über den reinen
  // Produktnamen (ohne Gebinde-/Mengenangabe) für einen "könnte derselbe
  // Artikel sein"-Hinweis per Enthalten-Prüfung (nicht nur exakte
  // Gleichheit) — DB-Namen sind hier oft deutlich ausführlicher als der
  // Import-Name (z.B. "BvG-Bor 17,4 G – 17,4 % Bor, wasserlösliches Bor,
  // Borsäure (25 kg Sack)" vs. nur "BvG-Bor 17,4 G" in der Preisliste).
  const artikelByNormName = new Map<string, string>();
  const artikelBasen: { name: string; base: string }[] = [];
  for (const a of alleArtikel) {
    artikelByNormName.set(normalizeArtikelName(a.name), a.name);
    const base = artikelBaseName(a.name);
    if (base) artikelBasen.push({ name: a.name, base });
  }
  const findeAehnlicheArtikel = (importBase: string): string[] => {
    if (!importBase) return [];
    const treffer: string[] = [];
    for (const { name: n, base } of artikelBasen) {
      if (istAehnlicherName(importBase, base, 6) && !treffer.includes(n)) {
        treffer.push(n);
        if (treffer.length >= 3) break;
      }
    }
    return treffer;
  };

  const lieferantenNamenSet = new Set(alleLieferanten.map((l) => l.name.toLowerCase()));
  const lieferantenBasen = alleLieferanten.map((l) => ({ name: l.name, base: firmenBaseName(l.name) }));
  const findeAehnlichenLieferanten = (importBase: string): string | undefined => {
    if (!importBase) return undefined;
    for (const { name: n, base } of lieferantenBasen) {
      if (istAehnlicherName(importBase, base, 3)) return n;
    }
    // Fallback: abweichender Unternehmensbereich-Zusatz, aber gleiches
    // Markenwort (z.B. "BvG Agrar GmbH" vs. "BvG Bodenverbesserungs-GmbH").
    for (const { name: n, base } of lieferantenBasen) {
      if (hatGemeinsamesErstwort(importBase, base)) return n;
    }
    return undefined;
  };

  const { kategorien: gueltigeKategorien, unterkategorienByKat } = await loadKategorieTaxonomie();

  const plan: VorschauZeile[] = [];
  // Wert = möglicherweise gemeinter Bestands-Lieferant (oder null, falls
  // keiner gefunden wurde) — einmal pro neuem Lieferantennamen ermittelt und
  // gecacht, damit der Warnhinweis auf JEDER Zeile mit diesem Namen erscheint
  // (nicht nur auf der ersten), auch wenn der Lieferant mehrfach in der Datei
  // vorkommt.
  const neueLieferantenNamen = new Map<string, string | null>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const zeile = i + 2;
    const name = pickCol(row, ...ARTIKEL_ALIAS.name);

    if (!name) {
      plan.push({ zeile, name: "(leer)", aktion: "überspringen", details: ["Name fehlt — Zeile wird übersprungen"] });
      continue;
    }

    const details: string[] = [];

    const standardpreis = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.standardpreis));
    const einkaufspreis = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.einkaufspreis));
    const mindestbestellmenge = parseNumber(pickCol(row, ...ARTIKEL_ALIAS.mindestbestellmenge));
    const lieferantName = pickCol(row, ...ARTIKEL_ALIAS.lieferant);
    const kategorieRaw = pickCol(row, ...ARTIKEL_ALIAS.kategorie);
    const unterkategorieRaw = pickCol(row, ...ARTIKEL_ALIAS.unterkategorie) || null;
    const einheit = pickCol(row, ...ARTIKEL_ALIAS.einheit);

    if (kategorieRaw) {
      const resolved = resolveKategorie(kategorieRaw, unterkategorieRaw, gueltigeKategorien, unterkategorienByKat);
      const unterkategorieAnzeige = resolved.unterkategorie ? ` · ${resolved.unterkategorie}` : "";
      details.push(
        resolved.kategorie === kategorieRaw
          ? `Kategorie: ${resolved.kategorie}${unterkategorieAnzeige}`
          : `Kategorie: ${resolved.kategorie}${unterkategorieAnzeige} (erkannt aus Spaltenwert "${kategorieRaw}")`
      );
    }
    if (einheit) details.push(`Einheit: ${einheit}`);
    if (standardpreis > 0) details.push(`VK: ${standardpreis.toFixed(2)} €`);
    if (einkaufspreis > 0) details.push(`EK: ${einkaufspreis.toFixed(2)} €`);
    if (mindestbestellmenge > 0) details.push(`Mindestbestellmenge: ${mindestbestellmenge}`);

    let moeglicherLieferant: string | undefined;
    if (lieferantName) {
      const lKey = lieferantName.toLowerCase();
      if (lieferantenNamenSet.has(lKey)) {
        details.push(`Lieferant "${lieferantName}" — vorhanden, wird verknüpft`);
      } else {
        const mehrfach = neueLieferantenNamen.has(lKey);
        const kandidat = mehrfach
          ? neueLieferantenNamen.get(lKey) ?? undefined
          : findeAehnlichenLieferanten(firmenBaseName(lieferantName));
        if (!mehrfach) neueLieferantenNamen.set(lKey, kandidat ?? null);

        if (kandidat) {
          moeglicherLieferant = kandidat;
          details.push(
            `⚠️ Lieferant "${lieferantName}" nicht exakt gefunden — evtl. bereits vorhanden als "${kandidat}"? Bitte vor dem Import prüfen (sonst wird ein zweiter Lieferant angelegt).`
          );
        } else {
          details.push(`Lieferant "${lieferantName}" — wird neu angelegt${mehrfach ? " (mehrfach in Datei)" : ""}`);
        }
      }
    }

    const istVorhanden = artikelByNormName.has(normalizeArtikelName(name));
    let moeglichesDuplikat: string[] | undefined;
    if (!istVorhanden) {
      const kandidaten = findeAehnlicheArtikel(artikelBaseName(name));
      if (kandidaten.length) {
        moeglichesDuplikat = kandidaten;
        details.push(
          `⚠️ Möglicherweise bereits vorhanden unter anderem Namen: "${kandidaten.join('", "')}" — bitte vor dem Anlegen prüfen`
        );
      }
    }
    plan.push({
      zeile,
      name,
      aktion: istVorhanden ? "aktualisieren" : "neu",
      details,
      ...(moeglichesDuplikat && { moeglichesDuplikat }),
      ...(moeglicherLieferant && { moeglicherLieferant }),
    });
  }

  const summary = {
    neu: plan.filter((p) => p.aktion === "neu").length,
    aktualisieren: plan.filter((p) => p.aktion === "aktualisieren").length,
    ueberspringen: plan.filter((p) => p.aktion === "überspringen").length,
    neueLieferanten: neueLieferantenNamen.size,
  };

  return NextResponse.json({ plan, summary } satisfies VorschauResult);
}
