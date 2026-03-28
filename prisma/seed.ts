import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url = process.env.DATABASE_URL ?? "file:prisma/dev.db";
const libsqlUrl = url.startsWith("file:./") ? url.replace("file:./", "file:") : url;
const adapter = new PrismaLibSql({ url: libsqlUrl });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Seeding database…");

  // ── Lieferanten ────────────────────────────────────────────────────────────

  const agriChem = await prisma.lieferant.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "AgriChem GmbH",
      ansprechpartner: "Klaus Bremer",
      email: "bestellung@agrichem.de",
      telefon: "05141 88001",
      strasse: "Industriestraße 12",
      plz: "29221",
      ort: "Celle",
      notizen: "Hauptlieferant für Düngemittel – bevorzugter Lieferant für Stickstoff-Produkte",
    },
  });

  const saatgutNord = await prisma.lieferant.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "Saatgut Nord GmbH & Co. KG",
      ansprechpartner: "Petra Steinmann",
      email: "vertrieb@saatgut-nord.de",
      telefon: "04131 22050",
      strasse: "Am Saatfeld 7",
      plz: "21337",
      ort: "Lüneburg",
      notizen: "Zertifiziertes Z-Saatgut",
    },
  });

  const futterKing = await prisma.lieferant.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: "FutterKing Hannover KG",
      ansprechpartner: "Andreas Vollmer",
      email: "info@futterking.de",
      telefon: "0511 6789100",
      strasse: "Messeschnellweg 45",
      plz: "30539",
      ort: "Hannover",
      notizen: "Großhändler Tierfutter, günstige Konditionen ab 1 t",
    },
  });

  const bayerCrop = await prisma.lieferant.upsert({
    where: { id: 4 },
    update: {},
    create: {
      name: "Bayer CropScience AG (Distributor)",
      ansprechpartner: "Frank Meier",
      email: "agrar@bayer-distributor.de",
      telefon: "05141 99200",
      strasse: "Agrarpark 1",
      plz: "29221",
      ort: "Celle",
      notizen: "Pflanzenschutz & Spezialdünger, Mindestbestellung 500 kg",
    },
  });

  // ── Artikel: Dünger ────────────────────────────────────────────────────────

  const kalkAmmonsalpeter = await prisma.artikel.upsert({
    where: { artikelnummer: "DUE-001" },
    update: {},
    create: {
      artikelnummer: "DUE-001",
      name: "Kalkammonsalpeter (KAS) 27 % N",
      kategorie: "Duenger",
      einheit: "t",
      standardpreis: 380.00,
      mindestbestand: 5,
      aktuellerBestand: 12,
      beschreibung: "Stickstoffdünger 27 % N, universell einsetzbar, nitrat- und ammoniumhaltig",
      lieferanten: {
        create: [{
          lieferantId: agriChem.id,
          lieferantenArtNr: "KAS-27-25",
          einkaufspreis: 285.00,
          mindestbestellmenge: 2,
          lieferzeitTage: 5,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "DUE-002" },
    update: {},
    create: {
      artikelnummer: "DUE-002",
      name: "Harnstoff 46 % N (granuliert)",
      kategorie: "Duenger",
      einheit: "t",
      standardpreis: 420.00,
      mindestbestand: 3,
      aktuellerBestand: 7.5,
      beschreibung: "Hochkonzentrierter Stickstoffdünger, geeignet für alle Kulturen",
      lieferanten: {
        create: [{
          lieferantId: agriChem.id,
          lieferantenArtNr: "HARNSTOFF-46",
          einkaufspreis: 315.00,
          mindestbestellmenge: 1,
          lieferzeitTage: 5,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "DUE-003" },
    update: {},
    create: {
      artikelnummer: "DUE-003",
      name: "Explora® 20 (20-5-10+3 MgO)",
      kategorie: "Duenger",
      einheit: "t",
      standardpreis: 510.00,
      mindestbestand: 2,
      aktuellerBestand: 4,
      beschreibung: "NPK-Mehrnährstoffdünger 20-5-10+3 MgO, ideal für Grünland und Ackerland",
      lieferanten: {
        create: [{
          lieferantId: agriChem.id,
          lieferantenArtNr: "EXPLORA-20",
          einkaufspreis: 390.00,
          mindestbestellmenge: 1,
          lieferzeitTage: 5,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "DUE-004" },
    update: {},
    create: {
      artikelnummer: "DUE-004",
      name: "Explora® Grünland (15-5-20+3 MgO)",
      kategorie: "Duenger",
      einheit: "t",
      standardpreis: 490.00,
      mindestbestand: 2,
      aktuellerBestand: 3,
      beschreibung: "NPK-Grünlanddünger mit erhöhtem Kaliumanteil",
      lieferanten: {
        create: [{
          lieferantId: agriChem.id,
          lieferantenArtNr: "EXPLORA-GRUEN",
          einkaufspreis: 375.00,
          mindestbestellmenge: 1,
          lieferzeitTage: 5,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "DUE-005" },
    update: {},
    create: {
      artikelnummer: "DUE-005",
      name: "Tripelsuperphosphat TSP 46 % P₂O₅",
      kategorie: "Duenger",
      einheit: "t",
      standardpreis: 560.00,
      mindestbestand: 1,
      aktuellerBestand: 2,
      beschreibung: "Phosphordünger, wasserlöslich, schnell pflanzenverfügbar",
      lieferanten: {
        create: [
          {
            lieferantId: agriChem.id,
            lieferantenArtNr: "TSP-46",
            einkaufspreis: 430.00,
            mindestbestellmenge: 1,
            lieferzeitTage: 7,
            bevorzugt: true,
          },
          {
            lieferantId: bayerCrop.id,
            lieferantenArtNr: "BC-TSP46",
            einkaufspreis: 445.00,
            mindestbestellmenge: 2,
            lieferzeitTage: 10,
            bevorzugt: false,
          },
        ],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "DUE-006" },
    update: {},
    create: {
      artikelnummer: "DUE-006",
      name: "Kalkdünger (Branntkalk, 85 % CaO)",
      kategorie: "Duenger",
      einheit: "t",
      standardpreis: 110.00,
      mindestbestand: 5,
      aktuellerBestand: 0,
      beschreibung: "Zur pH-Regulierung saurer Böden",
      lieferanten: {
        create: [{
          lieferantId: agriChem.id,
          lieferantenArtNr: "KALK-BRANNT",
          einkaufspreis: 75.00,
          mindestbestellmenge: 5,
          lieferzeitTage: 7,
          bevorzugt: true,
        }],
      },
    },
  });

  // ── Artikel: Saatgut ───────────────────────────────────────────────────────

  const winterweizen = await prisma.artikel.upsert({
    where: { artikelnummer: "SAA-001" },
    update: {},
    create: {
      artikelnummer: "SAA-001",
      name: "Winterweizen TOBAK (E-Weizen, DSV)",
      kategorie: "Saatgut",
      einheit: "kg",
      standardpreis: 1.45,
      mindestbestand: 500,
      aktuellerBestand: 1200,
      beschreibung: "Z-Saatgut Winterweizen TOBAK, Eliteweizen. Hohes Ertragspotenzial, fusariumtolerant.",
      lieferanten: {
        create: [{
          lieferantId: saatgutNord.id,
          lieferantenArtNr: "WW-TOBAK-Z",
          einkaufspreis: 0.98,
          mindestbestellmenge: 200,
          lieferzeitTage: 10,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "SAA-002" },
    update: {},
    create: {
      artikelnummer: "SAA-002",
      name: "Wintergerste TITUS (zweizeilig, KWS)",
      kategorie: "Saatgut",
      einheit: "kg",
      standardpreis: 1.35,
      mindestbestand: 300,
      aktuellerBestand: 800,
      beschreibung: "Z-Saatgut Wintergerste TITUS, hohe Winterhärte, gute Standfestigkeit",
      lieferanten: {
        create: [{
          lieferantId: saatgutNord.id,
          lieferantenArtNr: "WG-TITUS-Z",
          einkaufspreis: 0.90,
          mindestbestellmenge: 100,
          lieferzeitTage: 10,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "SAA-003" },
    update: {},
    create: {
      artikelnummer: "SAA-003",
      name: "Zuckerrüben BELLONA (KWS)",
      kategorie: "Saatgut",
      einheit: "Sack",
      standardpreis: 115.00,
      mindestbestand: 20,
      aktuellerBestand: 45,
      beschreibung: "KWS BELLONA, sehr hoher Zuckergehalt, tolerant gegen Blattkrankheiten. 1 Sack ≈ 1 ha.",
      lieferanten: {
        create: [{
          lieferantId: saatgutNord.id,
          lieferantenArtNr: "ZR-BELLONA",
          einkaufspreis: 85.00,
          mindestbestellmenge: 10,
          lieferzeitTage: 14,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "SAA-004" },
    update: {},
    create: {
      artikelnummer: "SAA-004",
      name: "Winterraps AVATAR (Hybridsorte, Dekalb)",
      kategorie: "Saatgut",
      einheit: "Sack",
      standardpreis: 135.00,
      mindestbestand: 15,
      aktuellerBestand: 30,
      beschreibung: "Dekalb AVATAR, Hybridraps, sehr hohe Erträge, gute Winterhärte. 1 Sack ≈ 1 ha.",
      lieferanten: {
        create: [{
          lieferantId: saatgutNord.id,
          lieferantenArtNr: "WR-AVATAR",
          einkaufspreis: 98.00,
          mindestbestellmenge: 5,
          lieferzeitTage: 14,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "SAA-005" },
    update: {},
    create: {
      artikelnummer: "SAA-005",
      name: "Silomais RONALDINIO (KWS)",
      kategorie: "Saatgut",
      einheit: "Sack",
      standardpreis: 155.00,
      mindestbestand: 20,
      aktuellerBestand: 60,
      beschreibung: "KWS RONALDINIO, hervorragende Stärke- und Energiedichte, frühe Ernte möglich.",
      lieferanten: {
        create: [{
          lieferantId: saatgutNord.id,
          lieferantenArtNr: "SM-RONALDINIO",
          einkaufspreis: 115.00,
          mindestbestellmenge: 10,
          lieferzeitTage: 14,
          bevorzugt: true,
        }],
      },
    },
  });

  // ── Artikel: Futter ────────────────────────────────────────────────────────

  const rinderfutter = await prisma.artikel.upsert({
    where: { artikelnummer: "FUT-001" },
    update: {},
    create: {
      artikelnummer: "FUT-001",
      name: "Rinderfutter Milchleistung 18 % XP (25-kg-Sack)",
      kategorie: "Futter",
      einheit: "Sack",
      standardpreis: 18.50,
      mindestbestand: 50,
      aktuellerBestand: 120,
      beschreibung: "Ergänzungsfuttermittel Milchkühe, 18 % Rohprotein, 7,0 MJ NEL/kg",
      lieferanten: {
        create: [{
          lieferantId: futterKing.id,
          lieferantenArtNr: "FK-RIND-18",
          einkaufspreis: 13.20,
          mindestbestellmenge: 20,
          lieferzeitTage: 3,
          bevorzugt: true,
        }],
      },
    },
  });

  const pferdefutter = await prisma.artikel.upsert({
    where: { artikelnummer: "FUT-002" },
    update: {},
    create: {
      artikelnummer: "FUT-002",
      name: "Pferdemüsli Classic (20-kg-Sack)",
      kategorie: "Futter",
      einheit: "Sack",
      standardpreis: 22.90,
      mindestbestand: 30,
      aktuellerBestand: 75,
      beschreibung: "Ausgewogenes Pferdefutter, haferfrei, mit Kräutern und Vitaminen",
      lieferanten: {
        create: [{
          lieferantId: futterKing.id,
          lieferantenArtNr: "FK-PFERD-CLASSIC",
          einkaufspreis: 16.50,
          mindestbestellmenge: 10,
          lieferzeitTage: 3,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "FUT-003" },
    update: {},
    create: {
      artikelnummer: "FUT-003",
      name: "Geflügelpellets Legemehl 15 % XP (25-kg-Sack)",
      kategorie: "Futter",
      einheit: "Sack",
      standardpreis: 15.80,
      mindestbestand: 40,
      aktuellerBestand: 90,
      beschreibung: "Alleinfutter Legehennen, 15 % Rohprotein, angereichert mit Kalzium",
      lieferanten: {
        create: [{
          lieferantId: futterKing.id,
          lieferantenArtNr: "FK-GEFL-LEGE",
          einkaufspreis: 11.20,
          mindestbestellmenge: 20,
          lieferzeitTage: 3,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "FUT-004" },
    update: {},
    create: {
      artikelnummer: "FUT-004",
      name: "Schaffutter Mutterschafe (25-kg-Sack)",
      kategorie: "Futter",
      einheit: "Sack",
      standardpreis: 17.40,
      mindestbestand: 20,
      aktuellerBestand: 40,
      beschreibung: "Ergänzungsfutter Mutterschafe, calciumreich, für Trächtigkeit und Laktation",
      lieferanten: {
        create: [{
          lieferantId: futterKing.id,
          lieferantenArtNr: "FK-SCHAF-MUTT",
          einkaufspreis: 12.30,
          mindestbestellmenge: 20,
          lieferzeitTage: 4,
          bevorzugt: true,
        }],
      },
    },
  });

  await prisma.artikel.upsert({
    where: { artikelnummer: "FUT-005" },
    update: {},
    create: {
      artikelnummer: "FUT-005",
      name: "Kälbermilchaustauscher 23 % (20-kg-Beutel)",
      kategorie: "Futter",
      einheit: "Sack",
      standardpreis: 68.00,
      mindestbestand: 10,
      aktuellerBestand: 25,
      beschreibung: "Vollmilchersatz Kälber 0–8 Wochen, 23 % Milchprotein, Vitamine A, D, E",
      lieferanten: {
        create: [{
          lieferantId: futterKing.id,
          lieferantenArtNr: "FK-KALB-MA23",
          einkaufspreis: 51.00,
          mindestbestellmenge: 5,
          lieferzeitTage: 3,
          bevorzugt: true,
        }],
      },
    },
  });

  // ── Beispiel-Kunden ────────────────────────────────────────────────────────

  const k1 = await prisma.kunde.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Hof Brandes",
      firma: "Landwirtschaft Brandes GbR",
      kategorie: "Landwirt",
      strasse: "Dorfstraße 12",
      plz: "29303",
      ort: "Bergen",
      lat: 52.808,
      lng: 9.960,
      notizen: "Hauptkunde Ackerbau, Wintergetreide + Raps",
      kontakte: {
        create: [
          { typ: "telefon", wert: "05051 3421", label: "Büro" },
          { typ: "mobil", wert: "0172 4456789", label: "Herr Brandes" },
          { typ: "email", wert: "brandes@hof-brandes.de", label: "Büro" },
        ],
      },
    },
  });

  const k2 = await prisma.kunde.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "Gestüt Sonnenhügel",
      firma: "Gestüt Sonnenhügel GmbH",
      kategorie: "Pferdehof",
      strasse: "Am Sonnenhügel 3",
      plz: "29525",
      ort: "Uelzen",
      lat: 52.966,
      lng: 10.566,
      notizen: "25 Pferde, regelmäßiger Bedarf Pferdefutter",
      kontakte: {
        create: [
          { typ: "telefon", wert: "0581 88123", label: "Stall" },
          { typ: "email", wert: "info@gestut-sonnenhuegel.de", label: "Buchführung" },
          { typ: "mobil", wert: "0160 5512345", label: "Frau Lohmann" },
        ],
      },
    },
  });

  const k3 = await prisma.kunde.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: "Familie Schulze",
      firma: null,
      kategorie: "Kleintierhalter",
      strasse: "Heideweg 8",
      plz: "21335",
      ort: "Lüneburg",
      lat: 53.246,
      lng: 10.413,
      notizen: "Hühner + 2 Schafe, kleiner Gemüsegarten",
      kontakte: {
        create: [
          { typ: "mobil", wert: "0176 9987654", label: "Frau Schulze" },
          { typ: "email", wert: "schulze-lueneburg@web.de", label: "" },
        ],
      },
    },
  });

  // ── Kundenbedarfe ──────────────────────────────────────────────────────────

  await prisma.kundeBedarf.upsert({
    where: { kundeId_artikelId: { kundeId: k1.id, artikelId: (await prisma.artikel.findUnique({ where: { artikelnummer: "SAA-004" } }))!.id } },
    update: {},
    create: { kundeId: k1.id, artikelId: (await prisma.artikel.findUnique({ where: { artikelnummer: "SAA-004" } }))!.id, menge: 20, intervallTage: 365, notiz: "Frühjahr" },
  });

  await prisma.kundeBedarf.upsert({
    where: { kundeId_artikelId: { kundeId: k1.id, artikelId: winterweizen.id } },
    update: {},
    create: { kundeId: k1.id, artikelId: winterweizen.id, menge: 600, intervallTage: 365 },
  });

  await prisma.kundeBedarf.upsert({
    where: { kundeId_artikelId: { kundeId: k2.id, artikelId: pferdefutter.id } },
    update: {},
    create: { kundeId: k2.id, artikelId: pferdefutter.id, menge: 40, intervallTage: 14, notiz: "Alle 2 Wochen" },
  });

  await prisma.kundeBedarf.upsert({
    where: { kundeId_artikelId: { kundeId: k3.id, artikelId: rinderfutter.id } },
    update: {},
    create: { kundeId: k3.id, artikelId: rinderfutter.id, menge: 2, intervallTage: 30 },
  });

  console.log("✅ Seed abgeschlossen!");
  console.log("   Lieferanten: 4 (AgriChem, Saatgut Nord, FutterKing, Bayer)");
  console.log("   Artikel: 16 (6 Dünger inkl. Explora®, 5 Saatgut, 5 Futter)");
  console.log("   Kunden: 3 (Hof Brandes, Gestüt Sonnenhügel, Familie Schulze)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
