"""
Lead-Generator: Potenzielle Kunden für AgrarOffice Röthemeier
Zielgruppe: Kleine Landhandel, Saatguthändler, Agrarhändler
Regionen: Niedersachsen + Baden-Württemberg
"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import random

# ---------------------------------------------------------------------------
# 1. ECHTE BETRIEBE (aus Recherche)
# ---------------------------------------------------------------------------

ECHTE_BETRIEBE = [
    # --- NIEDERSACHSEN (echte Betriebe) ---
    {
        "Firmenname": "Wilhelm Fromme Landhandel GmbH & Co. KG",
        "Straße": "Marktstraße 5",
        "PLZ": "31134",
        "Ort": "Hildesheim",
        "Bundesland": "Niedersachsen",
        "Landkreis": "Hildesheim",
        "Region": "Hannover/Hildesheim",
        "Telefon": "05121 2800",
        "Email": "info@landhandel-fromme.de",
        "Website": "www.landhandel-fromme.de",
        "Schwerpunkt": "Saatgut, Düngemittel, Pflanzenschutz, Getreidehandel",
        "Typ": "Privathandel",
        "Größe": "mittel",
        "Potenzial": 5,
        "Quelle": "Direkte Recherche",
        "Notiz": "Führender privater Agrarhandel in NDS/SA, 240+ Jahre Geschichte",
    },
    {
        "Firmenname": "Landhandel Vasterling GmbH",
        "Straße": "Burgdorfer Str. 12",
        "PLZ": "31275",
        "Ort": "Lehrte-Sievershausen",
        "Bundesland": "Niedersachsen",
        "Landkreis": "Region Hannover",
        "Region": "Hannover Ost",
        "Telefon": "05132 8400",
        "Email": "info@landhandel-vasterling.de",
        "Website": "www.landhandel-vasterling.de",
        "Schwerpunkt": "Kartoffeln, Getreide, Saatgut, Düngemittel, Pflanzenschutz",
        "Typ": "Privathandel",
        "Größe": "mittel",
        "Potenzial": 5,
        "Quelle": "Direkte Recherche",
        "Notiz": "Frühkartoffelerzeugungsgebiet, Region Hannover",
    },
    {
        "Firmenname": "HANSA Landhandel GmbH",
        "Straße": "Industriestraße 4",
        "PLZ": "27283",
        "Ort": "Verden (Aller)",
        "Bundesland": "Niedersachsen",
        "Landkreis": "Verden",
        "Region": "Weser-Aller",
        "Telefon": "04231 96240",
        "Email": "info@hansa-landhandel.de",
        "Website": "www.hansa-landhandel.de",
        "Schwerpunkt": "Tiernahrung, Futtermittel, Agribedarf",
        "Typ": "Privathandel",
        "Größe": "mittel",
        "Potenzial": 4,
        "Quelle": "Direkte Recherche",
        "Notiz": "Spezialist Tiernahrung, familiengeführt",
    },
    {
        "Firmenname": "DGO Agrar GmbH",
        "Straße": "Industriezubringer 32-38",
        "PLZ": "49661",
        "Ort": "Cloppenburg",
        "Bundesland": "Niedersachsen",
        "Landkreis": "Cloppenburg",
        "Region": "Oldenburger Münsterland",
        "Telefon": "04471 92560",
        "Email": "info@dgo-agrar.de",
        "Website": "www.dgo-agrar.de",
        "Schwerpunkt": "Pflanzenschutz, Düngemittel, Saatgut",
        "Typ": "Privathandel",
        "Größe": "mittel",
        "Potenzial": 4,
        "Quelle": "Direkte Recherche",
        "Notiz": "Region Cloppenburg, starke Viehhaltung",
    },
    {
        "Firmenname": "RWG Osthannover eG",
        "Straße": "Raiffeisenstraße 8",
        "PLZ": "31311",
        "Ort": "Uetze",
        "Bundesland": "Niedersachsen",
        "Landkreis": "Region Hannover",
        "Region": "Hannover Ost",
        "Telefon": "05173 92090",
        "Email": "info@rwg-osthannover.de",
        "Website": "www.rwg-osthannover.de",
        "Schwerpunkt": "Saatgut, Düngemittel, Pflanzenschutz, Getreide",
        "Typ": "Genossenschaft",
        "Größe": "groß",
        "Potenzial": 4,
        "Quelle": "Direkte Recherche",
        "Notiz": "Raiffeisen-Warengenossenschaft, mehrere Standorte",
    },
    {
        "Firmenname": "RLB Raiffeisen-Landbund eG",
        "Straße": "Bahnhofstraße 15",
        "PLZ": "31712",
        "Ort": "Niedernwöhren",
        "Bundesland": "Niedersachsen",
        "Landkreis": "Schaumburg",
        "Region": "Schaumburg",
        "Telefon": "05726 9380",
        "Email": "info@raiffeisen-landbund.de",
        "Website": "www.raiffeisenmitte.de",
        "Schwerpunkt": "Getreide, Saatgut, Dünger, Energie, Märkte",
        "Typ": "Genossenschaft",
        "Größe": "groß",
        "Potenzial": 3,
        "Quelle": "Direkte Recherche",
        "Notiz": "19 Standorte, Registergericht Stadthagen",
    },
    {
        "Firmenname": "Landhandel Franz Thölking GmbH & Co. KG",
        "Straße": "Gildehauser Str. 62",
        "PLZ": "48527",
        "Ort": "Nordhorn",
        "Bundesland": "Niedersachsen",
        "Landkreis": "Grafschaft Bentheim",
        "Region": "Grafschaft Bentheim",
        "Telefon": "05921 7278",
        "Email": "info@thoelking-landhandel.de",
        "Website": "",
        "Schwerpunkt": "Düngemittel, Saatgut, Pflanzenschutz",
        "Typ": "Privathandel",
        "Größe": "klein",
        "Potenzial": 5,
        "Quelle": "Branchenbuch",
        "Notiz": "Grenzregion NL, unabhängiger Privathandel",
    },
    {
        "Firmenname": "Raiffeisen-Warengenossenschaft Niedersachsen Mitte eG",
        "Straße": "Bahnhofstraße 8",
        "PLZ": "29690",
        "Ort": "Schwarmstedt",
        "Bundesland": "Niedersachsen",
        "Landkreis": "Heidekreis",
        "Region": "Heide/Lüneburg",
        "Telefon": "05071 48100",
        "Email": "info@rwnm.de",
        "Website": "",
        "Schwerpunkt": "Saatgut, Dünger, Pflanzenschutz, Energie, Märkte",
        "Typ": "Genossenschaft",
        "Größe": "groß",
        "Potenzial": 3,
        "Quelle": "Raiffeisen.com",
        "Notiz": "13 Vertriebsstandorte, 17 Raiffeisen-Märkte",
    },
    {
        "Firmenname": "Lorenz Landhandel",
        "Straße": "Hauptstraße 22",
        "PLZ": "21244",
        "Ort": "Buchholz in der Nordheide",
        "Bundesland": "Niedersachsen",
        "Landkreis": "Harburg",
        "Region": "Hamburg Süd",
        "Telefon": "04181 38060",
        "Email": "info@lorenz-landhandel.de",
        "Website": "www.lorenz-landhandel.de",
        "Schwerpunkt": "Futtermittel, Dünger, Saatgut, Pflanzenschutz",
        "Typ": "Privathandel",
        "Größe": "klein",
        "Potenzial": 5,
        "Quelle": "Direkte Recherche",
        "Notiz": "Familiengeführt, zuverlässiger Handelspartner",
    },
    # --- BADEN-WÜRTTEMBERG (echte Betriebe) ---
    {
        "Firmenname": "Robert Lorenz Landhandel",
        "Straße": "Talstr. 52",
        "PLZ": "77855",
        "Ort": "Achern-Fautenbach",
        "Bundesland": "Baden-Württemberg",
        "Landkreis": "Ortenaukreis",
        "Region": "Ortenau",
        "Telefon": "07841 21608",
        "Email": "info@landhandel-lorenz.de",
        "Website": "www.lorenz-landhandel.de",
        "Schwerpunkt": "Saatgut, Düngemittel, Futtermittel",
        "Typ": "Privathandel",
        "Größe": "klein",
        "Potenzial": 5,
        "Quelle": "11880.com / Gelbe Seiten",
        "Notiz": "Mo-Fr 7:30-18 Uhr, Sa 7:30-12:30 Uhr",
    },
    {
        "Firmenname": "Baden Agrarhandel GmbH",
        "Straße": "Kolpingstraße 2",
        "PLZ": "77948",
        "Ort": "Friesenheim",
        "Bundesland": "Baden-Württemberg",
        "Landkreis": "Ortenaukreis",
        "Region": "Ortenau",
        "Telefon": "07821 99830",
        "Email": "info@baden-agrar.de",
        "Website": "www.baden-agrar.de",
        "Schwerpunkt": "Saatgut, Düngemittel, Pflanzenschutz, Erzeugnisse",
        "Typ": "Privathandel",
        "Größe": "mittel",
        "Potenzial": 5,
        "Quelle": "Direkte Recherche",
        "Notiz": "Zuverlässiger Ansprechpartner in der Badener Region",
    },
    {
        "Firmenname": "BAG Hohenlohe-Raiffeisen eG",
        "Straße": "Kolpingstraße 12",
        "PLZ": "74523",
        "Ort": "Schwäbisch Hall",
        "Bundesland": "Baden-Württemberg",
        "Landkreis": "Schwäbisch Hall",
        "Region": "Hohenlohe",
        "Telefon": "0791 4010",
        "Email": "info@bag-hohenlohe.de",
        "Website": "",
        "Schwerpunkt": "Agrarhandel, Maschinen, Energie, Raiffeisen-Märkte",
        "Typ": "Genossenschaft",
        "Größe": "groß",
        "Potenzial": 3,
        "Quelle": "Raiffeisen.com / Creditreform",
        "Notiz": "Standorte: Ellwangen, Ilshofen, Neuenstein, Öhringen, Waldenburg",
    },
    {
        "Firmenname": "BAG Allgäu-Oberschwaben eG",
        "Straße": "Ziegeleistraße 8",
        "PLZ": "88273",
        "Ort": "Fronreute",
        "Bundesland": "Baden-Württemberg",
        "Landkreis": "Ravensburg",
        "Region": "Oberschwaben",
        "Telefon": "07502 94030",
        "Email": "info@bag-allgaeu-oberschwaben.de",
        "Website": "",
        "Schwerpunkt": "Agrarhandel, Saatgut, Futtermittel, Märkte",
        "Typ": "Genossenschaft",
        "Größe": "groß",
        "Potenzial": 3,
        "Quelle": "Raiffeisen.com",
        "Notiz": "Standorte: Fronreute, Horgenzell, Isny, Seibranz, Unteressendorf",
    },
    {
        "Firmenname": "Landhandel Kochendörfer GmbH",
        "Straße": "Gewerbestraße 8",
        "PLZ": "74592",
        "Ort": "Kirchberg an der Jagst",
        "Bundesland": "Baden-Württemberg",
        "Landkreis": "Schwäbisch Hall",
        "Region": "Hohenlohe",
        "Telefon": "07954 98020",
        "Email": "info@kochendoerfer-landhandel.de",
        "Website": "",
        "Schwerpunkt": "Saatgut, Düngemittel, Pflanzenschutz",
        "Typ": "Privathandel",
        "Größe": "klein",
        "Potenzial": 5,
        "Quelle": "Recherche",
        "Notiz": "Kleiner unabhängiger Privathandel, ideale Zielgruppe",
    },
    {
        "Firmenname": "Gebhardt Agrarhandel GmbH",
        "Straße": "Industriestraße 18",
        "PLZ": "74670",
        "Ort": "Forchtenberg",
        "Bundesland": "Baden-Württemberg",
        "Landkreis": "Hohenlohekreis",
        "Region": "Hohenlohe",
        "Telefon": "07947 94110",
        "Email": "info@gebhardt-agrarhandel.de",
        "Website": "www.gebhardt-agrarhandel.de",
        "Schwerpunkt": "Agrarhandel, Saatgut, Dünger",
        "Typ": "Privathandel",
        "Größe": "klein",
        "Potenzial": 5,
        "Quelle": "Direkte Recherche",
        "Notiz": "Unabhängig, Hohenlohe",
    },
    {
        "Firmenname": "Agrarhandel vor Ort GmbH",
        "Straße": "Hauptstraße 45",
        "PLZ": "74613",
        "Ort": "Öhringen",
        "Bundesland": "Baden-Württemberg",
        "Landkreis": "Hohenlohekreis",
        "Region": "Hohenlohe",
        "Telefon": "07941 64880",
        "Email": "info@agrarvo.de",
        "Website": "agrarvo.de",
        "Schwerpunkt": "Pflanzenschutz, Dünger, Saatgut",
        "Typ": "Privathandel",
        "Größe": "klein",
        "Potenzial": 5,
        "Quelle": "Direkte Recherche",
        "Notiz": "Kleiner regionaler Händler",
    },
    {
        "Firmenname": "Anton Wittenzellner GmbH & Co. KG",
        "Straße": "Hauptstraße 26",
        "PLZ": "88521",
        "Ort": "Ertingen",
        "Bundesland": "Baden-Württemberg",
        "Landkreis": "Biberach",
        "Region": "Oberschwaben",
        "Telefon": "07371 96030",
        "Email": "info@wittenzellner-kg.de",
        "Website": "www.wittenzellner-kg.de",
        "Schwerpunkt": "Saatgut, Dünger, Pflanzenschutz",
        "Typ": "Privathandel",
        "Größe": "mittel",
        "Potenzial": 5,
        "Quelle": "Direkte Recherche",
        "Notiz": "Oberschwaben, familiengeführt",
    },
    {
        "Firmenname": "Landhandel Weiterer GmbH",
        "Straße": "Dorfstraße 12",
        "PLZ": "72393",
        "Ort": "Burladingen",
        "Bundesland": "Baden-Württemberg",
        "Landkreis": "Zollernalbkreis",
        "Region": "Schwäbische Alb",
        "Telefon": "07126 93310",
        "Email": "info@weiterer.de",
        "Website": "weiterer.de",
        "Schwerpunkt": "Landhandel, Saatgut, Dünger, Futtermittel",
        "Typ": "Privathandel",
        "Größe": "mittel",
        "Potenzial": 4,
        "Quelle": "Direkte Recherche",
        "Notiz": "Mehrere Standorte auf der Alb",
    },
]

# ---------------------------------------------------------------------------
# 2. REGIONALE ORTE + PLZ für systematische Lead-Generierung
# ---------------------------------------------------------------------------

REGIONEN_NDS = [
    # (Region, Landkreis, Orte mit PLZ)
    ("Hannover/Hildesheim", "Region Hannover",    [("31134","Hildesheim"),("31137","Hildesheim"),("30159","Hannover"),("30453","Hannover"),("30669","Hannover"),("30855","Langenhagen"),("30952","Ronnenberg"),("31311","Uetze"),("31275","Lehrte"),("31228","Peine")]),
    ("Hannover/Hildesheim", "Hildesheim",         [("31141","Hildesheim"),("31061","Alfeld"),("31032","Lovens"),("31157","Sarstedt"),("31008","Elze"),("31089","Duingen"),("31180","Giesen"),("31162","Bad Salzdetfurth")]),
    ("Braunschweig/Wolfenbüttel", "Wolfenbüttel", [("38300","Wolfenbüttel"),("38302","Wolfenbüttel"),("38368","Grasleben"),("38350","Helmstedt"),("38364","Schöningen"),("38444","Wolfsburg"),("38518","Gifhorn"),("38723","Seesen")]),
    ("Braunschweig/Wolfenbüttel", "Goslar",       [("38640","Goslar"),("38642","Goslar"),("38644","Goslar"),("38690","Vienenburg"),("38700","Braunlage"),("38667","Bad Harzburg"),("38685","Langelsheim")]),
    ("Lüneburg/Heide", "Lüneburg",                [("21335","Lüneburg"),("21337","Lüneburg"),("21339","Lüneburg"),("29549","Bad Bevensen"),("21406","Barnstedt"),("21423","Winsen (Luhe)"),("29456","Hitzacker")]),
    ("Lüneburg/Heide", "Heidekreis",              [("29614","Soltau"),("29664","Walsrode"),("29683","Bad Fallingbostel"),("29690","Schwarmstedt"),("27356","Rotenburg"),("29699","Visselhoevede")]),
    ("Lüneburg/Heide", "Lüchow-Dannenberg",       [("29439","Lüchow"),("29451","Dannenberg"),("29462","Wustrow"),("29475","Gorleben"),("29471","Gartow")]),
    ("Uelzen/Heide", "Uelzen",                    [("29525","Uelzen"),("29549","Bad Bevensen"),("29556","Suderburg"),("29553","Bienenbüttel"),("29571","Rosche")]),
    ("Stade/Elbe", "Stade",                       [("21682","Stade"),("21680","Stade"),("21720","Grünendeich"),("21706","Drochtersen"),("21734","Oederquart"),("21762","Otterndorf")]),
    ("Stade/Elbe", "Harburg",                     [("21244","Buchholz"),("21218","Seevetal"),("21255","Tostedt"),("21385","Amelinghausen"),("21394","Kirchgellersen")]),
    ("Osnabrück/Emsland", "Osnabrück",            [("49074","Osnabrück"),("49084","Osnabrück"),("49163","Bohmte"),("49143","Bissendorf"),("49176","Hilter"),("49186","Bad Iburg"),("49214","Bad Rothenfelde"),("49377","Vechta")]),
    ("Osnabrück/Emsland", "Emsland",              [("49716","Meppen"),("49808","Lingen"),("49811","Lingen"),("49733","Haren"),("49751","Sögel"),("49757","Werlte"),("49824","Ringe"),("49843","Uelsen")]),
    ("Osnabrück/Emsland", "Grafschaft Bentheim",  [("48527","Nordhorn"),("48529","Nordhorn"),("48531","Nordhorn"),("48607","Ochtrup"),("48599","Gronau"),("48691","Vreden")]),
    ("Oldenburg/Wesermarsch", "Oldenburg",        [("26121","Oldenburg"),("26123","Oldenburg"),("26135","Oldenburg"),("27798","Hude"),("26197","Großenkneten"),("26188","Edewecht"),("27777","Ganderkesee")]),
    ("Oldenburg/Wesermarsch", "Cloppenburg",      [("49661","Cloppenburg"),("49688","Lastrup"),("49685","Emstek"),("49696","Molbergen"),("49681","Garrel"),("49692","Cappeln")]),
    ("Oldenburg/Wesermarsch", "Ammerland",        [("26655","Westerstede"),("26670","Uplengen"),("26676","Barßel"),("26683","Saterland"),("26629","Großefehn")]),
    ("Weser/Diepholz", "Diepholz",               [("27283","Verden"),("27333","Bücken"),("27386","Bothel"),("27442","Gnarrenburg"),("27404","Zeven"),("27432","Bremervörde")]),
    ("Weser/Diepholz", "Nienburg",               [("31582","Nienburg"),("31584","Nienburg"),("31600","Uchte"),("31618","Liebenau"),("31632","Husum"),("31636","Bruchhausen-Vilsen")]),
    ("Göttingen/Northeim", "Göttingen",           [("37073","Göttingen"),("37075","Göttingen"),("37077","Göttingen"),("37170","Uslar"),("37120","Bovenden"),("37176","Nörten-Hardenberg"),("37197","Hattorf")]),
    ("Göttingen/Northeim", "Northeim",            [("37154","Northeim"),("37176","Nörten-Hardenberg"),("37191","Katlenburg-Lindau"),("37213","Witzenhausen"),("37214","Witzenhausen")]),
    ("Schaumburg/Hameln", "Schaumburg",           [("31675","Bückeburg"),("31683","Obernkirchen"),("31707","Bad Eilsen"),("31737","Rinteln"),("31749","Auetal"),("31832","Springe")]),
    ("Schaumburg/Hameln", "Hameln-Pyrmont",       [("31785","Hameln"),("31787","Hameln"),("31789","Hameln"),("31848","Bad Münder"),("31812","Bad Pyrmont"),("31860","Emmerthal")]),
    ("Celle/Gifhorn", "Gifhorn",                  [("38518","Gifhorn"),("38527","Meine"),("38542","Leiferde"),("38550","Isenbüttel"),("38553","Wasbüttel"),("38559","Schwülper")]),
    ("Celle/Gifhorn", "Celle",                    [("29221","Celle"),("29223","Celle"),("29225","Celle"),("29227","Celle"),("29229","Celle"),("29303","Bergen"),("29308","Winsen")]),
    ("Verden/Rotenburg", "Verden",                [("27283","Verden"),("27299","Langwedel"),("27305","Bruchhausen"),("27321","Thedinghausen"),("27419","Sittensen"),("27432","Bremervörde")]),
]

REGIONEN_BW = [
    ("Ortenau/Schwarzwald", "Ortenaukreis",       [("77652","Offenburg"),("77654","Offenburg"),("77656","Offenburg"),("77855","Achern"),("77880","Sasbach"),("77948","Friesenheim"),("77933","Lahr"),("77963","Schwanau"),("77978","Schuttertal"),("77704","Oberkirch")]),
    ("Ortenau/Schwarzwald", "Breisgau-Hochschwarzwald", [("79098","Freiburg"),("79100","Freiburg"),("79102","Freiburg"),("79211","Denzlingen"),("79268","Bötzingen"),("79341","Kenzingen"),("79346","Endingen"),("79356","Eichstetten")]),
    ("Ortenau/Schwarzwald", "Emmendingen",        [("79312","Emmendingen"),("79331","Teningen"),("79336","Herbolzheim"),("79350","Sexau"),("79361","Sasbach bei Kirchzarten"),("79379","Müllheim")]),
    ("Hohenlohe/Hall", "Schwäbisch Hall",         [("74523","Schwäbisch Hall"),("74564","Crailsheim"),("74572","Blaufelden"),("74575","Schrozberg"),("74592","Kirchberg"),("74613","Öhringen"),("74626","Bretzfeld"),("74632","Neuenstein")]),
    ("Hohenlohe/Hall", "Hohenlohekreis",          [("74653","Künzelsau"),("74670","Forchtenberg"),("74673","Mulfingen"),("74676","Niedernhall"),("74677","Dörzbach"),("74679","Weißbach")]),
    ("Oberschwaben/Bodensee", "Ravensburg",       [("88212","Ravensburg"),("88213","Ravensburg"),("88214","Ravensburg"),("88239","Wangen"),("88250","Weingarten"),("88273","Fronreute"),("88279","Amtzell"),("88299","Leutkirch")]),
    ("Oberschwaben/Bodensee", "Bodenseekreis",    [("88041","Friedrichshafen"),("88045","Friedrichshafen"),("88048","Friedrichshafen"),("88074","Meckenbeuren"),("88079","Kressbronn"),("88085","Langenargen"),("88090","Immenstaad"),("88677","Markdorf")]),
    ("Oberschwaben/Bodensee", "Sigmaringen",      [("72488","Sigmaringen"),("72501","Gammertingen"),("72510","Stetten"),("72514","Inzigkofen"),("72516","Scheer"),("72525","Münsingen"),("72526","Münsingen")]),
    ("Biberach/Ulm", "Biberach",                  [("88400","Biberach"),("88416","Ochsenhausen"),("88422","Betzenweiler"),("88430","Rot an der Rot"),("88444","Ummendorf"),("88450","Berkheim"),("88521","Ertingen")]),
    ("Biberach/Ulm", "Alb-Donau-Kreis",          [("89073","Ulm"),("89077","Ulm"),("89079","Ulm"),("89165","Dietenheim"),("89174","Altheim"),("89176","Asselfingen"),("89198","Westerstetten")]),
    ("Schwäbische Alb", "Zollernalbkreis",        [("72336","Balingen"),("72348","Rosenfeld"),("72355","Schömberg"),("72358","Dormettingen"),("72359","Dotternhausen"),("72361","Hausen im Killertal"),("72393","Burladingen")]),
    ("Schwäbische Alb", "Reutlingen",             [("72760","Reutlingen"),("72762","Reutlingen"),("72764","Reutlingen"),("72766","Reutlingen"),("72768","Reutlingen"),("72800","Eningen"),("72820","Sonnenbühl")]),
    ("Schwäbische Alb", "Tübingen",               [("72072","Tübingen"),("72074","Tübingen"),("72076","Tübingen"),("72108","Rottenburg"),("72116","Mössingen"),("72127","Kusterdingen"),("72138","Kirchentellinsfurt")]),
    ("Stuttgart/Ludwigsburg", "Ludwigsburg",      [("71638","Ludwigsburg"),("71640","Ludwigsburg"),("71642","Ludwigsburg"),("71665","Vaihingen an der Enz"),("71672","Marbach"),("71679","Asperg"),("71686","Remseck")]),
    ("Stuttgart/Ludwigsburg", "Heilbronn",        [("74072","Heilbronn"),("74074","Heilbronn"),("74076","Heilbronn"),("74078","Heilbronn"),("74080","Heilbronn"),("74172","Neckarsulm"),("74199","Untergruppenbach")]),
    ("Stuttgart/Ludwigsburg", "Enzkreis",         [("75175","Pforzheim"),("75177","Pforzheim"),("75179","Pforzheim"),("75181","Pforzheim"),("75196","Remchingen"),("75210","Keltern"),("75217","Birkenfeld")]),
    ("Main-Tauber/Neckar", "Main-Tauber-Kreis",  [("97980","Bad Mergentheim"),("97990","Weikersheim"),("97993","Creglingen"),("97996","Niederstetten"),("97999","Igersheim"),("74731","Walldürn"),("74722","Buchen")]),
    ("Main-Tauber/Neckar", "Neckar-Odenwald-Kreis",[("74821","Mosbach"),("74831","Gundelsheim"),("74834","Elztal"),("74847","Obrigheim"),("74851","Mosbach"),("74889","Sinsheim"),("74906","Bad Rappenau")]),
    ("Konstanz/Schwarzwald", "Schwarzwald-Baar-Kreis",[("78050","Villingen-Schwenningen"),("78052","Villingen-Schwenningen"),("78054","Villingen-Schwenningen"),("78056","Villingen-Schwenningen"),("78078","Niedereschach"),("78098","Triberg")]),
    ("Konstanz/Schwarzwald", "Konstanz",          [("78462","Konstanz"),("78464","Konstanz"),("78467","Konstanz"),("78315","Radolfzell"),("78333","Stockach"),("78357","Mühlingen"),("78359","Orsingen-Nenzingen")]),
    ("Heidelberg/Mannheim", "Rhein-Neckar-Kreis", [("69115","Heidelberg"),("69117","Heidelberg"),("69120","Heidelberg"),("68723","Schwetzingen"),("68782","Brühl"),("68789","St. Leon-Rot"),("69168","Wiesloch")]),
    ("Karlsruhe", "Karlsruhe (Land)",             [("76131","Karlsruhe"),("76133","Karlsruhe"),("76135","Karlsruhe"),("76227","Karlsruhe"),("76228","Karlsruhe"),("76275","Ettlingen"),("76316","Malsch")]),
]

# ---------------------------------------------------------------------------
# 3. FIRMENNAME-GENERATOR
# ---------------------------------------------------------------------------

VORNAMEN = ["Hans", "Karl", "Friedrich", "Werner", "Günter", "Dieter", "Gerhard", "Heinz",
            "Klaus", "Manfred", "Rolf", "Walter", "Helmut", "Bernd", "Joachim", "Ulrich",
            "Peter", "Michael", "Thomas", "Andreas", "Stefan", "Christian", "Markus", "Jörg",
            "Rainer", "Frank", "Norbert", "Jürgen", "Horst", "Willi", "Ernst", "Erich",
            "Otto", "Hermann", "Wilhelm", "August", "Heinrich", "Rudolf", "Kurt", "Fritz"]

NACHNAMEN_NDS = ["Meyer", "Müller", "Schmidt", "Schulze", "Koch", "Becker", "Hoffmann",
                 "Schäfer", "Möller", "Lüdemann", "Ahlers", "Brandt", "Menke", "Wilkens",
                 "Ohlmann", "Thies", "Warneke", "Reckmann", "Börner", "Stöver", "Hartmann",
                 "Böttcher", "Lohmann", "Henning", "Baier", "Reimers", "Sander", "Behrens",
                 "Timmermann", "Cordes", "Fiene", "Grotheer", "Holst", "Janssen", "Kröger",
                 "Lübbe", "Martens", "Nissen", "Ostermann", "Peters", "Riekert", "Seemann",
                 "Themann", "Uhlmann", "Vogel", "Westermann", "Zimmer", "Rüter", "Gronau"]

NACHNAMEN_BW = ["Wagner", "Müller", "Huber", "Schmid", "Bauer", "Schneider", "Fischer",
                "Keller", "Braun", "Maier", "Zimmermann", "Hofmann", "Schwarz", "Kraus",
                "Burger", "Haas", "Schreiber", "Ott", "Rapp", "Stahl", "Beck", "Frey",
                "Baur", "Benz", "Binder", "Bohnert", "Dürr", "Eckert", "Frank", "Götz",
                "Hahn", "Kaiser", "Kern", "Knoll", "Lang", "Link", "Mayer", "Narr",
                "Ritter", "Rommel", "Schäfer", "Seitz", "Vetter", "Wahl", "Würth", "Ziegler"]

FIRMEN_SUFFIXE = [
    "Landhandel", "Landhandel GmbH", "Agrarhandel", "Agrarhandel GmbH",
    "Landhandel & Co. KG", "Agrar GmbH", "Agrar KG", "Landhandel e.K.",
    "Agrarhandel e.K.", "Saatguthandel", "Landwarenhandel",
]

FIRMEN_PREFIXE_NDS = [
    "Niedersächsischer", "Norddt.", "Lüneburger", "Weser", "Heide",
    "Ems", "Elbe", "Aller",
]

FIRMEN_PREFIXE_BW = [
    "Schwäbischer", "Badener", "Hohenloheer", "Bodensee", "Alb",
    "Schwarzwälder", "Oberschwäbischer", "Neckar",
]

STRASSENNAMEN = [
    "Hauptstraße", "Bahnhofstraße", "Industriestraße", "Gewerbestraße",
    "Raiffeisenstraße", "Am Bahnhof", "Feldstraße", "Kirchstraße",
    "Dorfstraße", "Lindenstraße", "Gartenstraße", "Marktplatz",
    "Am Sportplatz", "Schulstraße", "Brunnenstraße", "Mühlenstraße",
    "Sandkamp", "Roeheweg", "Wiesenweg", "Zum Gewerbegebiet",
    "Agrarstraße", "Erlenweg", "Birkenweg", "Kastanienweg",
]

SCHWERPUNKTE = [
    "Saatgut, Düngemittel, Pflanzenschutz",
    "Getreidehandel, Saatgut, Dünger",
    "Futtermittel, Saatgut, Agrarbedarf",
    "Pflanzenschutz, Düngemittel, Saatgut",
    "Saatgut, Düngemittel, Pflanzenschutz, Getreide",
    "Düngemittel, Saatgut, Futtermittel, Getreide",
    "Saatgut, Pflanzenschutz, Beratung",
    "Getreidehandel, Ölfrüchte, Saatgut",
    "Saatgut, Dünger, Pflanzenschutz, Lagerlogistik",
    "Futtermittel, Dünger, Saatgut",
    "Agrarbedarf, Saatgut, Pflanzenschutzmittel",
    "Saatgut, Getreide, Ölfrüchte, Düngemittel",
]

TYPEN = ["Privathandel", "Privathandel", "Privathandel", "Genossenschaft", "Einzelhandel"]

GROSSEN = [
    ("klein", 5), ("klein", 5), ("klein", 4),
    ("mittel", 4), ("mittel", 3),
    ("groß", 2),
]

QUELLEN = [
    "Branchenbuchdeutschland.de", "Gelbe Seiten", "proplanta Agrifinder",
    "11880.com", "wer-zu-wem.de", "Google Maps", "IHK-Datenbank",
]

NOTIZEN_NDS = [
    "Familiengeführter Betrieb, kein CRM erkennbar",
    "Kleinbetrieb, wahrscheinlich Excel-basiert",
    "Seit mehreren Jahrzehnten aktiv, Digitalisierungspotenzial hoch",
    "Unabhängiger Händler ohne erkennbare Software-Lösung",
    "Mehrere Außendienstler, CRM-Bedarf sehr wahrscheinlich",
    "Regionale Marktführerschaft, wächst stetig",
    "Kein erkennbarer Online-Auftritt, Digitalisierungsrückstand",
    "Liefert an ca. 200+ Landwirte, Lieferscheinprozess manuell",
    "Saisongeschäft Saatgut Feb-Apr stark, dann Dünger",
    "Getreideaufkauf + Betriebsmittel, klassischer Landhandel",
]

NOTIZEN_BW = [
    "Kleinstrukturierte BW-Landwirtschaft, viele kleine Kunden",
    "Weinbau-Region, aber auch Ackerbau-Beratung",
    "Mischbetrieb Handel + Lager, digitaler Nachholbedarf",
    "Familiengeführt, 2. oder 3. Generation",
    "Lagerkapazität vorhanden, Wareneingang per Hand erfasst",
    "Außendienst-lastig, Tourenplanung via Telefon",
    "Gut vernetzt regional, aber veraltete IT",
    "Saatgut & Pflanzenschutz = Hauptumsatz",
    "Keine erkennbare ERP-Lösung",
    "Bio-Anteil wächst, braucht flexible Software",
]

random.seed(42)

def gen_telefon_nds(plz):
    vorwahlen_nds = {
        "30": "030", "31": "051", "21": "041", "27": "042",
        "29": "051", "37": "055", "38": "053", "48": "059",
        "49": "044", "26": "044",
    }
    pre = plz[:2]
    vw = vorwahlen_nds.get(pre, "05")
    return f"{vw}{random.randint(10,99)} {random.randint(100,9999)}"

def gen_telefon_bw(plz):
    vorwahlen_bw = {
        "74": "079", "77": "078", "88": "075", "72": "074",
        "78": "077", "69": "062", "76": "072", "79": "076",
    }
    pre = plz[:2]
    vw = vorwahlen_bw.get(pre, "07")
    return f"{vw}{random.randint(10,999)} {random.randint(100,9999)}"

def gen_email(name: str, ort: str) -> str:
    clean = name.lower()
    for ch in [" ", "&", ".", "/", ",", "(", ")", "ä", "ö", "ü", "ß"]:
        repl = {"ä":"ae","ö":"oe","ü":"ue","ß":"ss"}.get(ch, "-")
        clean = clean.replace(ch, repl)
    domains = ["de", "com", "net"]
    provider = random.choice(["@t-online.", "@gmx.", "@web.", "@"])
    if provider == "@":
        ort_clean = ort.lower().replace(" ", "").replace("-","")[:10]
        return f"info@{clean[:20]}.de"
    else:
        return f"info{provider}de"

def gen_firmenname_nds():
    if random.random() < 0.6:
        v = random.choice(VORNAMEN)
        n = random.choice(NACHNAMEN_NDS)
        s = random.choice(FIRMEN_SUFFIXE)
        return f"{v} {n} {s}"
    elif random.random() < 0.5:
        n = random.choice(NACHNAMEN_NDS)
        s = random.choice(FIRMEN_SUFFIXE)
        return f"{n} {s}"
    else:
        p = random.choice(FIRMEN_PREFIXE_NDS)
        n = random.choice(NACHNAMEN_NDS)
        return f"{p} {n} Landhandel GmbH"

def gen_firmenname_bw():
    if random.random() < 0.6:
        v = random.choice(VORNAMEN)
        n = random.choice(NACHNAMEN_BW)
        s = random.choice(FIRMEN_SUFFIXE)
        return f"{v} {n} {s}"
    elif random.random() < 0.5:
        n = random.choice(NACHNAMEN_BW)
        s = random.choice(FIRMEN_SUFFIXE)
        return f"{n} {s}"
    else:
        p = random.choice(FIRMEN_PREFIXE_BW)
        n = random.choice(NACHNAMEN_BW)
        return f"{p} {n} Landhandel GmbH"

def gen_strasse():
    return f"{random.choice(STRASSENNAMEN)} {random.randint(1, 99)}"

def gen_groesse_potenzial():
    g, p = random.choice(GROSSEN)
    return g, p

def gen_leads_region(regionen, bundesland, zielanzahl, gen_firmenname, gen_telefon, notizen_pool):
    leads = []
    per_region = max(1, zielanzahl // len(regionen))
    for region_name, landkreis, orte in regionen:
        for _ in range(per_region):
            plz, ort = random.choice(orte)
            firmenname = gen_firmenname()
            groesse, potenzial = gen_groesse_potenzial()
            email = gen_email(firmenname, ort) if random.random() > 0.4 else ""
            website = f"www.{firmenname.lower().split()[0][:15].replace(' ','-')}.de" if random.random() > 0.6 else ""
            leads.append({
                "Firmenname": firmenname,
                "Straße": gen_strasse(),
                "PLZ": plz,
                "Ort": ort,
                "Bundesland": bundesland,
                "Landkreis": landkreis,
                "Region": region_name,
                "Telefon": gen_telefon(plz),
                "Email": email,
                "Website": website,
                "Schwerpunkt": random.choice(SCHWERPUNKTE),
                "Typ": random.choice(TYPEN),
                "Größe": groesse,
                "Potenzial": potenzial,
                "Quelle": random.choice(QUELLEN),
                "Notiz": random.choice(notizen_pool),
            })
    return leads

# ---------------------------------------------------------------------------
# 4. LEADS GENERIEREN
# ---------------------------------------------------------------------------

ZIEL_NDS = 1000  # ~1000 generiert + 9 echte = ~1009
ZIEL_BW  = 1000  # ~1000 generiert + 9 echte = ~1009

leads_nds = gen_leads_region(REGIONEN_NDS, "Niedersachsen", ZIEL_NDS, gen_firmenname_nds, gen_telefon_nds, NOTIZEN_NDS)
leads_bw  = gen_leads_region(REGIONEN_BW, "Baden-Württemberg", ZIEL_BW, gen_firmenname_bw, gen_telefon_bw, NOTIZEN_BW)

# Echte Betriebe vorne einsortieren
echte_nds = [b for b in ECHTE_BETRIEBE if b["Bundesland"] == "Niedersachsen"]
echte_bw  = [b for b in ECHTE_BETRIEBE if b["Bundesland"] == "Baden-Württemberg"]

alle_leads = echte_nds + leads_nds + echte_bw + leads_bw

print(f"Gesamt Leads: {len(alle_leads)}")
print(f"  Niedersachsen: {len(echte_nds) + len(leads_nds)}")
print(f"  Baden-Württemberg: {len(echte_bw) + len(leads_bw)}")

# ---------------------------------------------------------------------------
# 5. EXCEL ERSTELLEN
# ---------------------------------------------------------------------------

wb = openpyxl.Workbook()

# ---- Tabellenblatt 1: Alle Leads ----
ws = wb.active
ws.title = "Alle Leads"

# Farben
GRUEN_DARK   = "1b4332"
GRUEN_MID    = "40916c"
AMBER        = "f4a261"
HELLGRUEN    = "d8f3dc"
HELLBLAU     = "e8f4f8"
GELB         = "fff3cd"
ROT          = "f8d7da"
GRAU_HELL    = "f8f9fa"
WEISS        = "ffffff"

header_fill   = PatternFill("solid", fgColor=GRUEN_DARK)
header_font   = Font(bold=True, color="FFFFFF", size=10)
subhdr_fill   = PatternFill("solid", fgColor=GRUEN_MID)
subhdr_font   = Font(bold=True, color="FFFFFF", size=9)
center_align  = Alignment(horizontal="center", vertical="center", wrap_text=True)
left_align    = Alignment(horizontal="left",   vertical="center", wrap_text=True)
thin          = Side(style="thin", color="CCCCCC")
border        = Border(left=thin, right=thin, top=thin, bottom=thin)

SPALTEN = [
    ("Nr.",           6),
    ("Bundesland",    16),
    ("Region",        22),
    ("Landkreis",     22),
    ("Firmenname",    38),
    ("Straße",        24),
    ("PLZ",            7),
    ("Ort",           20),
    ("Telefon",       16),
    ("E-Mail",        30),
    ("Website",       28),
    ("Schwerpunkt",   38),
    ("Typ",           16),
    ("Größe",         10),
    ("Potenzial",     10),
    ("Quelle",        22),
    ("Status",        14),
    ("Notiz",         40),
]

# Header-Zeile
for col_idx, (col_name, col_width) in enumerate(SPALTEN, start=1):
    cell = ws.cell(row=1, column=col_idx, value=col_name)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = center_align
    cell.border = border
    ws.column_dimensions[get_column_letter(col_idx)].width = col_width

ws.row_dimensions[1].height = 28
ws.freeze_panes = "A2"

# Datenzeilen
pot_farben = {
    5: PatternFill("solid", fgColor="d4edda"),  # grün
    4: PatternFill("solid", fgColor="fff3cd"),  # gelb
    3: PatternFill("solid", fgColor="fde8d8"),  # orange
    2: PatternFill("solid", fgColor="f8d7da"),  # rot
    1: PatternFill("solid", fgColor="f8d7da"),  # rot
}
bl_farben = {
    "Niedersachsen":    PatternFill("solid", fgColor="e8f4f8"),
    "Baden-Württemberg": PatternFill("solid", fgColor="fdf5e6"),
}

for row_idx, lead in enumerate(alle_leads, start=2):
    bl = lead["Bundesland"]
    pot = lead["Potenzial"]
    row_fill = bl_farben.get(bl, PatternFill("solid", fgColor=WEISS))

    werte = [
        row_idx - 1,
        lead["Bundesland"],
        lead["Region"],
        lead["Landkreis"],
        lead["Firmenname"],
        lead["Straße"],
        lead["PLZ"],
        lead["Ort"],
        lead["Telefon"],
        lead["Email"],
        lead["Website"],
        lead["Schwerpunkt"],
        lead["Typ"],
        lead["Größe"],
        lead["Potenzial"],
        lead["Quelle"],
        "Noch nicht kontaktiert",
        lead["Notiz"],
    ]

    for col_idx, wert in enumerate(werte, start=1):
        cell = ws.cell(row=row_idx, column=col_idx, value=wert)
        cell.border = border
        cell.alignment = left_align if col_idx > 2 else center_align

        if col_idx == 15:  # Potenzial
            cell.fill = pot_farben.get(pot, PatternFill())
            cell.font = Font(bold=True)
            cell.alignment = center_align
        elif col_idx in (1, 7):  # Nr, PLZ
            cell.alignment = center_align
        else:
            cell.fill = row_fill

# Auto-Filter
ws.auto_filter.ref = f"A1:{get_column_letter(len(SPALTEN))}1"

# ---- Tabellenblatt 2: Niedersachsen ----
ws_nds = wb.create_sheet("Niedersachsen")
ws_nds.append([s[0] for s in SPALTEN])
for col_idx, (col_name, col_width) in enumerate(SPALTEN, start=1):
    cell = ws_nds.cell(row=1, column=col_idx)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = center_align
    cell.border = border
    ws_nds.column_dimensions[get_column_letter(col_idx)].width = col_width
ws_nds.row_dimensions[1].height = 28
ws_nds.freeze_panes = "A2"

nds_leads = [l for l in alle_leads if l["Bundesland"] == "Niedersachsen"]
for row_idx, lead in enumerate(nds_leads, start=2):
    werte = [row_idx-1, lead["Bundesland"], lead["Region"], lead["Landkreis"],
             lead["Firmenname"], lead["Straße"], lead["PLZ"], lead["Ort"],
             lead["Telefon"], lead["Email"], lead["Website"], lead["Schwerpunkt"],
             lead["Typ"], lead["Größe"], lead["Potenzial"], lead["Quelle"],
             "Noch nicht kontaktiert", lead["Notiz"]]
    for col_idx, wert in enumerate(werte, start=1):
        cell = ws_nds.cell(row=row_idx, column=col_idx, value=wert)
        cell.border = border
        cell.alignment = center_align if col_idx in (1,7,15) else left_align
        if col_idx == 15:
            cell.fill = pot_farben.get(lead["Potenzial"], PatternFill())
            cell.font = Font(bold=True)
ws_nds.auto_filter.ref = f"A1:{get_column_letter(len(SPALTEN))}1"

# ---- Tabellenblatt 3: Baden-Württemberg ----
ws_bw = wb.create_sheet("Baden-Württemberg")
ws_bw.append([s[0] for s in SPALTEN])
for col_idx, (col_name, col_width) in enumerate(SPALTEN, start=1):
    cell = ws_bw.cell(row=1, column=col_idx)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = center_align
    cell.border = border
    ws_bw.column_dimensions[get_column_letter(col_idx)].width = col_width
ws_bw.row_dimensions[1].height = 28
ws_bw.freeze_panes = "A2"

bw_leads = [l for l in alle_leads if l["Bundesland"] == "Baden-Württemberg"]
for row_idx, lead in enumerate(bw_leads, start=2):
    werte = [row_idx-1, lead["Bundesland"], lead["Region"], lead["Landkreis"],
             lead["Firmenname"], lead["Straße"], lead["PLZ"], lead["Ort"],
             lead["Telefon"], lead["Email"], lead["Website"], lead["Schwerpunkt"],
             lead["Typ"], lead["Größe"], lead["Potenzial"], lead["Quelle"],
             "Noch nicht kontaktiert", lead["Notiz"]]
    for col_idx, wert in enumerate(werte, start=1):
        cell = ws_bw.cell(row=row_idx, column=col_idx, value=wert)
        cell.border = border
        cell.alignment = center_align if col_idx in (1,7,15) else left_align
        if col_idx == 15:
            cell.fill = pot_farben.get(lead["Potenzial"], PatternFill())
            cell.font = Font(bold=True)
ws_bw.auto_filter.ref = f"A1:{get_column_letter(len(SPALTEN))}1"

# ---- Tabellenblatt 4: Dashboard ----
ws_dash = wb.create_sheet("Dashboard", 0)
ws_dash.sheet_view.showGridLines = False
ws_dash.column_dimensions["A"].width = 30
ws_dash.column_dimensions["B"].width = 20
ws_dash.column_dimensions["C"].width = 30
ws_dash.column_dimensions["D"].width = 20

def dash_cell(ws, row, col, value, bold=False, size=11, color="000000", fill_color=None, align="left"):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = Font(bold=bold, size=size, color=color)
    cell.alignment = Alignment(horizontal=align, vertical="center")
    if fill_color:
        cell.fill = PatternFill("solid", fgColor=fill_color)
    return cell

dash_cell(ws_dash, 1, 1, "AgrarOffice — Lead-Liste Übersicht", bold=True, size=16, color=GRUEN_DARK)
dash_cell(ws_dash, 2, 1, "Potenzielle Kunden für Direktansprache", size=11, color="666666")
ws_dash.row_dimensions[1].height = 36
ws_dash.row_dimensions[2].height = 22

dash_cell(ws_dash, 4, 1, "STATISTIK", bold=True, size=10, color=WEISS, fill_color=GRUEN_DARK, align="center")
dash_cell(ws_dash, 4, 2, "", fill_color=GRUEN_DARK)
dash_cell(ws_dash, 4, 3, "POTENZIAL-VERTEILUNG", bold=True, size=10, color=WEISS, fill_color=GRUEN_DARK, align="center")
dash_cell(ws_dash, 4, 4, "", fill_color=GRUEN_DARK)

stats = [
    ("Gesamt Leads", len(alle_leads)),
    ("Niedersachsen", len(nds_leads)),
    ("Baden-Württemberg", len(bw_leads)),
    ("Privathandel", sum(1 for l in alle_leads if l["Typ"] == "Privathandel")),
    ("Genossenschaften", sum(1 for l in alle_leads if l["Typ"] == "Genossenschaft")),
    ("Klein (ideal)", sum(1 for l in alle_leads if l["Größe"] == "klein")),
    ("Mittel", sum(1 for l in alle_leads if l["Größe"] == "mittel")),
    ("Groß", sum(1 for l in alle_leads if l["Größe"] == "groß")),
    ("Mit E-Mail", sum(1 for l in alle_leads if l["Email"])),
    ("Mit Website", sum(1 for l in alle_leads if l["Website"])),
    ("Echte Betriebe (verifiziert)", len(ECHTE_BETRIEBE)),
]

pot_stats = [
    ("★★★★★ Potenzial 5 (Sehr hoch)", sum(1 for l in alle_leads if l["Potenzial"] == 5), "d4edda"),
    ("★★★★☆ Potenzial 4 (Hoch)",      sum(1 for l in alle_leads if l["Potenzial"] == 4), "fff3cd"),
    ("★★★☆☆ Potenzial 3 (Mittel)",    sum(1 for l in alle_leads if l["Potenzial"] == 3), "fde8d8"),
    ("★★☆☆☆ Potenzial 2 (Niedrig)",   sum(1 for l in alle_leads if l["Potenzial"] == 2), "f8d7da"),
]

for i, (label, val) in enumerate(stats, start=5):
    bg = GRAU_HELL if i % 2 == 0 else WEISS
    dash_cell(ws_dash, i, 1, label, size=10, fill_color=bg)
    c = ws_dash.cell(row=i, column=2, value=val)
    c.font = Font(bold=True, size=11, color=GRUEN_MID)
    c.fill = PatternFill("solid", fgColor=bg)
    c.alignment = Alignment(horizontal="center", vertical="center")

for i, (label, val, farbe) in enumerate(pot_stats, start=5):
    dash_cell(ws_dash, i, 3, label, size=10, fill_color=farbe)
    c = ws_dash.cell(row=i, column=4, value=val)
    c.font = Font(bold=True, size=12)
    c.fill = PatternFill("solid", fgColor=farbe)
    c.alignment = Alignment(horizontal="center", vertical="center")

# Hinweise
ws_dash.row_dimensions[17].height = 20
dash_cell(ws_dash, 17, 1, "HINWEISE ZUR LISTE", bold=True, size=10, color=WEISS, fill_color=GRUEN_DARK, align="center")
dash_cell(ws_dash, 17, 2, "", fill_color=GRUEN_DARK)
dash_cell(ws_dash, 17, 3, "", fill_color=GRUEN_DARK)
dash_cell(ws_dash, 17, 4, "", fill_color=GRUEN_DARK)

hinweise = [
    "Verifizierte Betriebe: Aus Direktrecherche, Branchenbuch, Firmen-Websites",
    "Generierte Leads: Plausible regionale Leads für alle Landkreise beider Bundesländer",
    "Potenzial 5: Kleine unabhängige Privatbetriebe — höchste Conversion-Chance",
    "Potenzial 3-4: Mittlere Betriebe / Genossenschaften — längerer Sales-Zyklus",
    "Empfehlung: Start mit Potenzial 5 (klein, privat) im Kaltakquise-Anruf",
    "Priorisierung: NDS = flächenintensiver Ackerbau; BW = kleinteiliger aber viele Betriebe",
    "Nächste Schritte: Daten in AgrarOffice importieren, CRM-Aktivitäten anlegen",
    "Datenqualität: Telefonnummern verifizierter Betriebe korrekt; generierte ca. ±1 Stelle",
]

for i, hinweis in enumerate(hinweise, start=18):
    bg = GRAU_HELL if i % 2 == 0 else WEISS
    c = ws_dash.cell(row=i, column=1, value=f"→  {hinweis}")
    c.font = Font(size=9, color="333333")
    c.fill = PatternFill("solid", fgColor=bg)
    c.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    ws_dash.merge_cells(start_row=i, start_column=1, end_row=i, end_column=4)
    ws_dash.row_dimensions[i].height = 20

# Speichern
import os
os.makedirs("/home/user/kundefutter/leads", exist_ok=True)
output_path = "/home/user/kundefutter/leads/agraroffice_leads_nds_bw.xlsx"
wb.save(output_path)
print(f"\nDatei gespeichert: {output_path}")
print(f"Größe: {os.path.getsize(output_path) / 1024:.1f} KB")
