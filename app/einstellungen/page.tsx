import Link from "next/link";

function EinstellungTile({ href, icon, title, description }: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 sm:p-5 bg-white border border-gray-200 rounded-xl hover:border-green-400 hover:shadow-md transition-all group active:bg-green-50"
    >
      <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-800 group-hover:text-green-700">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </Link>
  );
}

interface Tile {
  href: string;
  icon: string;
  title: string;
  description: string;
}

interface Section {
  title: string;
  description: string;
  tiles: Tile[];
}

const SECTIONS: Section[] = [
  {
    title: "Firma & Darstellung",
    description: "Stammdaten des Betriebs und Aussehen der Anwendung.",
    tiles: [
      { href: "/einstellungen/firma", icon: "🏢", title: "Firma", description: "Name, Adresse, Bankverbindung, Footer & Rechnungshinweis" },
      { href: "/einstellungen/erscheinungsbild", icon: "🎨", title: "Erscheinungsbild", description: "Logo, Favicon und Design" },
    ],
  },
  {
    title: "Stammdaten & Kataloge",
    description: "Auswahllisten und Vorgabewerte für die tägliche Arbeit.",
    tiles: [
      { href: "/einstellungen/stammdaten", icon: "📂", title: "Stammdaten", description: "Kategorien, Einheiten, Lagerorte, Fruchtarten" },
      { href: "/einstellungen/artikelkategorien", icon: "🏷️", title: "Artikelkategorien", description: "Artikel-Kategorien anlegen, umbenennen und löschen" },
      { href: "/einstellungen/lieferanten", icon: "🚚", title: "Lieferanten", description: "Standard-Zahlungskonditionen und Lieferbedingungen" },
      { href: "/einstellungen/lager", icon: "📦", title: "Lager", description: "Mindestbestände, Alarme und Kategorien" },
      { href: "/einstellungen/futterwerte", icon: "🐄", title: "Futterwerte", description: "Eigene Futtermittel für die Rationsberechnung pflegen" },
      { href: "/einstellungen/fruehbezug", icon: "⏱", title: "Frühbezugs-Staffeln", description: "Saison-Rabatte für Vorbestellungen (z.B. -3% bis 31.07.)" },
      { href: "/einstellungen/tournamen", icon: "🚛", title: "Tour-Namen", description: "Gespeicherte Tourbezeichnungen" },
    ],
  },
  {
    title: "Belege, Nummern & Finanzen",
    description: "Nummernkreise, Buchhaltung und finanzbezogene Vorgaben.",
    tiles: [
      { href: "/einstellungen/nummernkreis", icon: "🔢", title: "Nummernkreise", description: "Präfixe & Zähler für Artikel-, Angebots- und Vorbestellnummern" },
      { href: "/einstellungen/mahnwesen", icon: "⚠️", title: "Mahnwesen", description: "Mahnstufen-Fristen, Mahngebühren und Verzugszinssatz" },
      { href: "/einstellungen/ausgaben", icon: "🧾", title: "Ausgaben", description: "Kategorien für Betriebsausgaben konfigurieren" },
      { href: "/einstellungen/bankkonten", icon: "🏦", title: "Bankkonten", description: "Konten für den Bankabgleich hinterlegen" },
      { href: "/einstellungen/datev", icon: "📊", title: "DATEV", description: "Beraternummer, Mandantennummer und Kontenrahmen" },
    ],
  },
  {
    title: "Import & Schnittstellen",
    description: "Datenimporte und Anbindung externer Dienste.",
    tiles: [
      { href: "/einstellungen/import", icon: "📥", title: "Import", description: "Kunden, Artikel und Stammdaten aus Excel-Dateien importieren" },
      { href: "/einstellungen/artikel-import", icon: "🌿", title: "Artikel-Stammdaten", description: "marstall & BvG Agrar Artikel manuell importieren" },
      { href: "/einstellungen/agrarantraege", icon: "🌾", title: "Agraranträge (AFIG)", description: "CSV von agrarzahlungen.de importieren" },
      { href: "/einstellungen/marktpreise", icon: "📈", title: "Marktpreise", description: "Eurostat-Cache-Gültigkeit und Daten-Aktualisierung" },
      { href: "/einstellungen/email", icon: "✉️", title: "E-Mail-Versand", description: "SMTP oder Resend für Rechnungsversand (PDF + ZUGFeRD)" },
      { href: "/einstellungen/google-drive", icon: "☁️", title: "Google Drive", description: "Dokumente für Kunden und Artikel in Drive ablegen" },
      { href: "/einstellungen/ki", icon: "🤖", title: "KI / AI", description: "API-Keys, Modellauswahl und Nutzungsstatistik" },
    ],
  },
  {
    title: "Benutzer & Sicherheit",
    description: "Zugriffsrechte und automatische Hinweise.",
    tiles: [
      { href: "/einstellungen/benutzer", icon: "👥", title: "Benutzer", description: "Benutzerkonten, Rollen und Zugriffsrechte verwalten" },
      { href: "/einstellungen/sicherheit", icon: "🔒", title: "Sicherheit", description: "Passwort-Richtlinie und Hinweise zum sicheren Betrieb" },
      { href: "/einstellungen/benachrichtigungen", icon: "🔔", title: "Benachrichtigungen", description: "System-Alerts (Sachkunde, Kreditlimit, Lager, Rechnungen)" },
    ],
  },
  {
    title: "System & Daten",
    description: "Wartung, Datensicherung und Diagnose.",
    tiles: [
      { href: "/einstellungen/system", icon: "⚙️", title: "System", description: "Version, Datenbank und Diagnose" },
      { href: "/einstellungen/backup", icon: "💾", title: "Datensicherung", description: "Datenbank-Backups erstellen und verwalten" },
      { href: "/einstellungen/adressen", icon: "🗺️", title: "Adress-Validierung", description: "Geocoding für alle Kundenadressen" },
      { href: "/audit", icon: "📜", title: "Änderungshistorie", description: "Alle Änderungen an Stammdaten nachverfolgen" },
      { href: "/inventur", icon: "📋", title: "Inventur", description: "Lagerbestand erfassen, Leerliste drucken, Differenzen buchen" },
    ],
  },
];

export default function EinstellungenPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 sm:mb-8">Einstellungen</h1>

      <div className="space-y-8 sm:space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <div className="mb-3 sm:mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {section.title}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">{section.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {section.tiles.map((tile) => (
                <EinstellungTile key={tile.href} {...tile} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
