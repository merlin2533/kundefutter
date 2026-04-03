// Vordefinierte Artikel-Stammdaten für den manuellen Import über Einstellungen

export interface StammdatenInhaltsstoff {
  name: string;
  menge?: number | null;
  einheit?: string | null;
}

export interface StammdatenArtikel {
  artikelnummer: string;
  name: string;
  kategorie: string;
  einheit: string;
  standardpreis: number;
  mwstSatz: number;
  einkaufspreis: number;
  mindestbestand: number;
  beschreibung?: string;
  inhaltsstoffe?: StammdatenInhaltsstoff[];
  lieferantName: string;
}

export interface StammdatenGruppe {
  titel: string;
  lieferantName: string;
  lieferantInfo: {
    ansprechpartner: string;
    email: string;
    telefon: string;
    strasse: string;
    plz: string;
    ort: string;
    notizen: string;
  };
  artikel: StammdatenArtikel[];
}

const MARSTALL_LIEFERANT = {
  name: "marstall GmbH & Co. KG",
  ansprechpartner: "Vertrieb Außendienst",
  email: "vertrieb@marstall.eu",
  telefon: "05439 9409-0",
  strasse: "Mühlendamm 20",
  plz: "49593",
  ort: "Bersenbrück",
  notizen: "Pferdefutter & Stallzubehör. 14 Tage netto Kasse / 8 Tage 2 % Skonto. Händler-EK ab 750 kg. Preisliste Feb. 2026.",
};

const BVG_LIEFERANT = {
  name: "BvG Agrar GmbH",
  ansprechpartner: "",
  email: "",
  telefon: "",
  strasse: "",
  plz: "",
  ort: "",
  notizen: "Schwefelprodukte (Sulfolinsen, Sulfogranulat, Schwedokal), Bodenverbesserung, Bordünger. FiBL-gelistet.",
};

function marstall(
  artikelnummer: string,
  name: string,
  einheit: string,
  standardpreis: number,
  einkaufspreis: number,
  mwstSatz = 7,
  beschreibung?: string,
): StammdatenArtikel {
  return {
    artikelnummer,
    name,
    kategorie: mwstSatz === 19 ? "Stallzubehoer" : "Pferdefutter",
    einheit,
    standardpreis,
    mwstSatz,
    einkaufspreis,
    mindestbestand: 5,
    beschreibung,
    lieferantName: MARSTALL_LIEFERANT.name,
  };
}

function bvg(
  artikelnummer: string,
  name: string,
  einheit: string,
  standardpreis: number,
  inhaltsstoffe?: StammdatenInhaltsstoff[],
): StammdatenArtikel {
  return {
    artikelnummer,
    name,
    kategorie: "Pflanzenhilfsmittel",
    einheit,
    standardpreis,
    mwstSatz: 7,
    einkaufspreis: Math.round(standardpreis * 0.72 * 100) / 100,
    mindestbestand: 5,
    beschreibung: "FiBL-gelistet",
    inhaltsstoffe,
    lieferantName: BVG_LIEFERANT.name,
  };
}

