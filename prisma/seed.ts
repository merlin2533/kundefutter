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

  // ── Lieferant: marstall ───────────────────────────────────────────────────

  const marstall = await prisma.lieferant.upsert({
    where: { id: 5 },
    update: {},
    create: {
      id: 5,
      name: "marstall GmbH & Co. KG",
      ansprechpartner: "Vertrieb Außendienst",
      email: "vertrieb@marstall.eu",
      telefon: "05439 9409-0",
      strasse: "Mühlendamm 20",
      plz: "49593",
      ort: "Bersenbrück",
      notizen: "Pferdefutter & Stallzubehör. 14 Tage netto Kasse / 8 Tage 2 % Skonto. Händler-EK ab 750 kg. Preisliste Feb. 2026.",
    },
  });

  const bvgAgrar = await prisma.lieferant.upsert({
    where: { id: 6 },
    update: {},
    create: {
      id: 6,
      name: "BvG Agrar GmbH",
      ansprechpartner: "",
      email: "",
      telefon: "",
      strasse: "",
      plz: "",
      ort: "",
      notizen: "Schwefelprodukte (Sulfolinsen, Sulfogranulat, Schwedokal), Bodenverbesserung, Bordünger. FiBL-gelistet.",
    },
  });

  // ── Artikel-Helper ────────────────────────────────────────────────────────

  const upsertArtikel = (
    artikelnummer: string,
    name: string,
    kategorie: string,
    einheit: string,
    standardpreis: number,
    mwstSatz: number,
    ek: number,
    lieferantId: number,
    beschreibung?: string,
  ) =>
    prisma.artikel.upsert({
      where: { artikelnummer },
      update: {},
      create: {
        artikelnummer,
        name,
        kategorie,
        einheit,
        standardpreis,
        mwstSatz,
        mindestbestand: 5,
        aktuellerBestand: 0,
        beschreibung,
        lieferanten: {
          create: [{
            lieferantId,
            lieferantenArtNr: artikelnummer,
            einkaufspreis: ek,
            mindestbestellmenge: 1,
            lieferzeitTage: 7,
            bevorzugt: true,
          }],
        },
      },
    });

  // ── Artikel: marstall Universal (Seite 1) ────────────────────────────────

  const marstallUniversal: Array<[string, string, string, number, number]> = [
    // [artikelnummer, name, einheit, vk-inkl-7%, ek-ohne-mwst]
    ["4250006300017", "marstall Haferfrei – das Original (20 kg Sack)",             "Sack",  22.80, 17.61],
    ["4250006300116", "marstall Freizeit – leicht beanspruchte Pferde (20 kg Sack)","Sack",  19.95, 15.70],
    ["4250006300369", "marstall Senior Plus – Anti-Aging Müsli (20 kg Sack)",       "Sack",  28.95, 22.30],
    ["4250006300208", "marstall Vito – getreide-/melassefreie Energie (20 kg Sack)","Sack",  32.60, 24.86],
    ["4250006305210", "marstall Senior-Aktiv – getreidefreie Aufbaumüsli (20 kg Sack)", "Sack", 42.40, 32.02],
    ["4250006305753", "marstall BodyForm-Müsli – das Aufbau-Futter (20 kg Sack)",   "Sack",  29.95, 23.80],
    ["4250006303810", "marstall Faser-Light – melassefrei, stärke-/zuckerarm (15 kg Sack)", "Sack", 29.30, 22.79],
    ["4250006305418", "marstall Naturell-Mix (15 kg Sack)",                         "Sack",  23.95, 17.76],
    ["4250006306163", "marstall Naturell-Pro – Getreidefrei Mix (15 kg Sack)",      "Sack",  29.80, 23.39],
    ["4250006304527", "marstall Alpaka+Co (15 kg Sack)",                            "Sack",  21.70, 16.38],
    ["4250006303797", "marstall Schwarz-Gold-Hafer (25 kg Sack)",                   "Sack",  28.95, 24.45],
    // Sport
    ["4250006306224", "marstall Sport-Amino (15 kg Sack)",                          "Sack",  29.95, 23.55],
    ["4250006306248", "marstall Sport-Energy (15 kg Sack)",                         "Sack",  21.95, 17.15],
    ["4250006306262", "marstall Western (15 kg Sack)",                              "Sack",  22.90, 17.75],
    // Raufutter
    ["4250006305654", "marstall Wiesen-Cobs aus dem Allgäu (20 kg Sack)",           "Sack",  22.75, 18.30],
    ["4250006305739", "marstall Wiesen-Fasern aus dem Allgäu (12,5 kg Sack)",       "Sack",  17.90, 13.85],
    ["4250006306187", "marstall Wiesen-Chips aus dem Allgäu (20 kg Sack)",          "Sack",  23.90, 19.20],
    ["4250006305838", "marstall Basis Luzerne Mix (15 kg Ballen)",                  "Stück", 23.70, 18.90],
    // Zucht
    ["4250006305807", "marstall Zucht-Klassik – Stute, Hengst & Fohlen (20 kg Sack)", "Sack", 29.60, 23.08],
    ["4250006305784", "marstall Zucht-Aktiv – getreidefrei (20 kg Sack)",           "Sack",  39.60, 31.28],
    ["4250006305791", "marstall Fohlen-Aktiv – getreidefrei aufwachsen (20 kg Sack)", "Sack", 40.80, 32.52],
    ["4250006303421", "marstall Fohlen-Milchpulver (20 kg Sack)",                   "Sack", 127.90, 101.20],
    ["4250006303438", "marstall Fohlen-NOT-Paket (1 Eimer)",                        "Stück", 163.00, 135.75],
    // Vet
    ["4250006305203", "marstall Gastro-Müsli – schonende Magenmüsli (20 kg Sack)",  "Sack",  35.60, 25.68],
    ["4250006305647", "marstall MyoCare-Müsli – Ernährung für PSSMler (15 kg Sack)","Sack",  42.50, 33.17],
    ["4250006305746", "marstall Haut-Vital – energiearme Müsli (15 kg Sack)",       "Sack",  35.15, 27.41],
    ["4250006303315", "marstall Sinfonie – Natur-Kräutermüsli (15 kg Sack)",        "Sack",  30.45, 22.79],
    // Vet Pro
    ["4250006305173", "marstall FlexoFit (1,7 kg Eimer)",                           "Stück",  79.00, 62.73],
    ["4250006304855", "marstall ProAir (2 kg Eimer)",                               "Stück",  69.00, 52.70],
    ["4250006305814", "marstall ProGastro (3 kg Eimer)",                            "Stück",  89.00, 68.25],
    ["4250006305685", "marstall Huf-Regulator – getreidefreie Huf-Formel (3,5 kg Eimer)", "Stück", 43.20, 28.26],
    ["4250006305692", "marstall Huf-Regulator (10 kg Eimer)",                       "Stück",  94.50, 63.00],
    ["4250006305708", "marstall Huf-Regulator (10 kg Sack)",                        "Sack",   84.85, 62.50],
    ["4250006304466", "marstall Darm-Regulator – 3-fach Ansatz gegen Kotwasser (3,5 kg Eimer)", "Stück", 41.00, 26.81],
    ["4250006306156", "marstall Darm-Regulator (10 kg Eimer)",                      "Stück",  89.45, 61.00],
  ];

  for (const [nr, name, einheit, vk, ek] of marstallUniversal) {
    await upsertArtikel(nr, name, "Pferdefutter", einheit, vk, 7, ek, marstall.id);
  }

  // ── Artikel: marstall Universal Plus (Seite 2) ───────────────────────────

  const marstallUniversalPlus: Array<[string, string, string, number, number, string?]> = [
    ["4250006304701", "marstall Bergwiesen-Mash (12,5 kg Sack)",            "Sack",  29.45, 21.89, "Universal Plus · Getreide- und melassefreies Mash"],
    ["4250006304695", "marstall Bergwiesen-Mash (5 kg Eimer)",              "Stück", 19.60, 13.88, "Universal Plus · Getreide- und melassefreies Mash"],
    ["4250006304763", "marstall Bergwiesen-MashToGo (7 kg Karton)",         "Stück", 45.15, 29.25, "Universal Plus"],
    ["4250006304756", "marstall Bergwiesen-MashToGo (350 g Beutel)",        "Stück",  2.95,  1.95, "Universal Plus · Portionsbeutel"],
    ["4250006305661", "marstall Amino-Muskel – getreidefreier Protein-Mix (3,5 kg Eimer)", "Stück", 53.95, 34.65, "Universal Plus"],
    ["4250006305678", "marstall Amino-Muskel (10 kg Eimer)",                "Stück", 134.95, 88.10, "Universal Plus"],
    ["4250006305715", "marstall Amino-Muskel (10 kg Sack)",                 "Sack", 116.90, 85.90, "Universal Plus"],
    ["4250006305845", "marstall MineralOrganic+ (3,5 kg Eimer)",            "Stück",  59.95, 43.75, "Universal Plus"],
    ["4250006305852", "marstall MineralOrganic+ (10 kg Eimer)",             "Stück", 165.95, 121.10, "Universal Plus"],
    ["4250006306132", "marstall Force – Getreidefreies Mineralfutter (3,5 kg Eimer)", "Stück", 17.95, 12.32, "Universal Plus"],
    ["4250006300697", "marstall Force (10 kg Eimer)",                       "Stück",  34.70, 23.95, "Universal Plus"],
    ["4250006304862", "marstall Force (10 kg Sack)",                        "Sack",   30.50, 20.65, "Universal Plus"],
    ["4250006300642", "marstall Force (20 kg Sack)",                        "Sack",   59.35, 41.20, "Universal Plus"],
    ["4250006306149", "marstall Mash (12,5 kg Sack)",                       "Sack",   21.50, 16.69, "Universal Plus"],
    ["4250006303872", "marstall MashToGo (10 kg Sack)",                     "Sack",   37.45, 28.75, "Universal Plus · Die praktische Mash-Portionspackung"],
    ["4250006303889", "marstall MashToGo (500 g Beutel)",                   "Stück",   2.75,  1.82, "Universal Plus · Portionsbeutel"],
    ["4250006305081", "marstall Bonus Leinsnack (750 g Eimer)",             "Stück",   9.55,  5.65, "Universal Plus"],
    ["4250006303384", "marstall Bonus Leinsnack (5 kg Eimer)",              "Stück",  35.35, 22.82, "Universal Plus"],
    ["4250006300932", "marstall Bonus Leinsnack (20 kg Sack)",              "Sack",   82.60, 62.20, "Universal Plus"],
    ["4250753400015", "marstall Granutop – das starke Trio für den Darm (14,5 kg Sack)", "Sack", 75.95, 56.35, "Universal Plus"],
    ["4250753400039", "marstall Granutop (6 kg Eimer)",                     "Stück",  41.95, 30.50, "Universal Plus"],
    ["4250006305180", "marstall Granutop (9 kg Karton)",                    "Stück",  90.70, 65.99, "Universal Plus"],
    ["4250006305166", "marstall Granutop (1 kg Beutel)",                    "Stück",  11.00,  7.35, "Universal Plus"],
    ["4250006306170", "marstall Leinöl kalt gepresst (1 Liter Kanister)",   "Stück",  11.45,  8.65, "Universal Plus"],
    ["4250006306194", "marstall Leinöl kalt gepresst (5 Liter Kanister)",   "Stück",  29.80, 22.00, "Universal Plus"],
    ["4250006305074", "marstall Kollagen (1,5 kg Eimer)",                   "Stück",  51.95, 41.20, "Universal Plus"],
    ["4250006304886", "marstall Magnesium – getreidefrei & pelletiert (1 kg Beutel)", "Stück", 32.50, 23.95, "Universal Plus"],
    ["4250006304893", "marstall Magnesium (3 kg Eimer)",                    "Stück",  74.25, 55.20, "Universal Plus"],
    ["4250006304923", "marstall Biotin & Zink – getreidefrei & pelletiert (1 kg Beutel)", "Stück", 35.70, 24.30, "Universal Plus"],
    ["4250006304930", "marstall Biotin & Zink (3 kg Eimer)",                "Stück",  78.50, 58.35, "Universal Plus"],
    ["4250006304909", "marstall Elektrolyte – getreidefrei & pelletiert (1 kg Beutel)", "Stück", 30.25, 20.10, "Universal Plus"],
    ["4250006304916", "marstall Elektrolyte (3 kg Eimer)",                  "Stück",  62.90, 43.40, "Universal Plus"],
    ["4250006303063", "marstall Weide-Riegel – Mineralfutter-Riegel (2 kg Eimer)", "Stück", 17.95, 12.16, "Universal Plus"],
    ["4250006303070", "marstall Weide-Riegel (5 kg Eimer)",                 "Stück",  33.95, 22.80, "Universal Plus"],
    ["4250006303087", "marstall Weide-Riegel (20 kg Sack)",                 "Sack",   84.95, 59.30, "Universal Plus"],
    ["4250006303223", "marstall Stall-Riegel – Mineral- und Vitamin Riegel (2 kg Eimer)", "Stück", 19.95, 13.66, "Universal Plus"],
    ["4250006303230", "marstall Stall-Riegel (5 kg Eimer)",                 "Stück",  36.95, 25.33, "Universal Plus"],
    ["4250006303247", "marstall Stall-Riegel (20 kg Sack)",                 "Sack",   96.95, 68.55, "Universal Plus"],
    ["4250006304749", "marstall Salzstein (Karton 6x Stück)",               "Stück",  43.75, 27.98, "Universal Plus"],
    ["4250006303711", "marstall Salzstein (Stück)",                         "Stück",   6.80,  4.50, "Universal Plus"],
    ["4250006304947", "marstall Vitamin E & Selen – getreidefrei & pelletiert (1 kg Beutel)", "Stück", 32.75, 24.15, "Universal Plus"],
    ["4250006304954", "marstall Vitamin E & Selen (3 kg Eimer)",            "Stück",  72.90, 54.50, "Universal Plus"],
  ];

  for (const [nr, name, einheit, vk, ek, beschr] of marstallUniversalPlus) {
    await upsertArtikel(nr, name, "Pferdefutter", einheit, vk, 7, ek, marstall.id, beschr);
  }

  // ── Artikel: marstall Fankleidung & Stallzubehör ─────────────────────────

  const marstallZubehoer: Array<[string, string, string, number, number, number]> = [
    // [artikelnummer, name, einheit, vk-inkl-19%, ek-ohne-mwst, mwstSatz]
    ["4250006305043", "marstall Fan-Jacke Damen",                        "Stück",  71.90, 57.80, 19],
    ["4250006305050", "marstall Fan-Jacke Herren",                       "Stück",  71.90, 57.80, 19],
    ["4250006305029", "marstall Fan-Weste Damen",                        "Stück",  66.50, 52.95, 19],
    ["4250006305036", "marstall Fan-Weste Herren",                       "Stück",  66.50, 52.95, 19],
    ["MARS-Z001-D",   "marstall Zipper-Hoodie Damen",                    "Stück",  49.95, 39.50, 19],
    ["MARS-Z001-H",   "marstall Zipper-Hoodie Herren",                   "Stück",  49.95, 39.50, 19],
    ["4250006305005", "marstall Poloshirt Damen",                        "Stück",  23.95, 19.20, 19],
    ["4250006305012", "marstall Poloshirt Herren",                       "Stück",  23.95, 19.20, 19],
    ["MARS-Z002-D",   "marstall T-Shirt Damen",                         "Stück",  14.95, 12.56, 19],
    ["MARS-Z002-H",   "marstall T-Shirt Herren",                        "Stück",  14.95, 12.56, 19],
    ["4250006305319", "marstall Trucker-Cap (unisex)",                   "Stück",   7.35,  6.00, 19],
    ["4250006305067", "marstall Cap (unisex)",                           "Stück",   7.35,  6.00, 19],
    ["4250006304442", "marstall Futtertonne mit Logo",                   "Stück",  17.95, 14.50, 19],
    ["4250006302356", "marstall Futterbecher mit Logo",                  "Stück",   2.90,  2.32, 19],
    ["4250006304398", "marstall Supreme Futterbecher mit Logo",          "Stück",   3.30,  2.62, 19],
    ["4250006302363", "marstall Eimer 5 Liter mit Logo",                "Stück",   1.45,  1.17, 19],
    ["MARS-Z003",     "marstall Eimer 15 Liter mit Logo",               "Stück",   4.20,  3.33, 19],
    ["MARS-Z004",     "marstall Flexitrog mit Logo",                    "Stück",   8.30,  4.50, 19],
    ["MARS-Z005",     "marstall Müslischüssel mit Logo",                "Stück",   5.75,  4.59, 19],
    ["4250006302349", "marstall Fütterungstafel mit Logo",              "Stück",   4.00,  3.24, 19],
    ["MARS-Z006",     "marstall Zuchttafel mit Logo",                   "Stück",   4.00,  3.24, 19],
    ["4250006304459", "marstall Abfüllhahn für 5 l Kanister Lein-Distel-Öl", "Stück", 4.15, 3.30, 19],
    ["MARS-Z007",     "marstall Decke Polarfleece (Abschwitzfunktion)", "Stück",  49.95, 40.28, 19],
    ["MARS-Z008",     "marstall Schabracke mit Logo",                   "Stück",  33.95, 27.38, 19],
  ];

  for (const [nr, name, einheit, vk, ek, mwst] of marstallZubehoer) {
    await upsertArtikel(nr, name, "Stallzubehoer", einheit, vk, mwst, ek, marstall.id);
  }

  // ── Artikel: Schwefelprodukte (BvG Agrar) ────────────────────────────────

  const schwefelProdukte: Array<[string, string, string, number]> = [
    // [artikelnummer, name, einheit, vk] — EK wird auf 72 % des VK geschätzt
    ["SUL-001", "Sulfomix® plus – 90 % S Schwefel + 9 % Geruchs-/Stickstoffbindemittel (25 kg Sack)",   "Sack",    31.25],
    ["SUL-002", "Sulfomix® plus (600 kg Big Bag)",                                                        "Stück",  720.00],
    ["SUL-003", "Sulfomix® plus (1.000 kg Big Bag)",                                                      "Stück", 1200.00],
    ["SUL-004", "SulfoLins® 90 – Schwefellinsen zum Streuen, 90 % S, 10 % Bentonit (25 kg Sack)",        "Sack",    23.50],
    ["SUL-005", "SulfoLins® 90 (600 kg Big Bag)",                                                         "Stück",  534.00],
    ["SUL-006", "SulfoLins® 90 (1.000 kg Big Bag)",                                                       "Stück",  890.00],
    ["SUL-007", "SulfoLins® S+Selen – 90 % S Schwefel, 0,02 % Selen, 10 % Bentonit (25 kg Sack)",       "Sack",    27.75],
    ["SUL-008", "SulfoLins® S+Selen (600 kg Big Bag)",                                                    "Stück",  636.00],
    ["SUL-009", "SulfoLins® S+Selen (1.000 kg Big Bag)",                                                  "Stück", 1060.00],
    ["SUL-010", "SulfoLins® S+B – 77 % S Schwefel, 2 % Bor, 10 % Bentonit (25 kg Sack)",                "Sack",    28.50],
    ["SUL-011", "SulfoLins® S+B (600 kg Big Bag)",                                                        "Stück",  654.00],
    ["SUL-012", "SulfoLins® S+B (1.000 kg Big Bag)",                                                      "Stück", 1090.00],
    ["SUL-013", "SulfoLins® S+B+S – 77 % S Schwefel, 2 % Bor, 0,02 % Selen, 10 % Bentonit (25 kg Sack)", "Sack",  30.50],
    ["SUL-014", "SulfoLins® S+B+S (600 kg Big Bag)",                                                      "Stück",  702.00],
    ["SUL-015", "SulfoLins® S+B+S (1.000 kg Big Bag)",                                                    "Stück", 1170.00],
    ["SUL-016", "Sulfogran® S+B – Granulat zum Streuen, 77 % S, 2 % Bor, 10 % Bentonit (25 kg Sack)",   "Sack",    28.50],
    ["SUL-017", "Sulfogran® S+B (600 kg Big Bag)",                                                        "Stück",  654.00],
    ["SUL-018", "Sulfogran® S+B (1.000 kg Big Bag)",                                                      "Stück", 1090.00],
    ["SUL-019", "Sulfogran® – Granulat zum Streuen, 90 % S, 10 % Bentonit (25 kg Sack)",                 "Sack",    23.50],
    ["SUL-020", "Sulfogran® (500 kg Big Bag)",                                                            "Stück",  445.00],
    ["SUL-021", "Sulfogran® (1.000 kg Big Bag)",                                                          "Stück",  890.00],
    ["SUL-022", "SCHWEDOKAL® 80 flüssig – 56,9 % S Schwefel, 800 g/l (10 l Kanister)",                  "Stück",   44.75],
    ["SUL-023", "SCHWEDOKAL® 80 flüssig (600 l Gitterbox)",                                              "Stück", 2100.00],
    ["SUL-024", "SCHWEDOKAL® 80 flüssig (1.000 l Gitterbox)",                                            "Stück", 2900.00],
    ["SUL-025", "BvG Boden aktiv – Effektive Mikroorganismen, Bodenverbesserung (500 l Box)",            "Stück",  575.00],
    ["SUL-026", "BvG Boden aktiv (1.000 l Box)",                                                         "Stück",  910.00],
    ["SUL-027", "BvG-Bor 17,4 G – 17,4 % Bor, wasserlösliches Bor, Borsäure (25 kg Sack)",             "Sack",    60.00],
  ];

  for (const [nr, name, einheit, vk] of schwefelProdukte) {
    await upsertArtikel(nr, name, "Pflanzenhilfsmittel", einheit, vk, 7, Math.round(vk * 0.72 * 100) / 100, bvgAgrar.id, "FiBL-gelistet");
  }

  // ── Aufgabe: Service-Worker-Fehler untersuchen ────────────────────────────

  await prisma.aufgabe.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      betreff: "Service-Worker-Fehler auf Produktionsseite untersuchen",
      beschreibung: [
        "Folgende Fehler in der Browser-Konsole auf anni.straub-it.de aufgetreten:",
        "",
        "1. sw.js: 'Failed to convert value to Response' → caches.match() liefert undefined bei Cache-Miss; event.respondWith() erwartet aber ein Response-Objekt. Fix: r ?? Response.error() ergänzt.",
        "2. React Minified Error #310 (useEffect) → Wahrscheinlich setState-Aufruf in useEffect ohne korrekte Abhängigkeiten oder Conditional Hook. Betroffene Komponente in minifiziertem Build identifizieren.",
        "3. 'synchronous response by returning true, but the message channel closed' → Browser-Extension-Fehler, kein App-Bug. Kann ignoriert werden.",
        "",
        "Nächste Schritte: Dev-Build deployen und React-Fehlermeldung im Klartext lesen.",
      ].join("\n"),
      faelligAm: new Date("2026-04-05"),
      prioritaet: "hoch",
      typ: "aufgabe",
      erledigt: false,
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
  console.log("   Lieferanten: 6 (AgriChem, Saatgut Nord, FutterKing, Bayer, marstall, BvG Agrar)");
  console.log("   Artikel: ~120 (6 Dünger, 5 Saatgut, 5 Futter, 35 marstall Universal, 41 marstall Universal Plus, 24 marstall Zubehör/Fankleidung, 27 Schwefelprodukte)");
  console.log("   Kunden: 3 (Hof Brandes, Gestüt Sonnenhügel, Familie Schulze)");
  console.log("   Aufgaben: 1 (Service-Worker-Fehler)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