export const STAMMDATEN_GRUPPEN: StammdatenGruppe[] = [
  {
    titel: "marstall – Universal / Sport / Raufutter / Zucht / Vet / Vet Pro",
    lieferantName: MARSTALL_LIEFERANT.name,
    lieferantInfo: MARSTALL_LIEFERANT,
    artikel: [
      marstall("4250006300017", "marstall Haferfrei – das Original (20 kg Sack)",             "Sack",  22.80, 17.61),
      marstall("4250006300116", "marstall Freizeit – leicht beanspruchte Pferde (20 kg Sack)","Sack",  19.95, 15.70),
      marstall("4250006300369", "marstall Senior Plus – Anti-Aging Müsli (20 kg Sack)",       "Sack",  28.95, 22.30),
      marstall("4250006300208", "marstall Vito – getreide-/melassefreie Energie (20 kg Sack)","Sack",  32.60, 24.86),
      marstall("4250006305210", "marstall Senior-Aktiv – getreidefreie Aufbaumüsli (20 kg Sack)", "Sack", 42.40, 32.02),
      marstall("4250006305753", "marstall BodyForm-Müsli – das Aufbau-Futter (20 kg Sack)",   "Sack",  29.95, 23.80),
      marstall("4250006303810", "marstall Faser-Light – melassefrei, stärke-/zuckerarm (15 kg Sack)", "Sack", 29.30, 22.79),
      marstall("4250006305418", "marstall Naturell-Mix (15 kg Sack)",                         "Sack",  23.95, 17.76),
      marstall("4250006306163", "marstall Naturell-Pro – Getreidefrei Mix (15 kg Sack)",      "Sack",  29.80, 23.39),
      marstall("4250006304527", "marstall Alpaka+Co (15 kg Sack)",                            "Sack",  21.70, 16.38),
      marstall("4250006303797", "marstall Schwarz-Gold-Hafer (25 kg Sack)",                   "Sack",  28.95, 24.45),
      // Sport
      marstall("4250006306224", "marstall Sport-Amino (15 kg Sack)",                          "Sack",  29.95, 23.55),
      marstall("4250006306248", "marstall Sport-Energy (15 kg Sack)",                         "Sack",  21.95, 17.15),
      marstall("4250006306262", "marstall Western (15 kg Sack)",                              "Sack",  22.90, 17.75),
      // Raufutter
      marstall("4250006305654", "marstall Wiesen-Cobs aus dem Allgäu (20 kg Sack)",           "Sack",  22.75, 18.30),
      marstall("4250006305739", "marstall Wiesen-Fasern aus dem Allgäu (12,5 kg Sack)",       "Sack",  17.90, 13.85),
      marstall("4250006306187", "marstall Wiesen-Chips aus dem Allgäu (20 kg Sack)",          "Sack",  23.90, 19.20),
      marstall("4250006305838", "marstall Basis Luzerne Mix (15 kg Ballen)",                  "Stück", 23.70, 18.90),
      // Zucht
      marstall("4250006305807", "marstall Zucht-Klassik – Stute, Hengst & Fohlen (20 kg Sack)", "Sack", 29.60, 23.08),
      marstall("4250006305784", "marstall Zucht-Aktiv – getreidefrei (20 kg Sack)",           "Sack",  39.60, 31.28),
      marstall("4250006305791", "marstall Fohlen-Aktiv – getreidefrei aufwachsen (20 kg Sack)", "Sack", 40.80, 32.52),
      marstall("4250006303421", "marstall Fohlen-Milchpulver (20 kg Sack)",                   "Sack", 127.90, 101.20),
      marstall("4250006303438", "marstall Fohlen-NOT-Paket (1 Eimer)",                        "Stück", 163.00, 135.75),
      // Vet
      marstall("4250006305203", "marstall Gastro-Müsli – schonende Magenmüsli (20 kg Sack)",  "Sack",  35.60, 25.68),
      marstall("4250006305647", "marstall MyoCare-Müsli – Ernährung für PSSMler (15 kg Sack)","Sack",  42.50, 33.17),
      marstall("4250006305746", "marstall Haut-Vital – energiearme Müsli (15 kg Sack)",       "Sack",  35.15, 27.41),
      marstall("4250006303315", "marstall Sinfonie – Natur-Kräutermüsli (15 kg Sack)",        "Sack",  30.45, 22.79),
      // Vet Pro
      marstall("4250006305173", "marstall FlexoFit (1,7 kg Eimer)",                           "Stück",  79.00, 62.73),
      marstall("4250006304855", "marstall ProAir (2 kg Eimer)",                               "Stück",  69.00, 52.70),
      marstall("4250006305814", "marstall ProGastro (3 kg Eimer)",                            "Stück",  89.00, 68.25),
      marstall("4250006305685", "marstall Huf-Regulator – getreidefreie Huf-Formel (3,5 kg Eimer)", "Stück", 43.20, 28.26),
      marstall("4250006305692", "marstall Huf-Regulator (10 kg Eimer)",                       "Stück",  94.50, 63.00),
      marstall("4250006305708", "marstall Huf-Regulator (10 kg Sack)",                        "Sack",   84.85, 62.50),
      marstall("4250006304466", "marstall Darm-Regulator – 3-fach Ansatz gegen Kotwasser (3,5 kg Eimer)", "Stück", 41.00, 26.81),
      marstall("4250006306156", "marstall Darm-Regulator (10 kg Eimer)",                      "Stück",  89.45, 61.00),
    ],
  },
  {
    titel: "marstall – Universal Plus (Ergänzungsfutter & Mineralien)",
    lieferantName: MARSTALL_LIEFERANT.name,
    lieferantInfo: MARSTALL_LIEFERANT,
    artikel: [
      marstall("4250006304701", "marstall Bergwiesen-Mash (12,5 kg Sack)",            "Sack",  29.45, 21.89, 7, "Universal Plus · Getreide- und melassefreies Mash"),
      marstall("4250006304695", "marstall Bergwiesen-Mash (5 kg Eimer)",              "Stück", 19.60, 13.88, 7, "Universal Plus · Getreide- und melassefreies Mash"),
      marstall("4250006304763", "marstall Bergwiesen-MashToGo (7 kg Karton)",         "Stück", 45.15, 29.25, 7, "Universal Plus"),
      marstall("4250006304756", "marstall Bergwiesen-MashToGo (350 g Beutel)",        "Stück",  2.95,  1.95, 7, "Universal Plus · Portionsbeutel"),
      marstall("4250006305661", "marstall Amino-Muskel – getreidefreier Protein-Mix (3,5 kg Eimer)", "Stück", 53.95, 34.65, 7, "Universal Plus"),
      marstall("4250006305678", "marstall Amino-Muskel (10 kg Eimer)",                "Stück", 134.95, 88.10, 7, "Universal Plus"),
      marstall("4250006305715", "marstall Amino-Muskel (10 kg Sack)",                 "Sack", 116.90, 85.90, 7, "Universal Plus"),
      marstall("4250006305845", "marstall MineralOrganic+ (3,5 kg Eimer)",            "Stück",  59.95, 43.75, 7, "Universal Plus"),
      marstall("4250006305852", "marstall MineralOrganic+ (10 kg Eimer)",             "Stück", 165.95, 121.10, 7, "Universal Plus"),
      marstall("4250006306132", "marstall Force – Getreidefreies Mineralfutter (3,5 kg Eimer)", "Stück", 17.95, 12.32, 7, "Universal Plus"),
      marstall("4250006300697", "marstall Force (10 kg Eimer)",                       "Stück",  34.70, 23.95, 7, "Universal Plus"),
      marstall("4250006304862", "marstall Force (10 kg Sack)",                        "Sack",   30.50, 20.65, 7, "Universal Plus"),
      marstall("4250006300642", "marstall Force (20 kg Sack)",                        "Sack",   59.35, 41.20, 7, "Universal Plus"),
      marstall("4250006306149", "marstall Mash (12,5 kg Sack)",                       "Sack",   21.50, 16.69, 7, "Universal Plus"),
      marstall("4250006303872", "marstall MashToGo (10 kg Sack)",                     "Sack",   37.45, 28.75, 7, "Universal Plus · Die praktische Mash-Portionspackung"),
      marstall("4250006303889", "marstall MashToGo (500 g Beutel)",                   "Stück",   2.75,  1.82, 7, "Universal Plus · Portionsbeutel"),
      marstall("4250006305081", "marstall Bonus Leinsnack (750 g Eimer)",             "Stück",   9.55,  5.65, 7, "Universal Plus"),
      marstall("4250006303384", "marstall Bonus Leinsnack (5 kg Eimer)",              "Stück",  35.35, 22.82, 7, "Universal Plus"),
      marstall("4250006300932", "marstall Bonus Leinsnack (20 kg Sack)",              "Sack",   82.60, 62.20, 7, "Universal Plus"),
      marstall("4250753400015", "marstall Granutop – das starke Trio für den Darm (14,5 kg Sack)", "Sack", 75.95, 56.35, 7, "Universal Plus"),
      marstall("4250753400039", "marstall Granutop (6 kg Eimer)",                     "Stück",  41.95, 30.50, 7, "Universal Plus"),
      marstall("4250006305180", "marstall Granutop (9 kg Karton)",                    "Stück",  90.70, 65.99, 7, "Universal Plus"),
      marstall("4250006305166", "marstall Granutop (1 kg Beutel)",                    "Stück",  11.00,  7.35, 7, "Universal Plus"),
      marstall("4250006306170", "marstall Leinöl kalt gepresst (1 Liter Kanister)",   "Stück",  11.45,  8.65, 7, "Universal Plus"),
      marstall("4250006306194", "marstall Leinöl kalt gepresst (5 Liter Kanister)",   "Stück",  29.80, 22.00, 7, "Universal Plus"),
      marstall("4250006305074", "marstall Kollagen (1,5 kg Eimer)",                   "Stück",  51.95, 41.20, 7, "Universal Plus"),
      marstall("4250006304886", "marstall Magnesium – getreidefrei & pelletiert (1 kg Beutel)", "Stück", 32.50, 23.95, 7, "Universal Plus"),
      marstall("4250006304893", "marstall Magnesium (3 kg Eimer)",                    "Stück",  74.25, 55.20, 7, "Universal Plus"),
      marstall("4250006304923", "marstall Biotin & Zink – getreidefrei & pelletiert (1 kg Beutel)", "Stück", 35.70, 24.30, 7, "Universal Plus"),
      marstall("4250006304930", "marstall Biotin & Zink (3 kg Eimer)",                "Stück",  78.50, 58.35, 7, "Universal Plus"),
      marstall("4250006304909", "marstall Elektrolyte – getreidefrei & pelletiert (1 kg Beutel)", "Stück", 30.25, 20.10, 7, "Universal Plus"),
      marstall("4250006304916", "marstall Elektrolyte (3 kg Eimer)",                  "Stück",  62.90, 43.40, 7, "Universal Plus"),
      marstall("4250006303063", "marstall Weide-Riegel – Mineralfutter-Riegel (2 kg Eimer)", "Stück", 17.95, 12.16, 7, "Universal Plus"),
      marstall("4250006303070", "marstall Weide-Riegel (5 kg Eimer)",                 "Stück",  33.95, 22.80, 7, "Universal Plus"),
      marstall("4250006303087", "marstall Weide-Riegel (20 kg Sack)",                 "Sack",   84.95, 59.30, 7, "Universal Plus"),
      marstall("4250006303223", "marstall Stall-Riegel – Mineral- und Vitamin Riegel (2 kg Eimer)", "Stück", 19.95, 13.66, 7, "Universal Plus"),
      marstall("4250006303230", "marstall Stall-Riegel (5 kg Eimer)",                 "Stück",  36.95, 25.33, 7, "Universal Plus"),
      marstall("4250006303247", "marstall Stall-Riegel (20 kg Sack)",                 "Sack",   96.95, 68.55, 7, "Universal Plus"),
      marstall("4250006304749", "marstall Salzstein (Karton 6x Stück)",               "Stück",  43.75, 27.98, 7, "Universal Plus"),
      marstall("4250006303711", "marstall Salzstein (Stück)",                         "Stück",   6.80,  4.50, 7, "Universal Plus"),
      marstall("4250006304947", "marstall Vitamin E & Selen – getreidefrei & pelletiert (1 kg Beutel)", "Stück", 32.75, 24.15, 7, "Universal Plus"),
      marstall("4250006304954", "marstall Vitamin E & Selen (3 kg Eimer)",            "Stück",  72.90, 54.50, 7, "Universal Plus"),
    ],
  },
  {
    titel: "marstall – Fankleidung & Stallzubehör",
    lieferantName: MARSTALL_LIEFERANT.name,
    lieferantInfo: MARSTALL_LIEFERANT,
    artikel: [
      marstall("4250006305043", "marstall Fan-Jacke Damen",                        "Stück",  71.90, 57.80, 19),
      marstall("4250006305050", "marstall Fan-Jacke Herren",                       "Stück",  71.90, 57.80, 19),
      marstall("4250006305029", "marstall Fan-Weste Damen",                        "Stück",  66.50, 52.95, 19),
      marstall("4250006305036", "marstall Fan-Weste Herren",                       "Stück",  66.50, 52.95, 19),
      marstall("MARS-Z001-D",   "marstall Zipper-Hoodie Damen",                    "Stück",  49.95, 39.50, 19),
      marstall("MARS-Z001-H",   "marstall Zipper-Hoodie Herren",                   "Stück",  49.95, 39.50, 19),
      marstall("4250006305005", "marstall Poloshirt Damen",                        "Stück",  23.95, 19.20, 19),
      marstall("4250006305012", "marstall Poloshirt Herren",                       "Stück",  23.95, 19.20, 19),
      marstall("MARS-Z002-D",   "marstall T-Shirt Damen",                         "Stück",  14.95, 12.56, 19),
      marstall("MARS-Z002-H",   "marstall T-Shirt Herren",                        "Stück",  14.95, 12.56, 19),
      marstall("4250006305319", "marstall Trucker-Cap (unisex)",                   "Stück",   7.35,  6.00, 19),
      marstall("4250006305067", "marstall Cap (unisex)",                           "Stück",   7.35,  6.00, 19),
      marstall("4250006304442", "marstall Futtertonne mit Logo",                   "Stück",  17.95, 14.50, 19),
      marstall("4250006302356", "marstall Futterbecher mit Logo",                  "Stück",   2.90,  2.32, 19),
      marstall("4250006304398", "marstall Supreme Futterbecher mit Logo",          "Stück",   3.30,  2.62, 19),
      marstall("4250006302363", "marstall Eimer 5 Liter mit Logo",                "Stück",   1.45,  1.17, 19),
      marstall("MARS-Z003",     "marstall Eimer 15 Liter mit Logo",               "Stück",   4.20,  3.33, 19),
      marstall("MARS-Z004",     "marstall Flexitrog mit Logo",                    "Stück",   8.30,  4.50, 19),
      marstall("MARS-Z005",     "marstall Müslischüssel mit Logo",                "Stück",   5.75,  4.59, 19),
      marstall("4250006302349", "marstall Fütterungstafel mit Logo",              "Stück",   4.00,  3.24, 19),
      marstall("MARS-Z006",     "marstall Zuchttafel mit Logo",                   "Stück",   4.00,  3.24, 19),
      marstall("4250006304459", "marstall Abfüllhahn für 5 l Kanister Lein-Distel-Öl", "Stück", 4.15, 3.30, 19),
      marstall("MARS-Z007",     "marstall Decke Polarfleece (Abschwitzfunktion)", "Stück",  49.95, 40.28, 19),
      marstall("MARS-Z008",     "marstall Schabracke mit Logo",                   "Stück",  33.95, 27.38, 19),
    ],
  },
  {
    titel: "BvG Agrar – Schwefelprodukte (Sulfolinsen, Sulfogran, Schwedokal)",
    lieferantName: BVG_LIEFERANT.name,
    lieferantInfo: BVG_LIEFERANT,
    artikel: [
      bvg("SUL-001", "Sulfomix® plus – 90 % S Schwefel + 9 % Geruchs-/Stickstoffbindemittel (25 kg Sack)",    "Sack",    31.25,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Geruchs-/Stickstoffbindemittel", menge: 9, einheit: "%" }]),
      bvg("SUL-002", "Sulfomix® plus (600 kg Big Bag)",                                                         "Stück",  720.00,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Geruchs-/Stickstoffbindemittel", menge: 9, einheit: "%" }]),
      bvg("SUL-003", "Sulfomix® plus (1.000 kg Big Bag)",                                                       "Stück", 1200.00,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Geruchs-/Stickstoffbindemittel", menge: 9, einheit: "%" }]),
      bvg("SUL-004", "SulfoLins® 90 – Schwefellinsen zum Streuen, 90 % S, 10 % Bentonit (25 kg Sack)",         "Sack",    23.50,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-005", "SulfoLins® 90 (600 kg Big Bag)",                                                          "Stück",  534.00,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-006", "SulfoLins® 90 (1.000 kg Big Bag)",                                                        "Stück",  890.00,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-007", "SulfoLins® S+Selen – 90 % S Schwefel, 0,02 % Selen, 10 % Bentonit (25 kg Sack)",        "Sack",    27.75,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Selen (Se)", menge: 0.02, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-008", "SulfoLins® S+Selen (600 kg Big Bag)",                                                     "Stück",  636.00,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Selen (Se)", menge: 0.02, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-009", "SulfoLins® S+Selen (1.000 kg Big Bag)",                                                   "Stück", 1060.00,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Selen (Se)", menge: 0.02, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-010", "SulfoLins® S+B – 77 % S Schwefel, 2 % Bor, 10 % Bentonit (25 kg Sack)",                 "Sack",    28.50,
        [{ name: "Schwefel (S)", menge: 77, einheit: "%" }, { name: "Bor (B)", menge: 2, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-011", "SulfoLins® S+B (600 kg Big Bag)",                                                         "Stück",  654.00,
        [{ name: "Schwefel (S)", menge: 77, einheit: "%" }, { name: "Bor (B)", menge: 2, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-012", "SulfoLins® S+B (1.000 kg Big Bag)",                                                       "Stück", 1090.00,
        [{ name: "Schwefel (S)", menge: 77, einheit: "%" }, { name: "Bor (B)", menge: 2, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-013", "SulfoLins® S+B+S – 77 % S Schwefel, 2 % Bor, 0,02 % Selen, 10 % Bentonit (25 kg Sack)", "Sack",   30.50,
        [{ name: "Schwefel (S)", menge: 77, einheit: "%" }, { name: "Bor (B)", menge: 2, einheit: "%" }, { name: "Selen (Se)", menge: 0.02, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-014", "SulfoLins® S+B+S (600 kg Big Bag)",                                                       "Stück",  702.00,
        [{ name: "Schwefel (S)", menge: 77, einheit: "%" }, { name: "Bor (B)", menge: 2, einheit: "%" }, { name: "Selen (Se)", menge: 0.02, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-015", "SulfoLins® S+B+S (1.000 kg Big Bag)",                                                     "Stück", 1170.00,
        [{ name: "Schwefel (S)", menge: 77, einheit: "%" }, { name: "Bor (B)", menge: 2, einheit: "%" }, { name: "Selen (Se)", menge: 0.02, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-016", "Sulfogran® S+B – Granulat zum Streuen, 77 % S, 2 % Bor, 10 % Bentonit (25 kg Sack)",    "Sack",    28.50,
        [{ name: "Schwefel (S)", menge: 77, einheit: "%" }, { name: "Bor (B)", menge: 2, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-017", "Sulfogran® S+B (600 kg Big Bag)",                                                         "Stück",  654.00,
        [{ name: "Schwefel (S)", menge: 77, einheit: "%" }, { name: "Bor (B)", menge: 2, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-018", "Sulfogran® S+B (1.000 kg Big Bag)",                                                       "Stück", 1090.00,
        [{ name: "Schwefel (S)", menge: 77, einheit: "%" }, { name: "Bor (B)", menge: 2, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-019", "Sulfogran® – Granulat zum Streuen, 90 % S, 10 % Bentonit (25 kg Sack)",                  "Sack",    23.50,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-020", "Sulfogran® (500 kg Big Bag)",                                                             "Stück",  445.00,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-021", "Sulfogran® (1.000 kg Big Bag)",                                                           "Stück",  890.00,
        [{ name: "Schwefel (S)", menge: 90, einheit: "%" }, { name: "Bentonit", menge: 10, einheit: "%" }]),
      bvg("SUL-022", "SCHWEDOKAL® 80 flüssig – 56,9 % S Schwefel, 800 g/l (10 l Kanister)",                   "Stück",   44.75,
        [{ name: "Schwefel (S)", menge: 56.9, einheit: "%" }, { name: "Dichte", menge: 800, einheit: "g/l" }]),
      bvg("SUL-023", "SCHWEDOKAL® 80 flüssig (600 l Gitterbox)",                                               "Stück", 2100.00,
        [{ name: "Schwefel (S)", menge: 56.9, einheit: "%" }, { name: "Dichte", menge: 800, einheit: "g/l" }]),
      bvg("SUL-024", "SCHWEDOKAL® 80 flüssig (1.000 l Gitterbox)",                                             "Stück", 2900.00,
        [{ name: "Schwefel (S)", menge: 56.9, einheit: "%" }, { name: "Dichte", menge: 800, einheit: "g/l" }]),
      bvg("SUL-025", "BvG Boden aktiv – Effektive Mikroorganismen, Bodenverbesserung (500 l Box)",             "Stück",  575.00,
        [{ name: "Effektive Mikroorganismen", menge: null, einheit: null }]),
      bvg("SUL-026", "BvG Boden aktiv (1.000 l Box)",                                                          "Stück",  910.00,
        [{ name: "Effektive Mikroorganismen", menge: null, einheit: null }]),
      bvg("SUL-027", "BvG-Bor 17,4 G – 17,4 % Bor, wasserlösliches Bor, Borsäure (25 kg Sack)",              "Sack",    60.00,
        [{ name: "Bor (B)", menge: 17.4, einheit: "%" }]),
    ],
  },
];

/** Alle Artikel flach als Array */
export const ALLE_STAMMDATEN_ARTIKEL: StammdatenArtikel[] = STAMMDATEN_GRUPPEN.flatMap(
  (g) => g.artikel,
);
